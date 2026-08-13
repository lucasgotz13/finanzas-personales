# Design: Trade History — derived positions from a trade ledger

## Technical Approach

Trades become the source of truth (TH-1..TH-5): a pure-TS `TradeService` in `packages/domain/src/investments/` owns CRUD, chronological running-balance validation, moving-average cost, and realized P&L. A derived repository adapts `TradeService.derivedPositions()` to the existing `PositionRepository` port, so `PortfolioService` and `ChartService` (PC-1) consume derived positions with zero chart changes (TH-7). Migration 006 seeds each legacy position as an initial BUY; the positions table is kept ONLY as rollback net. Positions are derived solely from trades, so tickers without trades have no position (PI-1).

## Architecture Decisions

| # | Decision | Choice | Alternatives | Rationale |
|---|----------|--------|--------------|-----------|
| D1 | Derivation location | Pure-TS `TradeService`; thin `DerivedPositionRepository` adapter over it | SQL derivation in adapter; inside PortfolioService | Domain rules stay unit-testable, no SQL — matches existing domain/services pattern |
| D2 | Legacy positions | Read-only `LegacyPositionPort` for legacy id/name merge only; positions table kept as rollback net; no fallback read | Fallback read for tickers with no trades; drop table | Positions derived solely from trades (PI-1); a fallback read contradicted PI-1 and produced unspec'd resurfacing; id/name preserved via D3; rollback net keeps the redeploy path |
| D3 | Derived id (no legacy record) | Stable negative hash `-abs(fnv1a(ticker))` | Sequential negatives; string ids | Never collides with AUTOINCREMENT legacy ids; stable across recomputes (chart cache keys) |
| D4 | Trade update verb | PUT, full replace | PATCH | TH-1 scenarios use PUT; full-replace simplifies re-validation (TH-2). Launch prompt said PATCH — spec wins |
| D5 | Removed position endpoints | Drop routes → 404 via notFoundHandler | 405 responses | Matches "endpoint absent (404/405)" (PI-1); lockstep deploy, old clients fail loudly |
| D6 | Realized P&L storage | Derived on read, never stored | realized_minor column | Recomputes consistently after any edit/delete; no drift |
| D7 | Same-day ordering | `ORDER BY trade_date, id` | createdAt tie-break | id IS insertion order (TH-2) |
| D8 | Realized chip colors | Gain: `badge ok` ink-on-gray-green; loss: `badge over` danger red | Action green for gains | DESIGN.md One Green Rule: green means action, never status/data; matches existing P&L chips |
| D9 | PositionRepository port | Slim to `list()` + `findByTicker()` | Keep mutation methods | Dead mutations on a derived read model mislead; no remaining caller |

## Data Flow

```
POST/PUT/DELETE /portfolio/trades → TradeService (validate → simulate timeline → repo)
GET /portfolio/trades             → TradeService.list() → repo ORDER BY trade_date, id
GET /portfolio                    → PortfolioService → DerivedPositionRepository → derivedPositions()
                                          → + ledger.realizedTotals() → PortfolioSummary (+realizedUsdMinor)
GET /portfolio/positions/:id/history → ChartService → DerivedPositionRepository (legacy ids) — UNCHANGED
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/domain/src/investments/types.ts` | Modify | `Trade`, `TradeInput`, `RealizedTotals`; `PositionView.realizedUsdMinor`, `PortfolioSummary.totals.realizedUsdMinor` |
| `packages/domain/src/investments/ports.ts` | Modify | Add `TradeRepository`, `LegacyPositionPort`; slim `PositionRepository` |
| `packages/domain/src/investments/trades.ts` | Create | `TradeService`: CRUD, timeline validation, moving avg, realized P&L, derived positions |
| `packages/domain/src/investments/derived-repo.ts` | Create | `DerivedPositionRepository` (implements `PositionRepository`) |
| `packages/domain/src/investments/service.ts` | Modify | `PortfolioService`: realized totals merged into summary + views |
| `packages/domain/src/index.ts` | Modify | Export new types/services |
| `db/migrations/006_trades.sql` | Create | trades table + idempotent seed |
| `apps/api/src/sqlite/trades-repo.ts` | Create | `SqliteTradeRepository`, `SqliteLegacyPositionRepository` |
| `apps/api/src/http/routes/portfolio.ts` | Modify | Trades CRUD; drop position mutations; realized in GET /portfolio |
| `apps/api/src/http/app.ts` | Modify | Wire tradeService + derived positions repo |
| `apps/web/src/components/TradeForm.tsx` | Create | Replaces PositionForm (type/ticker/date/qty/price USD, es-AR) |
| `apps/web/src/components/PositionForm.tsx` | Delete | Manual position editing removed |
| `apps/web/src/pages/InvestmentsPage.tsx` | Modify | Trade list per asset (date desc), realized chips, summary row |
| `apps/web/src/api.ts`, `types.ts` | Modify | Trade CRUD methods, realized fields |

## Interfaces / Contracts

```ts
type TradeType = 'buy' | 'sell';
interface Trade { id: number; ticker: string; type: TradeType; date: string; // YYYY-MM-DD
  quantity: number; priceMinor: number; currency: 'USD'; }
interface TradeInput { ticker: string; type: TradeType; date: string;
  quantity: number; priceMinor: number; currency: 'USD'; }
interface TradeRepository { list(): Promise<Trade[]>; create(i: TradeInput): Promise<Trade>;
  update(id: number, i: TradeInput): Promise<Trade | null>; delete(id: number): Promise<boolean>; }
interface LegacyPositionPort { list(): Promise<Position[]>; }
interface RealizedTotals { perTicker: Record<string, number>; total: number; } // minor, losses negative
```

- Trades: `GET /portfolio/trades` → `Trade[]` ordered (date, id); `POST` → 201; `PUT`/`DELETE /portfolio/trades/:id` → 200/204, 404 unknown, 422 invalid (reuse `normalizeTicker` — uppercases + `.BA`).
- Timeline rejection 422: `details: ['sell of 10 AAPL.BA on 2026-08-10 (id 12) exceeds balance 5; fix that sell first']`.

```sql
CREATE TABLE trades (id INTEGER PRIMARY KEY AUTOINCREMENT, ticker TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy','sell')), trade_date TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0), price_minor INTEGER NOT NULL CHECK (price_minor > 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'), created_at TEXT NOT NULL);
CREATE INDEX idx_trades_ticker_date ON trades (ticker, trade_date, id);
INSERT INTO trades (ticker, type, trade_date, quantity, price_minor, currency, created_at)
SELECT ticker, 'buy', date('now'), quantity, avg_cost_minor, 'USD', datetime('now') FROM positions;
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Moving avg (buys average, sell keeps avg, full-sale reset), realized gain/loss/cumulative, balance rejection naming trade, invalidating edit/delete, same-day id ordering, derived merge (no legacy fallback) | New `packages/domain/tests/investments/trades.test.ts`, stub repos |
| Integration | CRUD + normalization + 422/404; timeline 422; derived GET /portfolio + realized (loss negative); removed endpoints → 404; migrate() twice → no duplicate seeds; price charts unchanged | `apps/api/tests/trades.test.ts` + portfolio.test.ts rewrites (temp DB, helpers.ts). `history.test.ts` (price charts) re-seeds BUY trades via new test helpers instead of raw positions — assertions unchanged (TH-7-compliant: behavior unchanged, fixtures follow the production data model) |
| Component | Form es-AR validation, submit, rejected-sell error, grouping date desc, chips, confirm flows, empty/error/Reintentar | `TradeForm.test.tsx`, `InvestmentsPage.test.tsx` |

## Threat Matrix

N/A — no git/PR/executable boundary changes: Documentation-like paths N/A (no markdown/executable classification); Git repository selection, Commit state, Push state, PR commands all N/A (no VCS automation). HTTP route surface changes are covered by integration tests (404 on removed endpoints; 422/404 semantics on trades).

## Migration / Rollout

006 creates trades + seed; the runner's `schema_migrations` guarantees once-only — a re-run applies nothing (idempotency test proves it). Seed trades are ordinary rows, editable via CRUD (TH-5). Rollback: redeploy previous build; positions table intact; optional 007 drops trades. Lockstep API+web deploy (positions mutations gone).

## Open Questions

- [ ] None blocking. Note: PUT chosen over the launch prompt's PATCH, per TH-1 scenarios (D4).

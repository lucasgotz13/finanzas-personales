# Design: Investment Tracking

## Technical Approach

Mirror economic-indicators 1:1. Pure domain module `packages/domain/src/investments/` (types, catalog, ports, PortfolioService); adapters in `apps/api` (Yahoo source, SQLite repo/cache); migration 004; REST `/api/v1/portfolio`; web Inversiones tab reusing the IndicatorsPage visibility-gated auto-refresh and the TransactionsPage CRUD/confirm patterns. CCL is READ-ONLY from the existing dolarapi cache — portfolio never fetches FX. Zero changes to existing capabilities (PI-7).

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|---|---|---|---|
| FX access | Reuse `IndicatorCache.get('usd-ccl')` | Couples investments to indicator keys/snapshot shape | New `PortfolioFxPort.getCcl()`; API `CclAccessor` wraps the SAME `SqliteIndicatorCache` instance, read-only |
| ARS→USD | Convert inside domain service | Adapter then needs CCL anyway; domain gets external-data concerns | Adapter normalizes; domain sees only USD cents |
| quantity type | INTEGER | Blocks fractional CEDEARs (0.5) | REAL + `CHECK (quantity > 0)`; valuation rounds once |
| Snapshot lifetime | Two DELETEs in service | Duplicates responsibility | FK `price_snapshots.ticker → positions(ticker) ON DELETE CASCADE` (pragma already ON in migrate.ts) |
| 429 safety | Sleep between calls | Blocks healthy symbols | Per-symbol cooldown (60 s, in-memory) inside YahooSource + sequential loop |
| CCL freshness | — | — | Reuse fx TTL (5 min): stale → last known + `ccStatus:"stale"`; absent → USD-only, never blank |

## Data Flow

```
GET /portfolio       → PortfolioService.getPortfolio()
                        ├─ repo.list() ordered by ticker
                        ├─ priceCache.get(ticker) → fresh|stale|absent vs TTL
                        └─ fx.getCcl() → ARS values + ccStatus
POST /refresh?force  → PortfolioService.refresh(): per position SEQUENTIALLY
                        ├─ age ≤ TTL && !force → cached
                        └─ yahoo.fetch(ticker) → USD normalize → cache.set → updated | failed
```

## File Changes

| File | Action | Description |
|---|---|---|
| `packages/domain/src/investments/{types,catalog,ports,service}.ts` | Create | Entities/VOs, TTL catalog, ports, PortfolioService |
| `packages/domain/src/index.ts` | Modify | Export investments module |
| `db/migrations/004_investments.sql` | Create | positions + price_snapshots |
| `apps/api/src/sources/yahoo.ts` | Create | Yahoo v8 adapter: ARS→USD, cooldown |
| `apps/api/src/sqlite/positions-repo.ts`, `sqlite/price-cache.ts` | Create | SQLite adapters |
| `apps/api/src/http/routes/portfolio.ts` | Create | REST routes |
| `apps/api/src/http/app.ts` | Modify | Wire services; shared indicator-cache instance |
| `apps/api/tests/portfolio.test.ts`, `tests/sources/yahoo.test.ts` | Create | Integration + adapter tests |
| `apps/web/src/pages/InvestmentsPage.tsx`, `components/PositionForm.tsx` | Create | Tab UI |
| `apps/web/src/{api.ts,types.ts,App.tsx}` | Modify | Tab, client, types |
| `apps/web/src/pages/__tests__/InvestmentsPage.test.tsx` | Create | Component tests |

## Interfaces / Contracts

```ts
// investments/types.ts
type PriceStatus = 'fresh' | 'stale' | 'absent';
type CcStatus = 'fresh' | 'stale' | 'absent';
interface Position { id?: number; ticker: string; name: string;
  quantity: number; avgCostMinor: number; currency: 'USD'; createdAt: string; }
interface PriceSnapshot { ticker: string; priceMinor: number; currency: 'USD';
  fetchedAt: string; source: string; }
interface PositionView { id: number; ticker: string; name: string; quantity: number;
  avgCostMinor: number; priceMinor: number | null; status: PriceStatus;
  valueUsdMinor: number | null; valueArsMinor: number | null;
  pnlUsdMinor: number | null; pnlPct: number | null; pnlArsMinor: number | null; }
interface PortfolioSummary { ccStatus: CcStatus;
  totals: { valueUsdMinor: number; valueArsMinor: number | null;
    pnlUsdMinor: number; pnlPct: number | null; pnlArsMinor: number | null };
  positions: PositionView[]; }
interface PortfolioRefreshResult { ticker: string;
  status: 'updated' | 'cached' | 'failed'; error?: string; }

// ports.ts
interface PriceSource { fetch(ticker: string): Promise<PriceQuote>; }
interface PriceCache { get(ticker: string): Promise<PriceSnapshot | null>;
  set(s: PriceSnapshot): Promise<void>; }
interface PositionRepository { create(p: Position): Promise<Position>;
  update(id: number, p: Position): Promise<Position | null>; list(): Promise<Position[]>;
  findByTicker(ticker: string): Promise<Position | null>; delete(id: number): Promise<boolean>; }
interface PortfolioFxPort { getCcl(): Promise<{ value: number; fetchedAt: string } | null>; }
```

Migration 004: `positions(id INTEGER PK AUTOINCREMENT, ticker TEXT NOT NULL UNIQUE, name TEXT NOT NULL, quantity REAL NOT NULL CHECK(quantity > 0), avg_cost_minor INTEGER NOT NULL CHECK(avg_cost_minor > 0), created_at TEXT NOT NULL)`; `price_snapshots(ticker TEXT PK REFERENCES positions(ticker) ON DELETE CASCADE, price_minor INTEGER NOT NULL, currency TEXT NOT NULL, fetched_at TEXT NOT NULL, source TEXT NOT NULL)` — upsert like `indicator_snapshots`.

Yahoo parse: `chart.result[0].meta.regularMarketPrice` (finite) + `meta.currency`; `"ARS"` → `priceMinor = round(price / ccl * 100)` (CCL null → throw → `failed`); 404/NaN/bad JSON → throw; 429 → throw + 60 s per-ticker cooldown (fail-fast while active). P&L: `pnlUsdMinor = round((priceMinor − avgCostMinor) × quantity)`, `pnlPct = (priceMinor − avgCostMinor) / avgCostMinor`; ARS variants via CCL when present.

API: `GET /portfolio` (cache-first, never fetches); `POST /portfolio/positions` (ticker uppercase + `.BA`, dup → 409, currency ≠ USD → 422); `PATCH|DELETE /portfolio/positions/:id` (hard delete); `POST /portfolio/refresh?force=true`. Reuses the `DomainError` envelope.

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Domain unit | valuation, P&L, CCL degrade, ticker normalize, TTL/force, per-symbol isolation | In-memory fakes + FakeClock |
| Adapter | ok USD, ARS+CCL, ARS w/o CCL, 404, NaN, malformed, 429+cooldown | Mocked fetch |
| API integration | CRUD, 422/409, cache-first GET (zero source calls), mixed refresh, CCL stale/absent | supertest + temp SQLite + stub PriceSource + seeded usd-ccl row |
| Web | render, empty state, error+Reintentar, chips, visibility-gated refresh, form, delete confirm | Testing Library, mirror IndicatorsPage tests |

## Threat Matrix

N/A — additive REST routes follow the existing router/error-envelope pattern; no shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

Additive migration 004; runner unchanged (`scripts/migrate.ts` picks it up lexicographically). Rollback = revert commit (drop tab, routes, adapters, domain module; roll back migration). No feature flags.

## Open Questions

None.

## Work-Unit Sketch (≤400 changed lines, chained PRs)

- WU1: domain investments module + unit tests (split core vs service tests if >400)
- WU2: migration 004 + yahoo.ts + SQLite adapters + adapter tests
- WU3: portfolio routes + buildApp wiring + integration tests
- WU4: web tab + client + component tests

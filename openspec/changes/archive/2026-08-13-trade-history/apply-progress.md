# Apply Progress: trade-history

**Change**: trade-history — trades ledger with derived positions and realized P&L
**Mode**: Standard (STRICT TDD not active; test-first RED→GREEN applied for domain per tasks.md)
**Delivery**: feature-branch-chain, no push. Tracker branch `trade-history` accumulates all work units.
**Status**: ALL 22 tasks complete (WU1..WU5).

## Branches

| Branch | Role | Head | Merged into tracker |
|---|---|---|---|
| `trade-history` | tracker (from main d5cd351) | 5b43049 | — |
| `feat/trades-wu1` | WU1 domain | 646f19d | ff |
| `feat/trades-wu2` | WU2 migration + sqlite | 56e39f4 | ff |
| `feat/trades-wu3` | WU3 routes + integration | 4b069a8 | ff |
| `feat/trades-wu4` | WU4 web client + TradeForm | 97c7a6f | ff |
| `feat/trades-wu5` | WU5 page + removal | 5b43049 | ff |

Tracker extra commit: 88acc3a `fix(api): drop price_snapshots FK after positions become derived` (see Design Gaps).

## Work Units

### WU1 — Domain ledger (tasks 1.1–1.5) — 646f19d
- RED→GREEN: `packages/domain/tests/investments/trades.test.ts` (21 new tests): moving avg buy/sell/full-sale reset (TH-3), realized gain/loss/cumulative/avg-at-sell-time (TH-4), oversold-sell 422 naming trade, invalidating edit/delete naming dependent sell, same-day insertion order (TH-2), CRUD + normalization + 404 (TH-1), derived repo legacy id/name merge + no-fallback (PI-1, D2, D3).
- GREEN: `trades.ts` (TradeService: validate→normalize→timeline simulation→repo; `derivedPositionId` stable negative fnv1a hash), `derived-repo.ts` (DerivedPositionRepository), `types.ts` (Trade/TradeInput/RealizedTotals, `PositionView.realizedUsdMinor`, `totals.realizedUsdMinor`), `ports.ts` (TradeRepository, LegacyPositionPort, RealizedLedgerPort; PositionRepository slimmed to list()+findByTicker() — D9), `service.ts` (PortfolioService merges realized per asset + total), `index.ts` exports.
- Evidence: `npm test -w packages/domain` → 189 passed (168 baseline + 21 new); `npm run typecheck -w packages/domain` → 0 errors. Runtime harness: N/A (pure domain). Rollback boundary: rm trades/derived-repo.ts; revert types/ports/service/index.ts + tests.

### WU2 — Migration 006 + sqlite repos (tasks 2.1–2.3) — 56e39f4
- `db/migrations/006_trades.sql`: trades table + CHECKs + `idx_trades_ticker_date`; idempotent seed (positions → BUY at date('now'), avg_cost_minor); ALSO rebuilds price_snapshots without the positions FK (see Design Gaps — needed for new-ticker refresh, PI-3).
- `apps/api/src/sqlite/trades-repo.ts`: SqliteTradeRepository (ORDER BY trade_date, id — D7), SqliteLegacyPositionRepository (D2).
- `apps/api/tests/trades-repo.test.ts` (4 tests): CRUD + ordering; staged-005 DB → migrate applies 006 once → one BUY per position dated today; seed rows editable via repo; second migrate → [] (no duplicates).
- Evidence: `npm test -w apps/api -- trades-repo` → 4 passed; `npm run migrate` ×2 on real finanzas.db → applied 006 once, second run "No pending migrations"; DB shows 2 positions → 2 seed trades, re-run adds none. Rollback boundary: drop 006; rm sqlite/trades-repo.ts + test.
- TRANSIENT (expected, resolved in WU3): full api suite had 6 failing old portfolio tests + 4 typecheck errors while routes still targeted raw positions — feature-branch-chain intermediates per tasks.md chain note.

### WU3 — Routes + integration (tasks 3.1–3.6) — 4b069a8
- helpers.ts: `seedTrade` (POST through full TradeService path) + `seedLegacyPosition` (production-parity id/name merge).
- `trades.test.ts` (10 tests): 201 + normalization, 422 matrix (type/qty/price/currency/date — nothing persisted), 404 unknown ids, PUT full-replace + timeline revalidation, oversold 422 naming trade, invalidating edit/delete 422 naming dependent sell (with id), ordering by date+id.
- `portfolio.test.ts` rewritten (13 tests): derived read with legacy id/name preserved + derived negative id, fully-sold ticker disappears/reappears, realized loss negative per asset + total, trade change recomputes without refetch, removed POST/PATCH/DELETE positions → 404 (D5), fresh/stale/absent + CCL degradation (PI-3/PI-4), refresh mixed results + snapshot caching for legacy-less tickers (PI-5).
- `history.test.ts`: fixtures seed BUY trades + legacy rows via helpers; stub ticker branches and cache keys use AAPL.BA; ALL behavioral assertions unchanged (points, counts, degraded, 404) — TH-7.
- GREEN: `routes/portfolio.ts` (trades CRUD, mutations removed, chart routes untouched), `app.ts` (TradeService + DerivedPositionRepository wired to PortfolioService `ledger` and ChartService positions).
- Evidence: `npm test -w apps/api` → 145 passed; `npm run typecheck -w apps/api` → 0 errors. Rollback boundary: revert portfolio.ts + app.ts + tests.

### WU4 — Web client + TradeForm (tasks 4.1–4.3) — 97c7a6f
- `types.ts`: Trade/TradeInput, realizedUsdMinor on views + totals. `api.ts`: listTrades/createTrade/updateTrade/deleteTrade + `translateTradeDetail` (dynamic timeline detail → es-AR).
- `TradeForm.tsx`: type/ticker/date/quantity/price USD, es-AR parse + validation, edit prefills, es-AR rejected-sell message.
- `TradeForm.test.tsx` (7 tests): submit payload, decimal-comma parse, es-AR validation, rejected-sell translation, edit prefill/PUT/cancel.
- Evidence: `npm test -w apps/web` → 128 passed; `npm run typecheck -w apps/web` → 0 errors (fixtures in App.test.tsx / InvestmentsPage.test.tsx patched with realizedUsdMinor). Runtime harness: N/A (form covered by component tests). Rollback boundary: rm TradeForm.tsx + test; revert api.ts/types.ts.

### WU5 — Page + verification (tasks 5.1–5.5) — 5b43049
- `InvestmentsPage.tsx`: trade ledger grouped per asset (date desc), TradeForm create/edit, inline delete confirms ("¿Borrar la operación?"), realized chips per asset + "Realizado" summary row (gain `badge ok`, loss `badge over` — D8), read-only positions table (no actions, colSpan 7), trades loading/error (Reintentar)/empty states.
- Deleted `PositionForm.tsx`; removed createPosition/updatePosition/deletePosition + Position/PositionEdit types.
- `InvestmentsPage.test.tsx` rewritten (17 tests): grouping date-desc, chips Ganancia/Pérdida, empty states, portfolio+trades error/retry, create/edit/delete flow, all chart + refresh tests preserved unchanged.
- Evidence: `npm test -w apps/web` → 130 passed; `npm run build -w apps/web` → ✓ built. Full `npm test` (workspaces) → domain 189 + api 145 + web 130 = **464 passed** (421 baseline + 43 new). Root typecheck → 0 errors.
- Dev smoke (local finanzas.db, port 3000): migrate idempotent → seeded trades NVDA.BA/GOOGL.BA; POST buy MELI.BA 2 @ 500 → 201; sell 1 @ 600 → 201; GET /portfolio totals.realizedUsdMinor = 10000, MELI realized 10000; invalid sell 5 → 422 `sell of 5 MELI.BA on 2026-08-14 exceeds balance 1; fix that sell first`; GET /portfolio/history?range=3m&currency=ARS → 200 with points; POST/DELETE /portfolio/positions → 404. Smoke trades deleted afterwards; DB restored to the 2 seed trades. finanzas.db NOT committed (gitignored).

## Design Gaps Found & Fixed

1. **price_snapshots FK** (fixed in 006, commit 88acc3a): the FK to positions(ticker) would reject snapshots for tickers bought after migration (no legacy row) and break refresh (PI-3). Rebuilt without the FK; cascade had no remaining caller (position mutations removed). Applied manually to the local finanzas.db (006 had already run there) — clean deployments get it via the migration.
2. **Position-history test ids**: with derived ids, legacy rows must use normalized tickers (AAPL.BA) for the id/name merge; fixtures updated accordingly (assertions unchanged).
3. None other. PUT over PATCH per D4 (spec TH-1 scenarios use PUT).

## Deviations from Design

- Only the price_snapshots rebuild (gap #1) goes beyond the literal design file list; everything else matches design.md decisions D1–D9.
- WU2's full-suite typecheck gate was satisfied at WU3 (chain intermediates per tasks.md chain note); documented above.

## Verification Summary

| Workspace | Tests | Typecheck | Build |
|---|---|---|---|
| packages/domain | 189 ✓ | 0 errors | — |
| apps/api | 145 ✓ | 0 errors | — |
| apps/web | 130 ✓ | 0 errors | ✓ |
| Total | 464 ✓ (421 baseline + 43) | 0 errors | ✓ |

## Blockers

None.

## Next

sdd-verify (orchestrator). No push performed; no PRs created; branches are local only.

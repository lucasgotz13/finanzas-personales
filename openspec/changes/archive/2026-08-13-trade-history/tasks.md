# Tasks: Trade History — derived positions from a trade ledger

Test-first for domain only (RED→GREEN); threat matrix all N/A (HTTP surface covered by integration tests).

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~1,550 (WU1 350 · WU2 250 · WU3 350 · WU4 250 · WU5 350) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR #1 → #2 → #3 → #4 → #5 (tracker) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

**Chain choice**: feature-branch-chain. WU3 removes position-mutation endpoints — stacked-to-main would ship a broken intermediate (old web client without position API), and the migration must land atomically with the API/web rewrite. Tracker branch integrates all slices; only the tracker merges to main (rollback: revert tracker merge + optional 007).

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| WU1 | Domain: TradeService + derived read model | PR #1 (base = tracker) | `npm test -w packages/domain` | N/A (pure domain) | rm investments/{trades,derived-repo}.ts; revert types/ports/service/index.ts |
| WU2 | Migration 006 + sqlite repos | PR #2 (base = PR #1) | `npm test -w apps/api && npm run migrate` | migrate ×2 → no duplicate seed | drop 006; rm sqlite/trades-repo.ts |
| WU3 | Routes: trades CRUD, derived positions, remove mutations | PR #3 (base = PR #2) | `npm test -w apps/api` | supertest + temp SQLite + helpers | revert portfolio.ts + app.ts |
| WU4 | Web api client + TradeForm | PR #4 (base = PR #3) | `npm test -w apps/web` | dev stack: form flow es-AR | rm TradeForm.tsx; revert api.ts/types.ts |
| WU5 | InvestmentsPage + tests, delete PositionForm | PR #5 (base = PR #4) | `npm test -w apps/web && npm run build -w apps/web` | dev: inversiones tab | revert InvestmentsPage; restore PositionForm |

## Phase 1: Domain ledger (WU1)

- [x] 1.1 RED: `packages/domain/tests/investments/trades.test.ts` — buys average, sell keeps avg, full-sale reset (TH-3); realized gain/loss/cumulative (TH-4); sell-over-balance 422 naming trade, invalidating edit/delete 422, same-day id order (TH-2)
- [x] 1.2 GREEN: `packages/domain/src/investments/types.ts` + `ports.ts` — Trade/TradeInput/RealizedTotals, TradeRepository, LegacyPositionPort; slim PositionRepository to list()+findByTicker() (TH-1, PI-1, D9)
- [x] 1.3 GREEN: `packages/domain/src/investments/trades.ts` — TradeService: CRUD, normalizeTicker (upper+.BA), timeline validation, moving avg, realizedTotals(), derivedPositions() with stable negative-hash id (TH-1..TH-4, D3)
- [x] 1.4 GREEN: `packages/domain/src/investments/derived-repo.ts` — DerivedPositionRepository (list/findByTicker), legacy id/name merge only, no fallback (PI-1, D2)
- [x] 1.5 Modify: `packages/domain/src/investments/service.ts` + `src/index.ts` — realizedUsdMinor in summary (TH-4, PI-4); export trades — `npm test -w packages/domain && npm run typecheck -w packages/domain`

## Phase 2: Migration + sqlite (WU2)

- [x] 2.1 Create: `db/migrations/006_trades.sql` — trades table, CHECKs, idx (ticker, trade_date, id), idempotent seed INSERT..SELECT from positions (TH-5) — `npm run migrate` ×2
- [x] 2.2 GREEN: `apps/api/src/sqlite/trades-repo.ts` — SqliteTradeRepository (list ORDER BY trade_date, id; CRUD), SqliteLegacyPositionRepository (TH-1, D7)
- [x] 2.3 Create: `apps/api/tests/trades-repo.test.ts` — CRUD + ordering; migrate twice → no duplicates; seed rows editable (TH-5) — `npm test -w apps/api && npm run typecheck -w apps/api`

## Phase 3: Routes + integration (WU3)

- [x] 3.1 Modify: `apps/api/tests/helpers.ts` — fixtures seed trades via TradeService, not raw positions (TH-7, PI-1)
- [x] 3.2 RED: `apps/api/tests/trades.test.ts` — 201/422/404, normalization, timeline rejection naming trade, invalidating edit/delete (TH-1, TH-2)
- [x] 3.3 RED: `apps/api/tests/portfolio.test.ts` — derived read (id/name preserved, derived id), removed mutation endpoints → 404, realized totals incl. negative loss (PI-1, PI-4, TH-4)
- [x] 3.4 GREEN: `apps/api/src/http/routes/portfolio.ts` — trades CRUD routes; drop position mutations (404); realized in GET /portfolio (TH-1..TH-4, D5)
- [x] 3.5 Modify: `apps/api/src/http/app.ts` — wire TradeService + DerivedPositionRepository (PI-1) — `npm test -w apps/api && npm run typecheck -w apps/api`
- [x] 3.6 Modify: `apps/api/tests/history.test.ts` — seed BUY trades via helpers; assertions unchanged (TH-7, PC-1)

## Phase 4: Web client + TradeForm (WU4)

- [x] 4.1 Modify: `apps/web/src/{types,api}.ts` — Trade types, realizedUsdMinor, trade CRUD methods (TH-1, TH-4)
- [x] 4.2 Create: `apps/web/src/components/TradeForm.tsx` — type/ticker/date/qty/price USD, es-AR errors incl. rejected-sell message (TH-6)
- [x] 4.3 Create: `apps/web/src/components/__tests__/TradeForm.test.tsx` — es-AR validation, submit, rejected-sell feedback (TH-6) — `npm test -w apps/web`

## Phase 5: Page + verification (WU5)

- [x] 5.1 Modify: `apps/web/src/pages/InvestmentsPage.tsx` — trade list per asset (date desc), realized chips (badge ok/over), summary row, confirm flows, empty/error/Reintentar (TH-6, PI-6, D8)
- [x] 5.2 Delete: `apps/web/src/components/PositionForm.tsx` (PI-6)
- [x] 5.3 Modify: `apps/web/src/pages/__tests__/InvestmentsPage.test.tsx` — grouping, chips, empty/error, confirm (TH-6) — `npm test -w apps/web && npm run build -w apps/web`
- [x] 5.4 Full `npm test` via workspaces: 421 baseline + new, green (TH-7, PI-7)
- [x] 5.5 Dev smoke: migrate → api → web; trades CRUD, charts intact, removed endpoints 404 (TH-7)

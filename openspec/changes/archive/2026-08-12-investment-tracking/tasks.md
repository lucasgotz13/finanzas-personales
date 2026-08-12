# Tasks: Investment Tracking (CEDEARs & BYMA)

Test-first for domain only (standard mode, `strict_tdd: false`); threat matrix all N/A.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~1,650 (S1 200 · S2 300 · S3 400 · S4 350 · S5 420) |
| 400-line budget risk | High — S3/S5 borderline; trim tests if diff > 400 |
| Chained PRs recommended | Yes |
| Suggested split | PR #1 → PR #2 → PR #3 → PR #4 → PR #5 |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main (additive like dashboard; each slice suite-green on main in order) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| S1 | Domain foundation: types, TTL catalog, ticker normalize, ports, exports | PR #1 | `npm test -w packages/domain` | N/A (pure domain) | rm `packages/domain/src/investments/`, revert `index.ts` |
| S2 | PortfolioService: valuation, avg-cost P&L, CCL degrade, TTL/force, isolation | PR #2 | `npm test -w packages/domain` | N/A (pure domain) | rm `service.ts` + `service.test.ts` |
| S3 | Migration 004 + yahoo.ts + SQLite adapters + mocked-fetch tests | PR #3 | `npm test -w apps/api`; `npm run migrate` | migrate → finanzas.db applies 004 | drop 004, rm `sources/yahoo.ts`, `sqlite/{positions-repo,price-cache}.ts` |
| S4 | Portfolio routes + app wiring + integration tests | PR #4 | `npm test -w apps/api` | supertest, temp SQLite, stub source | rm `routes/portfolio.ts`, revert `app.ts` |
| S5 | Web: InvestmentsPage, PositionForm, tab, component tests | PR #5 | `npm test -w apps/web && npm run build -w apps/web` | dev: migrate → api → web, inversiones tab | rm page/component, revert `App.tsx`/`api.ts`/`types.ts` |

## Phase 1: Domain Foundation (S1)

- [x] 1.1 RED: `packages/domain/tests/investments/types.test.ts` — ticker uppercase + auto `.BA`; TTL catalog map (PI-1, PI-3)
- [x] 1.2 GREEN: `packages/domain/src/investments/types.ts` — Position, PriceSnapshot, PositionView, PortfolioSummary, RefreshResult, PriceStatus/CcStatus (PI-1, PI-4)
- [x] 1.3 GREEN: `packages/domain/src/investments/catalog.ts` — `PRICE_TTL_MS` ≈ 5 min; `normalizeTicker()` (PI-1, PI-3)
- [x] 1.4 GREEN: `packages/domain/src/investments/ports.ts` — PriceSource, PriceCache, PositionRepository, PortfolioFxPort (PI-2..PI-4)
- [x] 1.5 Modify: `packages/domain/src/index.ts` — export investments module (PI-7 additive) — `npm test -w packages/domain && npm run typecheck -w packages/domain`

## Phase 2: Domain Service (S2)

- [x] 2.1 RED: `packages/domain/tests/investments/service.test.ts` — fakes + FakeClock: USD/ARS valuation, avg-cost P&L + %, CCL stale/absent degradation, TTL cached/updated/forced, per-symbol failure isolation, snapshot-less '—' (PI-3, PI-4, PI-5)
- [x] 2.2 GREEN: `packages/domain/src/investments/service.ts` — `getPortfolio()` cache-only (never fetches); `refresh()` sequential per-symbol try/catch, finite check, TTL gate, force bypass (PI-3, PI-4, PI-5) — `npm test -w packages/domain && npm run typecheck -w packages/domain`

## Phase 3: Persistence + Yahoo (S3)

- [x] 3.1 Create: `db/migrations/004_investments.sql` — positions + price_snapshots (FK ON DELETE CASCADE, CHECKs, upsert) (PI-1, PI-3) — `npm run migrate` ×2 idempotent
- [x] 3.2 GREEN: `apps/api/src/sources/yahoo.ts` — v8 chart GET, finite `regularMarketPrice`, ARS→USD via CCL (CCL null → throw), 404/NaN/bad JSON → throw, 429 → 60 s per-ticker cooldown (PI-2)
- [x] 3.3 GREEN: `apps/api/src/sqlite/positions-repo.ts` — create/update/list/findByTicker/delete (PI-1)
- [x] 3.4 GREEN: `apps/api/src/sqlite/price-cache.ts` — get/set upsert, mirror indicator-cache.ts (PI-3)
- [x] 3.5 Create: `apps/api/tests/sources/yahoo.test.ts` — mocked fetch: ok USD, ARS+CCL, ARS w/o CCL → failed, 404, NaN, malformed, 429+cooldown second call (PI-2) — `npm test -w apps/api && npm run typecheck -w apps/api`

## Phase 4: API Wiring (S4)

- [x] 4.1 RED: `apps/api/tests/portfolio.test.ts` — supertest + temp SQLite + stub PriceSource + seeded usd-ccl: GET cache-first fresh/stale/absent (zero fetch), POST 201 auto `.BA` / 422 / 409, PATCH, hard DELETE, refresh mixed/TTL/force, error envelope (PI-1..PI-5)
- [x] 4.2 GREEN: `apps/api/src/http/routes/portfolio.ts` — GET `/api/v1/portfolio`, POST positions, PATCH|DELETE positions/:id, POST refresh?force (PI-1..PI-5)
- [x] 4.3 Modify: `apps/api/src/http/app.ts` — wire PortfolioService; CclAccessor wraps shared SqliteIndicatorCache (PI-4, PI-7) — `npm test -w apps/api && npm run typecheck -w apps/api`

## Phase 5: Web Tab (S5)

- [x] 5.1 Modify: `apps/web/src/types.ts`, `apps/web/src/api.ts` — portfolio types; getPortfolio(), create/update/deletePosition(), refreshPortfolio(force) (PI-6)
- [x] 5.2 GREEN: `apps/web/src/components/PositionForm.tsx` — ticker/quantity/avgCost fields, validation (PI-6)
- [x] 5.3 GREEN: `apps/web/src/pages/InvestmentsPage.tsx` — table + fresh|stale|absent chips, summary card (ARS big, USD secondary, P&L chip), green refresh, 5-min visibility-gated interval + force, loading/error + Reintentar, empty state, delete confirm (PI-5, PI-6)
- [x] 5.4 Modify: `apps/web/src/App.tsx` — Inversiones tab (PI-6)
- [x] 5.5 Create: `apps/web/src/pages/__tests__/InvestmentsPage.test.tsx` — render, empty state, error+Reintentar, chips, gated refresh, form, delete confirm (mirror IndicatorsPage tests) (PI-5, PI-6) — `npm test -w apps/web && npm run build -w apps/web`

## Phase 6: Verification (PI-7)

- [x] 6.1 Full `npm test` via workspaces (NOT root npx vitest — breaks jsdom config): 326 baseline + new, all green (PI-7)
- [x] 6.2 Dev smoke: migrate → api → web; inversiones tab renders + refresh; existing tabs 200 (PI-7)

Threat matrix: all rows N/A (additive REST following existing router/error-envelope pattern).

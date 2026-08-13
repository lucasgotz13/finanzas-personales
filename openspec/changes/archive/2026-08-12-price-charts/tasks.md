# Tasks: Price Charts

Test-first for domain only; threat matrix all N/A.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~1,500 (WU1 380 · WU2 360 · WU3 350 · WU4 410) |
| 400-line budget risk | High — WU1/WU4 borderline; trim tests if diff > 400 |
| Chained PRs recommended | Yes |
| Suggested split | PR #1 → PR #2 → PR #3 → PR #4 |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main (additive; each slice suite-green on main in order) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| WU1 | Domain priceCharts + unit tests + exports | PR #1 | `npm test -w packages/domain` | N/A (pure domain) | rm `packages/domain/src/priceCharts/`, revert `index.ts` |
| WU2 | Migration 005 + series-cache + both adapters + tests | PR #2 | `npm test -w apps/api`; `npm run migrate` | migrate → 005 applies idempotent | drop 005, rm `sqlite/series-cache.ts` + sources |
| WU3 | Routes + app wiring + integration tests | PR #3 | `npm test -w apps/api` | supertest + temp SQLite + stub sources | revert `portfolio.ts` + `app.ts` |
| WU4 | Web: api client, charts, warm-up, CSS, tests | PR #4 | `npm test -w apps/web && npm run build -w apps/web` | dev: migrate → api → web, inversiones tab | rm components, revert page/api/types/package.json |

## Phase 1: Domain priceCharts (WU1)

- [x] 1.1 RED: `packages/domain/tests/priceCharts/align.test.ts` — holiday absent-only (AAPL.BA), no zero-fill, first-point start (PC-2)
- [x] 1.2 RED: `packages/domain/tests/priceCharts/ccl.test.ts` — forward-fill ≤5d/drop older, pre-first-CCL drop, ARS/USD convert (PC-3)
- [x] 1.3 RED: `packages/domain/tests/priceCharts/service.test.ts` — fresh/stale/absent no-fetch, force, 404 exclude, degrade ARS→USD, asset-less days (PC-1..PC-3)
- [x] 1.4 GREEN: `packages/domain/src/priceCharts/{types,catalog,ports}.ts` — VOs (valueMinor, HistoryResponse), ranges 90/180/365, SERIES_TTL_MS 24h, FF_MAX_DAYS 5 (PC-1, PC-4)
- [x] 1.5 GREEN: `packages/domain/src/priceCharts/align.ts` — common-calendar alignment; absent dates stay absent (PC-2)
- [x] 1.6 GREEN: `packages/domain/src/priceCharts/ccl.ts` — per-point CCL(t) conversion, round once → valueMinor (PC-3, D8)
- [x] 1.7 GREEN: `packages/domain/src/priceCharts/service.ts` — ChartService, cache-first/force, Σ qty×close(t), status+degraded (PC-1..PC-4)
- [x] 1.8 Modify: `packages/domain/src/index.ts` — export priceCharts (PC-7) — `npm test -w packages/domain && npm run typecheck -w packages/domain`

## Phase 2: Migration + Adapters (WU2)

- [x] 2.1 Create: `db/migrations/005_price_series.sql` — series_cache (ticker/range/native_currency, JSON points, fetched_at; upsert) (PC-4) — `npm run migrate` ×2
- [x] 2.2 GREEN: `apps/api/src/sqlite/series-cache.ts` — get/set, 24h TTL, price-cache.ts pattern (PC-4)
- [x] 2.3 GREEN: `apps/api/src/sources/yahoo-series.ts` — v8 chart range, `quote[0].close`, null/NaN skip, 404 throw, 429 → 60s cooldown (PC-2, PC-4)
- [x] 2.4 GREEN: `apps/api/src/sources/argentinadatos-ccl.ts` — `contadoconliqui` venta daily series (PC-3)
- [x] 2.5 Create: `apps/api/tests/sources/{yahoo-series,argentinadatos-ccl}.test.ts` — mocked fetch: ok, null/NaN, 404, 429 cooldown, partial venta parse (PC-2, PC-3) — `npm test -w apps/api && npm run typecheck -w apps/api`

## Phase 3: Routes + Integration (WU3)

- [x] 3.1 Modify: `apps/api/tests/helpers.ts` — stub series/ccl sources + seeded cache fixtures (PC-1)
- [x] 3.2 RED: `apps/api/tests/history.test.ts` — 422/404, cache-first no-fetch spy, force, stale-keep, degraded, statuses (PC-1..PC-4)
- [x] 3.3 GREEN: `apps/api/src/http/routes/portfolio.ts` — GET /history + /positions/:id/history, parseRange/parseCurrency → 422, wrap() (PC-1)
- [x] 3.4 Modify: `apps/api/src/http/app.ts` — wire ChartService, AppDeps stub-injectable (PC-7) — `npm test -w apps/api && npm run typecheck -w apps/api`

## Phase 4: Web (WU4)

- [x] 4.1 Modify: `apps/web/src/{types,api}.ts` — HistoryResponse types; getPortfolioHistory/getPositionHistory(force) (PC-1, PC-5)
- [x] 4.2 GREEN: `apps/web/src/components/PortfolioChart.tsx` — chips 3m/6m/1y, ARS/USD toggle, ink line, es-AR tabular tooltip, honesty note, loading/error/Reintentar/empty (PC-5, PC-6)
- [x] 4.3 GREEN: `apps/web/src/components/AssetChart.tsx` — inline expand below row, one open at a time, empty state (PC-2, PC-5)
- [x] 4.4 Modify: `apps/web/src/pages/InvestmentsPage.tsx` — chart card top, row tap expand, lazy recharts, warm-up force on open/visibilitychange, bounded per range (PC-1, PC-4, PC-5)
- [x] 4.5 Modify: `apps/web/src/index.css` + `apps/web/package.json` — world-token chart styles; recharts dep (PC-5)
- [x] 4.6 Create: `apps/web/src/pages/__tests__/InvestmentsPage.test.tsx` — ink render, "1.584,93" tooltip, chips/toggle, note visible, states, expand (PC-5, PC-6) — `npm test -w apps/web && npm run build -w apps/web`

## Phase 5: Verification (PC-7)

- [x] 5.1 Full `npm test` via workspaces (NOT root npx vitest — breaks jsdom): 365 baseline + new, all green (PC-7)
- [x] 5.2 Dev smoke: migrate → api → web; charts render + warm-up; existing tabs 200 (PC-7)

Threat matrix: all rows N/A (additive REST/web; no shell/git/docs automation).

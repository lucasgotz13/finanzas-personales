# Apply Progress: price-charts

**Executor**: substitute sdd-apply agent (prior executor returned empty results twice — verified no branches/code; this is a full implementation from scratch).
**Mode**: Standard (strict_tdd: false). Test-first (RED → GREEN) applied to domain tasks 1.1–1.3 and integration task 3.2.
**Delivery**: chained PRs, stacked-to-main — LOCAL branches `feat/charts-s1..s4`, each stacked on the previous. NOT pushed; NO PRs created (orchestrator handles delivery).

## Work Units Completed

### WU1 — Domain priceCharts module (branch `feat/charts-s1`)

| Commit | Content |
|---|---|
| `f1e82f8` | `feat(charts): add price chart domain types, catalog and ports` — types.ts, catalog.ts (SERIES_TTL_MS 24h, FF_MAX_DAYS 5, RANGE_WINDOW_DAYS 90/180/365), ports.ts |
| `60f8cdb` | `feat(charts): align price series to the common calendar without zero-fill` — align.test.ts (RED) + align.ts (GREEN) |
| `455ee4d` | `feat(charts): convert series via CCL with 5-day forward-fill` — ccl.test.ts (RED) + ccl.ts (GREEN) |
| `11b70ad` | `feat(charts): add chart service with cache-first reads and forced refresh` — service.test.ts (RED) + service.ts (GREEN) |
| `6e42062` | `feat(charts): export the price chart domain API` — index.ts |

- Focused test: `npm test -w packages/domain` → 18 files / **168 passed** (baseline 143 + 25 new). Typecheck clean.
- Runtime harness: N/A — pure domain module, no runtime boundary.
- Rollback: `rm -r packages/domain/src/priceCharts packages/domain/tests/priceCharts` + revert `packages/domain/src/index.ts`.
- RED evidence: align.test.ts → "Cannot find module priceCharts/align"; ccl.test.ts → same for ccl; service.test.ts → same for service; history.test.ts (WU3) → 8/9 failing (routes absent).

### WU2 — Migration + adapters (branch `feat/charts-s2`, from s1)

| Commit | Content |
|---|---|
| `d91abb6` | `feat(charts): add series_cache table for daily chart series` — db/migrations/005_price_series.sql; `npm run migrate` ×2 idempotent (temp DB) |
| `7089cbf` | `feat(charts): add SQLite series cache adapter` — apps/api/src/sqlite/series-cache.ts (price-cache.ts pattern, upsert) |
| `f95f9e8` | `feat(charts): fetch Yahoo v8 daily series per range` — yahoo-series.ts ('3m'→'3mo' Yahoo param mapping, quote[0].close, null/NaN skip, 404 throw, 429 60s cooldown) |
| `d6d736e` | `feat(charts): fetch argentinadatos CCL venta series` — argentinadatos-ccl.ts |
| `d707a5d` | `test(charts): cover Yahoo series and CCL source adapters` — 11 tests |

- Focused test: `npm test -w apps/api` → 12 files / **131 passed** (baseline 111 + 20 new). Typecheck clean.
- Runtime harness: `npm run migrate` (temp DB) — applied 005 once, second run idempotent.
- Rollback: drop `db/migrations/005_price_series.sql`, `apps/api/src/sqlite/series-cache.ts`, `apps/api/src/sources/{yahoo-series,argentinadatos-ccl}.ts` + their tests.

### WU3 — Routes + integration (branch `feat/charts-s3`, from s2)

| Commit | Content |
|---|---|
| `718485a` | `feat(charts): wire chart service and add history routes` — portfolio.ts (GET /history, GET /positions/:id/history, parseRange/parseSeriesCurrency → 422), app.ts (ChartService wiring, AppDeps seriesSource/cclSource stub-injectable), helpers.ts (StubSeriesSource, StubCclSource, seedSeriesRow, seedCclRow) |
| `01cb50c` | `test(charts): cover history endpoints with cache-first integration tests` — history.test.ts, 9 tests (RED: 8/9 failing before routes) |

- Focused test: `npm test -w apps/api` → 12 files / **131 passed**. Typecheck clean.
- Runtime harness: supertest + temp SQLite + stub sources (the integration suite itself is the runtime path).
- Rollback: revert `portfolio.ts` + `app.ts` + `helpers.ts`, delete `history.test.ts`.

### WU4 — Web (branch `feat/charts-s4`, from s3)

| Commit | Content |
|---|---|
| `2d76f85` | `feat(charts): add history API client types and calls` — types.ts, api.ts |
| `1c2a5f7` | `feat(charts): add series chart components with world tokens` — SeriesChart.tsx, PortfolioChart.tsx, AssetChart.tsx, index.css, package.json + lock (recharts ^2.15.4; 368 lock lines are generated) |
| `e6d00f9` | `feat(charts): wire chart cards and cache warm-up into Inversiones` — InvestmentsPage.tsx (lazy charts, row-tap expand one-at-a-time, warm-up force per range on open/visibilitychange→visible) |
| `aada0b2` | `test(charts): cover chart rendering, toggles and warm-up` — setup.ts ResizeObserver mock (fixed 600×220 box so charts render in jsdom) + InvestmentsPage.test.tsx +8 tests |

- Focused test: `npm test -w apps/web` → 12 files / **119 passed** (baseline 111 + 8 new). `npm run build -w apps/web` → build ok; recharts isolated in a lazy chunk (`SeriesChart-*.js` 394 KB raw / 108 KB gz — loaded only when Inversiones opens).
- Runtime harness: dev smoke (below).
- Rollback: rm `SeriesChart.tsx`/`PortfolioChart.tsx`/`AssetChart.tsx`, revert `InvestmentsPage.tsx`, `index.css`, `package.json`, `types.ts`, `api.ts`, `setup.ts`, `InvestmentsPage.test.tsx`.

## Phase 5 Verification

- `npm test` (workspaces, NOT root vitest) → domain 168 + api 131 + web 119 = **418 passed** (365 baseline + 53 new), zero failures.
- `npm run typecheck` → clean in all three workspaces.
- `npm run build -w apps/web` → success.
- Dev smoke (real DB `finanzas.db`, migration applied twice — idempotent; DB not committed):
  - GET /api/v1/portfolio → 200 (existing capability intact).
  - GET /api/v1/portfolio/history?range=3m&currency=ARS → 200 `{points:[], status:"absent"}` (cache-first, no fetch on cold cache).
  - Same with `force=true` → 200 `status:"fresh"`, 64 real points, ARS (live Yahoo series + argentinadatos CCL).
  - GET /portfolio/positions/5/history → 200 with points; /positions/999/history → 404; range=1w → 422; currency=EUR → 422.
  - GET /api/v1/indicators → 200 (zero regression).
  - dev:web serves (HTTP 200, title OK); browser rendering covered by jsdom tests (no browser automation available in this environment).
  - Servers killed after smoke.

## Branch List

- `feat/charts-s1` (WU1) → `feat/charts-s2` (WU2) → `feat/charts-s3` (WU3) → `feat/charts-s4` (WU4, HEAD). All LOCAL, stacked on `main` (10b13bf), never pushed.

## Deviations from Design

1. `SeriesCache` uses a discriminated union (`kind: 'series' | 'ccl'`) instead of a single `SeriesSnapshot` shape, so CCL rows store REAL rates (`CclPoint[]`), not minor units (D8). Migration stores `kind` + JSON `points_json` accordingly.
2. Cache-first policy keeps the `stale` status when a forced refresh fails even on rows still within TTL; domain `SERIES_TTL_MS` (24h) enforced in `ChartService.statusOf`, not in the SQLite adapter (adapter is a dumb store, like price-cache.ts).
3. recharts 2.15.4 (not 3.x): React 18 peer support and deterministic jsdom rendering; actual chunk is ~108 KB gz (proposal estimated 30–40 KB gz) — accepted per proposal risk table, lazy-loaded on the Inversiones tab.
4. WU1 total is 846 authored lines (5 commits) — above the 400-line budget forecast (380). Each commit is independently reviewable; recommend size:exception acceptance or per-commit review for the chain.

## Issues Found

None blocking. Resolved during apply: (a) Yahoo v8 does not accept `range=3m` — adapter maps `3m→3mo`, `6m→6mo`, `1y→1y`; (b) es-AR Intl currency uses a non-breaking space after the symbol (tests assert `$\u00A0`); (c) recharts needs a ResizeObserver mock in jsdom, added to setup.ts.

## Task Checklist State

All 24 tasks marked `[x]` in `openspec/changes/price-charts/tasks.md` (phases 1–5).

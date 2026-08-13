```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:35ffd0842d7676d0ba2b4f84de727501ec995025a06c64d829c39b1f320feb6d
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 10/10
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:19eb7476079979fb60073387ecb1c3b6cc6820aaa198158f224ba3dd9d628339
build_command: npm run typecheck && npm run build -w apps/web
build_exit_code: 0
build_output_hash: sha256:e1758e0e87dc3dc5d6f6290bb1828599bbddfa9cf98fb423b8b2033b4f52fe8b
```

## Verification Report

**Change**: price-charts
**Version**: N/A (delta spec without version header)
**Mode**: Standard (strict_tdd: false)
**Date**: 2026-08-12
**Evidence basis**: independent test execution (workspace suites, never root npx vitest), typecheck, web production build, baseline suite execution at the pre-change commit (`10b13bf`), and 34 independent behavioral spot-checks against the full stack (temp SQLite + stub sources + live HTTP). `evidence_revision` = sha256 over the concatenation of the exact test output, build output, and spot-check output files.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 24 |
| Tasks complete | 24 |
| Tasks incomplete | 0 |
| Artifacts present | proposal, design, specs, tasks, apply-progress |

### Build & Tests Execution

**Build**: ✅ Passed — `npm run typecheck` (domain, api, web; exit 0) + `npm run build -w apps/web` (vite 7.3.6, 688 modules; exit 0). recharts isolated in lazy chunk `SeriesChart-*.js` (394.31 kB raw / 108.31 kB gz) — matches the accepted 108 KB gz deviation, loaded only when Inversiones opens.

**Tests**: ✅ 421 passed / ❌ 0 failed / ⚠️ 0 skipped — `npm test` via workspaces, exit 0.

```text
> npm test --workspaces --if-present
@finanzas/domain  vitest run → 18 files, 168 tests passed
@finanzas/api     vitest run → 12 files, 131 tests passed
@finanzas/web     vitest run → 12 files, 122 tests passed
Total: 421 passed (168 + 131 + 122), exit 0
```

**Baseline consistency (PC-7)**: independent execution of `npm test` at the pre-change commit `10b13bf` (temp worktree) → domain 143 + api 111 + web 111 = **365 passed, exit 0** — exactly the declared 365 baseline. All 365 baseline tests remain inside the current 421. Delta: +56 new tests (domain +25, api +20, web +11).

**Coverage**: ➖ Not available (no coverage tooling configured in this repo).

**Independent spot-checks**: ✅ 34/34 passed — live HTTP against `buildApp()` on a fresh temp SQLite DB with counting stub sources: migration 005 applies cleanly; cache miss → 200 `{points:[], status:"absent"}` with ZERO source calls; invalid range/currency variants → 422 (4 cases); unknown position → 404; `force=true` fetches each series exactly once + CCL once, status fresh; ARS aggregate = USD×CCL(t) with weekend forward-fill and ARS-native unchanged; USD aggregate = ARS÷CCL(t) with USD-native unchanged; all wire `valueMinor` integers; subsequent read cache-first with zero new source calls; rows > 24h serve stale without fetching; failed forced refresh keeps last cached series as stale; CCL down → 200 USD-only with `degraded:true`, never 5xx; per-asset endpoint converts and returns absent on other-range miss; 7 existing endpoints still 200; YahooSeriesSource 429 arms a 60s cooldown (second call throws without re-fetching).

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| PC-1 | Aggregate and per-asset | `apps/api/tests/history.test.ts > serves the fresh cached ARS aggregate with zero source calls` + `returns status absent with empty points on a cache miss, without fetching` + `rejects invalid range and currency with 422` + `serves one asset series converted to the requested currency` + `returns 404 for an unknown position id`; spot-checks 1–10, 17–18 | ✅ COMPLIANT |
| PC-2 | Holiday misalignment | `packages/domain/tests/priceCharts/align.test.ts > keeps a BYMA holiday absent for AAPL.BA only, present in the common calendar` + `never zero-fills a missing date` | ✅ COMPLIANT |
| PC-2 | Null close / missing series | `align.test.ts > drops points outside the range window` + `lets a newly listed asset start at its first point`; `service.test.ts > excludes a 404 asset and drops days only it had`; `apps/api/tests/sources/yahoo-series.test.ts > skips null and NaN closes, keeping their dates absent` + `throws on HTTP 404` | ✅ COMPLIANT |
| PC-3 | Forward-fill | `packages/domain/tests/priceCharts/ccl.test.ts > forward-fills a weekend date with the last known CCL` + `fills up to 5 calendar days and drops older dates (D4 bound)` + `returns null for dates before the first known CCL` + `multiplies USD-native values by CCL(t)...` + `divides ARS-native values by CCL(t)...`; integration weekend FF spot-checks 12–14 | ✅ COMPLIANT |
| PC-3 | Source down | `service.test.ts > degrades ARS to USD-only with degraded:true when CCL is unavailable`; `history.test.ts > degrades ARS to USD-only with degraded:true when CCL is unavailable (PC-3)`; spot-checks 22–24 | ✅ COMPLIANT |
| PC-4 | Failure keeps cache | `service.test.ts > keeps the last cached series as stale when a forced refresh fails (PC-4)`; `history.test.ts > keeps the last cached series as stale when a forced refresh fails (PC-4)`; spot-checks 19–21, 34 (429 cooldown) | ✅ COMPLIANT |
| PC-5 | Render and toggle | `apps/web/src/pages/__tests__/InvestmentsPage.test.tsx > renders the portfolio chart with an ink data line and the always-visible honesty note` + `shows es-AR tabular values in the chart tooltip` + `formats es-AR currency figures with thousands separators` + `re-fetches when a range chip or the currency toggle changes` | ✅ COMPLIANT |
| PC-5 | Empty and error states | `InvestmentsPage.test.tsx > shows the empty state when there are no points` + `shows a chart error with Reintentar that reloads` + `expands one inline asset chart per tapped row, swapping on the next tap` | ✅ COMPLIANT |
| PC-6 | Note visibility | `InvestmentsPage.test.tsx > renders the portfolio chart with an ink data line and the always-visible honesty note` (`chart-honesty-note` = "Valores con cantidades actuales", no interaction required) | ✅ COMPLIANT |
| PC-7 | Existing suite unchanged | full `npm test` 421 green; baseline suite at `10b13bf` → 365 green, unchanged; spot-checks 25–31 (7 existing endpoints 200); additive-only routes under `/api/v1/portfolio/history` | ✅ COMPLIANT |

**Compliance summary**: 10/10 scenarios compliant, all backed by tests that passed at runtime plus independent spot-checks.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| PC-1 Series retrieval | ✅ Implemented | `portfolio.ts` GET `/portfolio/history` + `/portfolio/positions/:id/history`; `parseRange`/`parseSeriesCurrency` → 422 via `ValidationError`; unknown position → `NotFoundError` 404; `HistoryResponse` `{points, currency, range, status: fresh|stale|absent}`; `service.ts` reads never fetch (`!force` branch), `force=true` is the only fetch trigger |
| PC-2 Alignment and null safety | ✅ Implemented | `align.ts` common-calendar via `daysSinceEpoch`; absent dates stay absent (no zero-fill); window `[today−windowDays+1, today]`; `yahoo-series.ts` skips null/NaN/≤0 closes; 404 throws → domain skips asset, day kept via remaining assets (D5) |
| PC-3 CCL conversion | ✅ Implemented | `ccl.ts` `CclLookup` exact-date then forward-fill ≤ `FF_MAX_DAYS` (5) calendar days, pre-first-CCL → null (dropped); USD×CCL for ARS target, ARS÷CCL for USD target, `Math.round` once per point (D8); `argentinadatos-ccl.ts` keeps `venta` REAL rates; degradation: CCL missing → `currency` reflects served series + `degraded:true`, always 200 |
| PC-4 Series caching | ✅ Implemented | migration 005 `series_cache` one row per `(ticker, range)` keyed `series:{ticker}:{range}` + CCL rows `ccl:{range}`; `SERIES_TTL_MS = 24h` enforced in domain `statusOf`; `SqliteSeriesCache` upserts `ON CONFLICT(key)`; forced fetches sequential per position; failed fetch keeps last cached row served `stale`; 429 → 60s per-ticker cooldown |
| PC-5 Charts UI | ✅ Implemented | `PortfolioChart` card top of Inversiones: 3m/6m/1y chips, ARS/USD toggle, `SeriesChart` ink `#1a1815` line, hairline axes/grid, muted ticks, es-AR tabular tooltip ("1.584,93"), loading/error("Reintentar")/empty states; `AssetChart` inline expand below tapped row, one open at a time |
| PC-6 Honesty | ✅ Implemented | "Valores con cantidades actuales" permanently rendered on the card header, no interaction needed; copy makes no holdings/performance claims; degraded responses show "Cotización CCL no disponible — mostrando {currency}" |
| PC-7 Zero regression | ✅ Implemented | additive-only: new domain module + exports, migration 005, new sources/cache, two new routes on the existing router, additive web components; baseline 365 verified green at `10b13bf`; existing endpoints 200 in spot-checks |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 Cache stores native series; conversion at read | ✅ Yes | `SeriesSnapshot.nativeCurrency`; `CclConverter` per asset per point |
| D2 No aggregate cache | ✅ Yes | aggregate computed per read from per-asset caches; keys only `series:{ticker}:{range}` + `ccl:{range}` |
| D3 Cache-first; miss → absent; force-only fetch; failed refresh keeps stale | ✅ Yes | `ChartService.loadSeries`/`loadCcl` implement exactly this |
| D4 Forward-fill bounded at 5 calendar days | ✅ Yes | `FF_MAX_DAYS = 5`; older dates dropped; pre-first-CCL dropped |
| D5 Aggregate sums only assets with a point that day; day dropped when none | ✅ Yes | `composeAggregate` sums with `any` flag; per-asset 404 excludes asset |
| D6 Inline per-asset expansion, one open at a time | ✅ Yes | `InvestmentsPage.expandedId` swap logic + test |
| D7 Degradation → 200, never an error | ✅ Yes | `currency` reflects returned series + `degraded:true` |
| D8 Minor units on the wire, CCL REAL, dates YYYY-MM-DD | ✅ Yes | `valueMinor` ints (round once); `CclPoint.value` real; UTC date slice |

Documented deviations from apply-progress are accepted and verified: (1) `SeriesSnapshot` discriminated union (`kind: 'series'|'ccl'`) with CCL rows storing REAL rates — matches D8; (2) TTL enforced in domain, SQLite adapter is a dumb store; (3) recharts 2.15.4 lazy chunk 108 KB gz — accepted per proposal risk table; (4) WU1 846 lines — `size:exception` approved.

### Issues Found

**CRITICAL**: None.

**WARNING**:

1. *Apply-progress drift on the fix commit*: `apply-progress.md` Phase 5 records 418 passed tests, but the USD-toggle fix commit `1284292` (merged via PR #71, +3 web tests) was never added to the progress file. Reality on main is 421 (verified). Process-artifact drift only — zero code impact; suggest a one-line apply-progress update during archive.

**SUGGESTION**:

1. *Toggle-time force on the charts*: `PortfolioChart`/`AssetChart` fire a `force=true` request the first time each (range, currency) pair is selected. The API contract stays intact (unforced reads never fetch), but the visible chart does not re-render from the forced result — on a cold cache after a failed warm-up, the first toggle shows "Sin datos históricos" until the user toggles again. Consider reloading the chart state when the forced call resolves, or relying solely on the warm-up.
2. *Warm-up upstream volume*: each warm-up (tab open / visibilitychange→visible) fires 6 forced requests (3 ranges × 2 currencies); each forces N sequential series fetches + 1 CCL fetch. With many positions that is up to 6×(N+1) upstream calls per visibility event. Bounded per range as designed, but worth a coalescing guard (e.g., skip pairs already fresh within TTL) before the position count grows.
3. *USD→ARS degradation path is a spec extension*: PC-3 mandates the ARS→USD degradation only; the service symmetrically degrades USD→ARS (serving ARS-native assets) when CCL is missing. Reasonable and never an error, but the delta spec does not state it — either document it in the spec during archive or restrict it.

### Accepted Items Verified

- **WU1 846 authored lines** vs the 400-line budget: `size:exception` approved by the orchestrator; each of the 5 commits is independently reviewable and fully test-covered.
- **recharts ~108 KB gz lazy chunk**: loaded only when Inversiones opens; main bundle unaffected (183.01 kB / 56.70 kB gz).
- **WU1/WU4 budget deviations**: forecasted high in tasks.md with chained PRs; delivered as 4 stacked PRs merged to main, each suite-green in order.

### Verdict

PASS WITH WARNINGS — 10/10 scenarios compliant with runtime-passing covering tests, 421/421 tests green, typecheck and build clean, 34/34 independent full-stack spot-checks passed, 365-test baseline independently re-verified green at the pre-change commit. Warnings are one process-artifact drift and non-blocking accepted deviations; no CRITICAL findings.

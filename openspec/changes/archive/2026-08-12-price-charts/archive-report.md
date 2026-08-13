# Archive Report: price-charts

**Change**: price-charts
**Capability**: price-charts (new — promoted to baseline spec)
**Archived**: 2026-08-12
**Status**: COMPLETE — PASS-WITH-WARNINGS (intentional-with-warnings: 2 accepted delivery deviations, 1 process-artifact warning recorded, 3 non-blocking suggestions, all user-approved; no CRITICAL findings)
**Archive type**: standard — no partial archive; no stale-checkbox reconciliation required (all task checkboxes `[x]` in the persisted tasks artifact)

## Review Gate State

Native review gate: **unmanaged/absent** — no `state.yaml`, review transaction, ledger, receipt, or gate context exists for this candidate; the orchestrator's structured status carries no `reviewGate` key and no `reviewOffer` acceptance. Per the archive gate contract, a structurally absent `reviewGate` proceeds under ordinary repository policy. Archive proceeds without a receipt.

## Change Summary

Portfolio-level and per-asset price charts in Inversiones: `GET /api/v1/portfolio/history` and `GET /api/v1/portfolio/positions/:id/history` (`range` ∈ 3m|6m|1y, `currency` ∈ ARS|USD, `force` bypass), daily-TTL `series_cache` (migration 005), Yahoo v8 series (close, not adjclose) and argentinadatos CCL `venta` adapters, CCL(t) conversion with ≤5-day forward-fill, cache-first reads that never fetch, ARS→USD-only degradation when CCL is unavailable (always 200, `degraded:true`), and a lazy-loaded recharts UI (ink line, es-AR tabular tooltip, permanent honesty note "Valores con cantidades actuales", chips/toggle/loading/error/empty states, inline per-asset expansion). ZERO changes to existing capabilities (PC-7, 365 baseline tests intact).

## Delivered Scope

- **Domain** (`packages/domain/src/priceCharts/`): VOs (`SeriesRange`, `SeriesCurrency`, `PricePoint`, `CclPoint`, `NativeSeries`, `HistoryResponse`), catalog (SERIES_TTL_MS 24h, FF_MAX_DAYS 5, RANGE_WINDOW_DAYS 90/180/365), ports (`PriceSeriesSource`, `CclSeriesSource`, `SeriesCache`), `align.ts` (common-calendar, no zero-fill, first-point start), `ccl.ts` (per-point CCL(t) conversion, round once → valueMinor), `service.ts` (`ChartService`: cache-first, `force` bypass, aggregate Σ qty×close(t), fresh/stale/absent, degraded), additive exports in `index.ts`.
- **API** (`apps/api/`): migration 005 (`series_cache`, one row per `(ticker, range)` + CCL rows `ccl:{range}`, JSON points + fetched_at); `sqlite/series-cache.ts` (dumb upsert store); `sources/yahoo-series.ts` (v8 chart range, `quote[0].close`, null/NaN skip, 404 throw, 429 → 60s cooldown); `sources/argentinadatos-ccl.ts` (`contadoconliqui` venta daily series); `http/routes/portfolio.ts` (`GET /history` + `GET /positions/:id/history`, `parseRange`/`parseSeriesCurrency` → 422, unknown position → 404, `wrap()`); `app.ts` wiring with stub-injectable `AppDeps`.
- **Web** (`apps/web/`): `SeriesChart`/`PortfolioChart`/`AssetChart` (recharts 2.15.4 lazy chunk, ink `#1a1815` line, hairline axes, es-AR tabular tooltip e.g. "1.584,93", permanent honesty note, loading/error "Reintentar"/empty states, 3m/6m/1y chips, ARS/USD toggle, inline expand one-at-a-time), `InvestmentsPage` wiring with bounded cache warm-up (`force=true` on tab open / `visibilitychange`→visible, per range), world-token chart CSS, `types.ts`/`api.ts` client, component tests.

## Verification Verdict

Per `verify-report` (observation #102; validated by `gentle-ai sdd-verify-validate`; evidence revision `sha256:35ffd0842d7676d0ba2b4f84de727501ec995025a06c64d829c39b1f320feb6d`, verdict `pass_with_warnings`, blockers 0, critical_findings 0):

- **7/7 requirements verified** (PC-1..PC-7); **10/10 scenarios COMPLIANT** with runtime-passing covering tests.
- **421/421 tests green at close** (domain 168, api 131, web 122), exit 0 — the final state on main includes the USD-toggle warm-up fix commit `1284292` (+3 web tests, merged via PR #71); `apply-progress.md` Phase 5 recorded 418 at its writing time (before that commit) — see Accepted Warnings 3.
- **Baseline zero-regression PROVEN by execution**: `npm test` at the pre-change commit `10b13bf` (temp worktree) → 365 passed, exit 0; all 365 remain inside the 421 (delta +56 new tests).
- **Build**: `npm run typecheck` (domain, api, web; exit 0) + `npm run build -w apps/web` (vite 7.3.6, 688 modules; exit 0) clean.
- **34/34 independent full-stack spot-checks passed** (temp SQLite + stub sources + live HTTP): migration 005 clean, cache-miss absent with zero source calls, 422/404, force fetches exactly once, ARS×CCL(t)/USD÷CCL(t) with weekend forward-fill, stale-keep on failed refresh, CCL-down → 200 USD-only degraded, 7 existing endpoints still 200, 429 cooldown armed.
- **Production verification at close**: `GET /api/v1/portfolio/history?range=3m&currency=USD` → 200, 63 points, `status:"fresh"`, `degraded:false`.
- **No CRITICAL findings.**

## Accepted Warnings and Deviations (user-approved, NOT remediated)

1. **WU1 846 authored lines** vs the 400-line review budget — `size:exception` approved by the orchestrator; each of the 5 commits is independently reviewable and fully test-covered.
2. **recharts 2.15.4 lazy chunk ≈ 108 KB gz** — accepted deviation from the proposal's 30–40 KB gz estimate; loaded only when Inversiones opens (main bundle unaffected: 183.01 kB raw / 56.70 kB gz). Verified in the production build (`SeriesChart-*.js` 394.31 kB raw / 108.31 kB gz).
3. **Process-artifact drift (verify WARNING 1)**: `apply-progress.md` Phase 5 records 418 tests and predates the USD-toggle fix commit `1284292` (merged via PR #71, +3 web tests). Final state on main is 421, verified. The archive was instructed to record the fix here rather than edit apply-progress; the archived apply-progress remains the historical snapshot it was at write time.
4. **3 non-blocking SUGGESTIONs from verify** (accepted, not implemented): (a) toggle-time force does not re-render the chart from the forced result on a cold cache after a failed warm-up — consider reloading chart state when the forced call resolves; (b) warm-up fires up to 6×(N+1) upstream calls per visibility event — consider a coalescing guard (skip pairs already fresh within TTL) before the position count grows; (c) the USD→ARS degradation path (serving ARS-native assets when CCL is missing) is implemented symmetrically but not stated in the delta spec — either document it in the spec or restrict it.

## Delivery State

- **PRs #68–#71 MERGED to main** (stacked-to-main chain WU1→WU4, additive, each slice suite-green in order); **issue #67 closed**. The USD-toggle warm-up fix `1284292` is part of the merged chain (PR #71). Local main synced and up to date with origin.
- Runtime ledger: apply attempt **settled passed** (maintainer-approved reset for the 2538-vs-1700 work-unit cap); verify attempt **settled complete**.
- Tasks artifact: **25/25 `[x]`** — zero unchecked implementation tasks (Phase 1: 8, Phase 2: 5, Phase 3: 4, Phase 4: 6, Phase 5: 2). Note: `verify-report.md` and the launch context declared "24 tasks"; the persisted artifact contains 25 completed checkboxes. All complete either way; the artifact count (25/25, 0 unchecked) is recorded here as authoritative for completion visibility.
- Spec synced to baseline: `openspec/specs/price-charts/spec.md` (created — no prior main spec existed; delta promoted byte-identical, verified by empty `diff -r`).

## Engram Traceability (observation IDs)

| Artifact | Observation ID |
|---|---|
| sdd/price-charts/explore | #94 |
| sdd/price-charts/proposal | #96 |
| sdd/price-charts/spec | #97 |
| sdd/price-charts/design | #98 |
| sdd/price-charts/tasks | #99 |
| sdd/price-charts/apply-progress | #100 |
| sdd/price-charts/verify-report | #102 |
| sdd/price-charts/archive-report (this report) | see Engram topic `sdd/price-charts/archive-report` |

## Next Steps

- Optional follow-ups (non-blocking SUGGESTIONs from verify): re-render chart state when a toggle-time forced call resolves; add a warm-up coalescing guard (skip already-fresh pairs within TTL); document the USD→ARS degradation path in the baseline spec if kept.
- Next change candidates: buy/sell transaction history and realized P&L, cripto/bonos/FCIs support (explicitly OUT of v1), broker import.

---

The SDD cycle for price-charts is complete: planned, implemented, verified (PASS-WITH-WARNINGS, no CRITICAL), and archived.

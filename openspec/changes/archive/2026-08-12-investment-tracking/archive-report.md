# Archive Report: investment-tracking

**Change**: investment-tracking
**Capability**: investment-tracking (new — promoted to baseline spec)
**Archived**: 2026-08-12
**Status**: COMPLETE — PASS-WITH-WARNINGS (intentional-with-warnings: 2 accepted warnings, user-approved; 1 accepted delivery deviation)
**Archive type**: standard — no partial archive; no stale-checkbox reconciliation required (22/22 tasks `[x]` in persisted tasks artifact)

## Review Gate State

Native review gate: **unmanaged** — no review transaction, ledger, receipt, or policy exists for this change (native `gentle-ai sdd-status` reports all review artifacts `missing`, `reviewOffer.available` but never started, kill switch off). Native dispatcher computed `archive: ready` with `nextRecommended: archive` and empty `blockedReasons`; this mirrors the argentina-dashboard precedent. Archive proceeds without a receipt.

## Change Summary

Portfolio valuation for CEDEARs and BYMA stocks: positions CRUD, Yahoo v8 price fetch with snapshot cache and TTL, USD-native valuation via CCL (dolarapi cache, read-only), avg-cost P&L, Inversiones web tab. Mirror of the economic-indicators pattern: cache-first reads, per-class TTL freshness, stale/absent degradation, visibility-gated auto-refresh. ZERO changes to existing capabilities (PI-7, 326 baseline tests intact).

## Delivered Scope

- **Domain** (`packages/domain/src/investments/`): types (`Position`, `PriceSnapshot`, `PositionView`, `PortfolioSummary`, `RefreshResult`), TTL catalog (`PRICE_TTL_MS` ≈ 5 min, `normalizeTicker()` uppercase + auto `.BA`), ports (`PriceSource`, `PriceCache`, `PositionRepository`, `PortfolioFxPort`), `PortfolioService` (cache-only `getPortfolio()`, sequential TTL-gated refresh with force bypass, per-symbol failure isolation, CCL stale/absent degradation, avg-cost P&L abs + %).
- **API** (`apps/api/`): migration 004 (`positions` + `price_snapshots`, FK ON DELETE CASCADE, CHECKs, upsert); `sources/yahoo.ts` (v8 chart, finite `regularMarketPrice`, ARS→USD via cached CCL, 429 → 60 s per-ticker cooldown); `sqlite/positions-repo.ts`, `sqlite/price-cache.ts`; `http/routes/portfolio.ts` (`GET /api/v1/portfolio` cache-first, POST 201/422/409, PATCH, hard DELETE, `POST /api/v1/portfolio/refresh?force`); `app.ts` wiring via `CclAccessor` over the shared `SqliteIndicatorCache`.
- **Web** (`apps/web/`): `InvestmentsPage` (money-first summary — ARS big, USD secondary, P&L chip; fresh/stale/absent chips; green refresh; 5-min visibility-gated auto-refresh; loading/error + Reintentar; empty state; delete confirm), `PositionForm` (es-AR parsing → USD cents), Inversiones tab, component tests.

## Verification Verdict

Per `verify-report` (validated by `gentle-ai sdd-verify-validate`; evidence revision `sha256:da9681c5a9dd1565172319c21e8bb6cb5d2c4fb8d8e23de04e21f738cbc462e6`, verdict `pass_with_warnings`, blockers 0, critical_findings 0):

- **7/7 requirements verified** (PI-1..PI-7); **15/15 scenarios COMPLIANT** (authoritative spec count — see warning 2).
- **364/364 tests green** (domain 143, api 111, web 110); baseline 326 intact (PI-7 zero regression); `npm run typecheck` + web build clean (vite 7.3.6, exit 0).
- **17/17 independent behavioral spot-checks passed** (normalization `aapl→AAPL.BA` 201, duplicate 409, 422s, cache-first GET with zero source calls, fresh/stale/absent, CCL stale→last-known + `ccStatus`, CCL absent→USD-only, mixed refresh `updated|cached|failed`, TTL gate, `force=true`, hard delete 204 + cascade) plus a live Yahoo v8 probe.
- Live conversion path proven: Yahoo v8 reports `meta.currency:"ARS"` for BYMA tickers; adapter converts via cached CCL (AAPL.BA ≈ 23,954 ARS → 17.81 USD @ CCL 1,345).
- Verified code state: `main @ 0dfce6f` (merge PRs #55–#59; slices S1–S5).
- **No CRITICAL findings.**

## Accepted Warnings (user-approved, NOT remediated)

1. **Yahoo USD-label residual data risk** — current live behavior is verified (BYMA quotes arrive labeled `ARS` and convert correctly via CCL). Residual risk: if Yahoo ever labels an ARS price as `"USD"`, the adapter stores it unconverted (ARS number as USD cents). Accepted in apply as a data-quality caveat; the conversion path is proven and tested. Evidence: `verify-report.md` WARNING 2; `yahoo.ts`; live probes.
2. **Scenario-count discrepancy (process-level)** — the orchestrator launch context declared 13 scenarios; the retrieved authoritative spec contains 7 requirements and 15 scenarios (PI-1 has 4; PI-2..PI-6 have 2 each; PI-7 has 1). Verification counted and validated against the authoritative 15. Reconciled here as **15**; zero code impact.

## Accepted Delivery Deviation

- **S5 slice = 506 changed lines** vs the 400-line review budget (`size:exception`, maintainer-approved). Slice scope (page + PositionForm + client + component tests) matches the design File Changes and is indivisible; the tasks forecast itself anticipated S5 ≈ 420, and further test cuts would remove spec-mandated scenarios (PI-5 visibility gate, PI-6 empty/error/form). Fully covered by tests.

## Delivery State

- **PRs #55–#59 MERGED** to main (stacked-to-main chain S1→S5, additive). **Issue #54 closed.** Local main synced and up to date with origin.
- Runtime ledger: apply attempt **settled complete**; verify attempt **settled complete**.
- Tasks artifact: **22/22 `[x]`** (Phase 1: 5, Phase 2: 2, Phase 3: 5, Phase 4: 3, Phase 5: 5, Phase 6: 2). Threat matrix all rows N/A.
- Spec synced to baseline: `openspec/specs/investment-tracking/spec.md` (created — no prior main spec existed; delta promoted byte-identical).

## Engram Traceability (observation IDs)

| Artifact | Observation ID |
|---|---|
| sdd/investment-tracking/explore | #80 |
| sdd/investment-tracking/proposal | #82 |
| sdd/investment-tracking/spec | #83 |
| sdd/investment-tracking/design | #84 |
| sdd/investment-tracking/tasks | #85 |
| sdd/investment-tracking/apply-progress | #86 |
| sdd/investment-tracking/verify-report | #88 |
| sdd/investment-tracking/archive-report (this report) | see Engram topic `sdd/investment-tracking/archive-report` |

## Next Steps

- Monitor the Yahoo currency-label risk when new BYMA tickers are added; a per-ticker currency whitelist in the adapter would close the residual gap if it ever materializes (verify-report WARNING 2).
- Optional follow-ups (non-blocking SUGGESTIONs from verify): by-id repository lookup for `PATCH /portfolio/positions/:id` (replaces O(n) `list().find`), sync design work-unit sketch wording (4 WUs) with tasks.md (5 slices).
- Next change candidates: buy/sell transaction history and realized P&L, cripto/bonos/FCIs support (explicitly OUT of v1), broker import, charts.

---

The SDD cycle for investment-tracking is complete: planned, implemented, verified (PASS-WITH-WARNINGS, no CRITICAL), and archived.

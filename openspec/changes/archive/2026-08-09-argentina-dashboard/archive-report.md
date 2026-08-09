# Archive Report: argentina-dashboard (economic-indicators)

**Change**: argentina-dashboard
**Capability**: economic-indicators (new — promoted to baseline spec)
**Archived**: 2026-08-09
**Status**: COMPLETE — PASS-WITH-WARNINGS (intentional-with-warnings: 2 accepted, user-approved)
**Archive type**: standard — no partial archive; no stale-checkbox reconciliation required (25/25 tasks `[x]` in persisted tasks artifact)

## Change Summary

One-tab daily snapshot of 9 Argentina economic indicators (USD blue/oficial/tarjeta/MEP/CCL, riesgo país, IPC mensual, reservas, BADLAR) served cache-first via REST (`GET /api/v1/indicators`, `POST /api/v1/indicators/refresh?force=`), with per-class TTL freshness (FX 5 min, BCRA/riesgo país 24 h, IPC 12 h), stale degradation (never a blank screen or 5xx), and a read-only web tab with auto-refresh and manual force refresh. Fully decoupled from the expense-tracker core (zero regression surface, EI-7).

## Delivered Scope

- **Domain** (`packages/domain/src/indicators/`): types, catalog (9 keys, units, class map, TTLs), ports (`IndicatorSource`, `IndicatorCache`), `IndicatorService` (cache-only GET, per-class try/catch refresh isolation, finite-value checks, TTL gate + force bypass); `vo/ar-tz.ts` (`arIsoString` → fixed `-03:00`).
- **API** (`apps/api/`): migration 003 (`indicator_snapshots`, upsert ON CONFLICT); 4 HTTP source adapters (dolarapi 5 FX/1 call, BCRA v4 Monetarias 1&7, datos.gob.ar IPC with `/search` drift resolution + retry-once, argentinadatos riesgo país); `SqliteIndicatorCache`; `http/routes/indicators.ts`; optional `indicatorSources` dep wiring.
- **Web** (`apps/web/`): `IndicatorsPage` (9 cards, 5-min non-forced auto-refresh while tab active, manual force refresh, loading/error/stale states), `IndicatorCard` (label, value, unit, relative updatedAt, stale badge), Indicators tab.
- IPC series ID resolved at implementation: `145.3_INGNACUAL_DICI_M_38` (overridable via `IPC_SERIES_ID`).

## Verification Verdict

Per `verify-report` (validated by `gentle-ai sdd-verify-validate`; evidence revision `sha256:b41d8164...450`, verdict `pass`, blockers 0, critical_findings 0):

- **7/7 requirements verified** (EI-1..EI-7); **23/23 scenarios COMPLIANT**.
- **221/221 tests green** (domain 121, api 79, web 21); baseline 167 intact (EI-7 zero regression); typecheck + web build clean; migration idempotent.
- **Live spot-checks passed** (2026-08-09 ~17:56–18:05 AR): TTL gate (`cached` on immediate re-refresh), `?force=true` bypass (4/4 `updated`), venta quotes cross-checked vs dolarapi.com (blue/oficial/tarjeta/MEP/CCL exact), `-03:00` timestamps, stale/absent semantics, zero external fetch on GET, existing routes 200.
- Verified code state: `main @ 5103aff` (merge PR #23; slices S1–S5 via PRs #19–#23).
- **No CRITICAL findings.**

## Accepted Warnings (user-approved, NOT remediated)

1. **IPC provider-side data lag** — datos.gob.ar `/series` serves data only through 2025-04 while its `/search` index claims the series extends to 2026-06 (~16 months behind the ≈6-week tolerance in EI-5). The adapter behaves as designed (serves latest available point, `status:"fresh"` reflects fetch time, not reference-date age). Monitoring recommended; possible future guard on reference-date age. Evidence: `apply-progress.md` deviation #3; `datos-gob-ar.ts:60-70`; live GET.
2. **BCRA v4 response shape pinned to live API** — design specified flat `{fecha, valor}` rows; the live v4.0 API nests daily points under `detalle` per variable. Implementation parses `detalle` and selects the newest point order-independently (commits `bcb00c4`, `0f3e231`). Documented and tested; does not break any spec scenario. Evidence: `bcra.ts:18-21, 55-63`; `verify-report` coherence row.

## Post-Apply Fix

- Commit `974cc65` `fix(web): add indicators tab styles` — styles for `.indicators-grid`/`.indicator-card`/`.stale-badge` were missing from the apply slice and were found by manual testing; fixed and delivered inside PR #23. Also included in PR #23: BCRA `detalle` shape fix (`bcb00c4`) and newest-point selection fix (`0f3e231`).

## Delivery State

- **PRs #19–#23 MERGED** to main (chained, stacked-to-main, ≤400-line slices; S3 accepted as `size:exception` at 539 lines — adapter scenario-test overage). Issue #18 closed. Local main synced and up to date with origin.
- Runtime ledger: apply attempt **passed** (maintainer-approved scope reset); verify attempt **settled complete**.
- Tasks artifact: **25/25 `[x]`** (Phase 1: 6, Phase 2: 2, Phase 3: 6, Phase 4: 4, Phase 5: 5, Phase 6: 2). Threat matrix all rows N/A.
- Spec synced to baseline: `openspec/specs/economic-indicators/spec.md` (created — no prior main spec existed; delta promoted verbatim).

## Engram Traceability (observation IDs)

| Artifact | Observation ID |
|---|---|
| sdd/argentina-dashboard/explore | #41 |
| sdd/argentina-dashboard/proposal | #43 |
| sdd/argentina-dashboard/spec | #44 |
| sdd/argentina-dashboard/design | #45 |
| sdd/argentina-dashboard/tasks | #46 |
| sdd/argentina-dashboard/apply-progress | #48 |
| sdd/argentina-dashboard/verify-report | #50 |
| sdd/argentina-dashboard/archive-report (this report) | see Engram topic `sdd/argentina-dashboard/archive-report` |

## Next Steps

- **W1 remediation from tracker**: expense-tracker PATCH silently inherits the rate — known accepted debt, remediate when the user wants.
- Monitor the IPC provider lag; consider a reference-date age guard if it persists (verify-report SUGGESTION 1).
- Optional follow-ups (non-blocking SUGGESTIONs): env-driven TTL overrides (`catalog.ts`), server-side IPC rounding for external API consumers.
- Next change candidates: historical series/charts (sources already expose history), alerts, multi-currency conversion.

---

The SDD cycle for argentina-dashboard is complete: planned, implemented, verified (PASS-WITH-WARNINGS, no CRITICAL), and archived.

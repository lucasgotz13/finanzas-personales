# Economic Indicators Specification

## Purpose

Read-only snapshot of 15 economic indicators in two display groups — Mercado (USD blue/oficial/tarjeta/MEP/CCL, riesgo país, reservas, BADLAR, Brent and WTI crude oil) and Economía argentina (IPC mensual, IPC interanual, Canasta Básica Total, salarios var. interanual, EMAE var. interanual) — served cache-first via REST with per-class TTL freshness, stale degradation, and a grouped card UI. Decoupled from the expense-tracker core.

## Requirements

### Requirement: EI-1 — Snapshot serving (cache-first)

`GET /api/v1/indicators` SHALL return 15 indicators as `{key, group, value, unit, referenceDate, updatedAt, stale, status, referenceAged, changePercent}` with `status` ∈ `fresh|stale|absent` and `group` ∈ `mercado|economia`. Keys, in stable order: `usd-blue`, `usd-oficial`, `usd-tarjeta`, `usd-mep`, `usd-ccl`, `riesgo-pais`, `reservas`, `badlar`, `brent`, `wti` (group `mercado`); `ipc-mensual`, `ipc-interanual`, `canasta-basica-total`, `salarios-variacion`, `emae-variacion` (group `economia`). FX value SHALL be the sell quote (`venta`); units: FX `ARS/USD`, riesgo país `pb`, IPC and the INDEC variation series `%` (signed), canasta `ARS`, reservas `millones USD`, BADLAR `% TNA`, Brent/WTI `USD/bbl` (raw dollars per barrel). GET SHALL be cache-first: it MUST NOT trigger an external fetch. `changePercent` SHALL be the signed percent change vs the previous published reading, derived as `(value - prevValue) / prevValue * 100`; it SHALL be `null` when `value` or `prevValue` is missing or `prevValue <= 0`, and always `null` for the variation keys `ipc-mensual`, `ipc-interanual`, `salarios-variacion` and `emae-variacion` (their value is already a percentage variation; a % change of a % is a second-order stat).

#### Scenario: Fresh cache

- GIVEN all 15 snapshots cached, age ≤ TTL, WHEN `GET /api/v1/indicators`, THEN 200 with 15 items `status:"fresh"`, `stale:false`, all fields set; no external request

#### Scenario: Empty cache (first run)

- GIVEN no snapshot rows, WHEN GET, THEN 200 with `value:null`, `status:"absent"`, `stale:false`, key+group+unit present; no external request

#### Scenario: Expired cache

- GIVEN age > TTL, no recent refresh, WHEN GET, THEN cached value with `status:"stale"`, `stale:true`, `updatedAt` = last successful fetch; no external request

### Requirement: EI-2 — Refresh

`POST /api/v1/indicators/refresh` SHALL fetch all 8 classes and respond `{results:[{class, status: updated|cached|failed, error?}]}`. Classes: `fx` (dolarapi, one call, 5 FX); `bcra` (BCRA v4 catalog+series, reservas, BADLAR); `ipc` (INDEC API-INDEC national general monthly + interannual variation, with the keyless argentinadatos `inflacion` series as monthly-only fallback); `riesgo-pais` (argentinadatos); `oil` (Yahoo v8 chart, Brent `BZ=F` and WTI `CL=F`); `indec-canastas` (INDEC CBA/CBT, GBA total basket per adult equivalent); `indec-salarios` (INDEC wage index, general level interannual variation); `indec-emae` (INDEC EMAE, original-series interannual variation). A source failure MUST NOT affect other classes (partial success). Zero/negative BCRA values SHALL be treated as failed. The oil fetch SHALL be all-or-nothing: any missing or invalid field on either symbol reports the class `failed` and keeps the prior snapshots. Before writing each snapshot the refresh SHALL resolve `prevValue` (the previous published reading): an adapter-supplied `prevValue` wins; otherwise the cached `value` is carried forward as `prevValue` when the cached `referenceDate` differs from the incoming sample, and a same-`referenceDate` refresh keeps the cached `prevValue` (no double-shift). Series sources SHALL set `prevValue` from the second-latest point by period (`null` when the series has one point) and SHALL reject empty, malformed, non-finite or invalid-period rows as `failed`; the oil source SHALL use the chart meta `previousClose`/`chartPreviousClose` when present; dolarapi supplies none and relies on carry-forward.

#### Scenario: Full success

- GIVEN all 8 sources reachable, WHEN refresh, THEN cache updated for all 15 with `fetched_at`; all classes report `updated`

#### Scenario: Source failure modes (timeout, HTTP 5xx, malformed JSON)

- GIVEN one source times out, returns 5xx, or unparseable JSON, WHEN refresh, THEN that class reports `failed` with error, its cache rows unchanged, other classes `updated`

#### Scenario: Partial success

- GIVEN dolarapi OK, BCRA down, WHEN refresh, THEN FX `updated`; reservas/BADLAR `failed`, prior cache kept

#### Scenario: All sources down

- GIVEN all 8 sources fail, WHEN refresh, THEN 200 with all classes `failed`; GET keeps serving cache

#### Scenario: Invalid BCRA values

- GIVEN reservas = 0 or negative, or negative BADLAR, WHEN refresh, THEN those indicators report `failed`; cache unchanged

#### Scenario: IPC source and fallback

- GIVEN INDEC IPC returns the national general monthly and interannual rows, WHEN refresh, THEN `ipc-mensual` and `ipc-interanual` take the latest period with the previous month as `prevValue`; GIVEN the INDEC request fails or `INDEC_API_TOKEN` is missing, THEN the class falls back to the argentinadatos monthly series and only `ipc-mensual` may update (freshness requires every key of a class, so a fallback-only refresh refetches the IPC class on each non-forced poll); GIVEN both fail, THEN the class reports `failed` with a combined error that never includes the token

#### Scenario: INDEC economy series

- GIVEN the INDEC canastas, salarios and EMAE endpoints return rows, WHEN refresh, THEN `canasta-basica-total` (GBA, CBT, pesos per adult equivalent), `salarios-variacion` (general level, interannual) and `emae-variacion` (original series, interannual) take the latest period with the previous month as `prevValue`; an INDEC failure in one of these classes reports only that class `failed`

### Requirement: EI-3 — TTL policy

TTLs: FX ≈ 5 min; oil ≈ 10 min (halves Yahoo calls behind the 5-min web poll); BCRA and riesgo país ≈ daily; IPC and the INDEC canastas/salarios/EMAE series ≈ 12 h. A non-forced refresh MUST NOT refetch a class with cache age ≤ TTL — it SHALL serve cache and report `cached`. `POST /api/v1/indicators/refresh?force=true` (manual, user-initiated) MUST bypass TTL and refetch all classes.

#### Scenario: Within TTL

- GIVEN FX cache age 2 min, BCRA age 10 h, WHEN refresh, THEN neither refetched; both report `cached`

#### Scenario: Past TTL

- GIVEN FX cache age 6 min, WHEN refresh, THEN FX refetched, reports `updated`

#### Scenario: Forced manual refresh

- GIVEN any cache age, WHEN `refresh?force=true`, THEN all classes refetched regardless of TTL

### Requirement: EI-4 — Stale fallback and absence

A value SHALL be `stale` when cached and age > TTL; `absent` when never fetched (`value:null`). GET MUST return 200 with stale/absent data — never a blank screen or 5xx.

#### Scenario: Stale serving

- GIVEN expired cache and last refresh failed, WHEN GET, THEN 200, `status:"stale"`, `stale:true`, `updatedAt` = last successful fetch

#### Scenario: Absent indicator

- GIVEN no cache row for `ipc-mensual`, WHEN GET, THEN `value:null`, `status:"absent"`

#### Scenario: First run with sources down

- GIVEN empty cache, all sources failing, WHEN refresh then GET, THEN 200, all items `absent`; no 5xx

### Requirement: EI-5 — Reference dates and timezone

`referenceDate` SHALL be the source's own date: INDEC series the reference month as `YYYY-MM` (e.g. `2026-06`; publish lag acceptable), FX the dolarapi `fechaActualizacion`, Brent/WTI the Yahoo `regularMarketTime` rendered as an AR-time instant. All timestamps SHALL be ISO-8601 in `America/Argentina/Buenos_Aires` (offset -03:00). IPC and the other INDEC variation series SHALL be signed (may be negative). Reference-age tolerances: FX ≈ 2 days, oil ≈ 4 days (futures weekend gap + holidays), BCRA and riesgo país ≈ 7 days, IPC and canastas ≈ 90 days, salarios and EMAE ≈ 120 days (≈2-month publish lag + margin) before being flagged `referenceAged`.

#### Scenario: IPC reference month

- GIVEN the INDEC IPC latest period `202609`, WHEN GET, THEN `ipc-mensual` returns `referenceDate:"2026-09"` and signed value (e.g. `1.9`)

#### Scenario: FX source date

- GIVEN dolarapi `fechaActualizacion` = `2026-08-09T20:58:00-03:00`, WHEN GET, THEN `usd-blue` returns it as `referenceDate`, unchanged

#### Scenario: Timezone conversion

- GIVEN `fetched_at` stored UTC `2026-08-09T23:58:00Z`, WHEN GET, THEN `updatedAt` = `2026-08-09T20:58:00-03:00`

### Requirement: EI-6 — Web tab

`IndicatorsPage` SHALL render 15 cards in two subsections — "Mercado" (10 cards) and "Economía argentina" (5 cards) — in that order, each card showing label, value, unit and updatedAt, a stale badge when `stale`, and a signed `changePercent` badge next to the value — green `+` up / red `-` down, 2 decimals — hidden when `changePercent` is `null` or `abs(changePercent) < 0.005`, i.e. any change that would render as `0,00%` at 2 decimals, including exact `0`. The page SHALL auto-refresh every ≈5 min while the tab is active (TTL-respecting refresh), offer a manual refresh button (force), and handle loading/error/stale states. No charts in v1.

#### Scenario: Render

- GIVEN API returns 15 fresh items, WHEN page loads, THEN 15 cards show label, value, unit, updatedAt, no badge; the Mercado subsection renders before Economía argentina

#### Scenario: Stale badge and failed auto-refresh

- GIVEN items `status:"stale"` and auto-refresh fails, WHEN page renders, THEN last values + stale badge + error state; no blank screen

#### Scenario: Manual refresh

- GIVEN user clicks refresh, WHEN `refresh?force=true` succeeds, THEN cards update, badges clear (loading during request)

### Requirement: EI-7 — Zero regression

This change MUST NOT modify any existing capability: expense-tracker specs, domain core, and existing routes SHALL remain untouched; existing tests SHALL pass unchanged.

#### Scenario: Existing suite

- GIVEN delivered expense-tracker codebase and test suite, WHEN capability added, THEN all existing tests pass; no changes to existing specs or core

#### Scenario: Additive routes

- GIVEN existing API, WHEN indicator routes added, THEN only new paths under `/api/v1/indicators`; existing routes unchanged

### Requirement: EI-8 — INDEC API token

The INDEC API-INDEC endpoints SHALL be authenticated with a Bearer JWT read from the `INDEC_API_TOKEN` environment variable. The token SHALL never be logged, returned in an API response, or included in an error message. The API SHALL start and serve indicators without the variable configured: the `ipc` class SHALL use the keyless argentinadatos fallback and `indec-canastas`, `indec-salarios` and `indec-emae` SHALL report `failed` while their cached snapshots keep serving.

#### Scenario: Token configured

- GIVEN `INDEC_API_TOKEN` set, WHEN refresh, THEN INDEC requests carry `Authorization: Bearer <token>` and no response or error exposes it

#### Scenario: Token missing

- GIVEN `INDEC_API_TOKEN` unset, WHEN refresh, THEN `ipc` still updates from the argentinadatos fallback, the three INDEC economy classes report `failed`, and GET keeps serving prior cache

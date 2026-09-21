# Economic Indicators Specification

## Purpose

Read-only snapshot of 11 economic indicators (USD blue/oficial/tarjeta/MEP/CCL, riesgo país, IPC mensual, reservas, BADLAR, Brent and WTI crude oil) served cache-first via REST with per-class TTL freshness, stale degradation, and a card UI. Decoupled from the expense-tracker core.

## Requirements

### Requirement: EI-1 — Snapshot serving (cache-first)

`GET /api/v1/indicators` SHALL return 11 indicators as `{key, value, unit, referenceDate, updatedAt, stale, status, referenceAged, changePercent}` with `status` ∈ `fresh|stale|absent`. Keys: `usd-blue`, `usd-oficial`, `usd-tarjeta`, `usd-mep`, `usd-ccl`, `riesgo-pais`, `ipc-mensual`, `reservas`, `badlar`, `brent`, `wti`. FX value SHALL be the sell quote (`venta`); units: FX `ARS/USD`, riesgo país `pb`, IPC `%` (signed), reservas `millones USD`, BADLAR `% TNA`, Brent/WTI `USD/bbl` (raw dollars per barrel). GET SHALL be cache-first: it MUST NOT trigger an external fetch. `changePercent` SHALL be the signed percent change vs the previous published reading, derived as `(value - prevValue) / prevValue * 100`; it SHALL be `null` when `value` or `prevValue` is missing or `prevValue <= 0`, and always `null` for `ipc-mensual` (its value is already a monthly variation percentage; a % change of a % is a second-order stat).

#### Scenario: Fresh cache

- GIVEN all 11 snapshots cached, age ≤ TTL, WHEN `GET /api/v1/indicators`, THEN 200 with 11 items `status:"fresh"`, `stale:false`, all fields set; no external request

#### Scenario: Empty cache (first run)

- GIVEN no snapshot rows, WHEN GET, THEN 200 with `value:null`, `status:"absent"`, `stale:false`, key+unit present; no external request

#### Scenario: Expired cache

- GIVEN age > TTL, no recent refresh, WHEN GET, THEN cached value with `status:"stale"`, `stale:true`, `updatedAt` = last successful fetch; no external request

### Requirement: EI-2 — Refresh

`POST /api/v1/indicators/refresh` SHALL fetch all classes (dolarapi one call, 5 FX; BCRA v4 catalog+series, reservas, BADLAR; argentinadatos, IPC via the `inflacion` series last entry and riesgo país; Yahoo v8 chart, Brent `BZ=F` and WTI `CL=F`), update the cache with `fetched_at`, and respond `{results:[{class, status: updated|cached|failed, error?}]}`. A source failure MUST NOT affect other classes (partial success). Zero/negative BCRA values SHALL be treated as failed. IPC SHALL be the last entry of the argentinadatos `inflacion` series; an empty or malformed series SHALL be treated as failed. The oil fetch SHALL be all-or-nothing: any missing or invalid field on either symbol reports the class `failed` and keeps the prior snapshots. Before writing each snapshot the refresh SHALL resolve `prevValue` (the previous published reading): an adapter-supplied `prevValue` wins; otherwise the cached `value` is carried forward as `prevValue` when the cached `referenceDate` differs from the incoming sample, and a same-`referenceDate` refresh keeps the cached `prevValue` (no double-shift). Series sources (BCRA, argentinadatos) SHALL set `prevValue` from the second-latest point by `fecha` (`null` when the series has one point); the oil source SHALL use the chart meta `previousClose`/`chartPreviousClose` when present; dolarapi supplies none and relies on carry-forward.

#### Scenario: Full success

- GIVEN all 5 sources reachable, WHEN refresh, THEN cache updated for all 11 with `fetched_at`; all classes report `updated`

#### Scenario: Source failure modes (timeout, HTTP 5xx, malformed JSON)

- GIVEN one source times out, returns 5xx, or unparseable JSON, WHEN refresh, THEN that class reports `failed` with error, its cache rows unchanged, other classes `updated`

#### Scenario: Partial success

- GIVEN dolarapi OK, BCRA down, WHEN refresh, THEN FX `updated`; reservas/BADLAR `failed`, prior cache kept

#### Scenario: All sources down

- GIVEN all 5 sources fail, WHEN refresh, THEN 200 with all classes `failed`; GET keeps serving cache

#### Scenario: Invalid BCRA values

- GIVEN reservas = 0 or negative, or negative BADLAR, WHEN refresh, THEN those indicators report `failed`; cache unchanged

#### Scenario: IPC last-entry selection

- GIVEN the argentinadatos `inflacion` series, WHEN refresh, THEN `ipc-mensual` takes the LAST entry `{valor, fecha}` as its sample; an empty or malformed series reports `failed`

### Requirement: EI-3 — TTL policy

TTLs: FX ≈ 5 min; oil ≈ 10 min (halves Yahoo calls behind the 5-min web poll); BCRA and riesgo país ≈ daily; IPC ≈ 12 h. A non-forced refresh MUST NOT refetch a class with cache age ≤ TTL — it SHALL serve cache and report `cached`. `POST /api/v1/indicators/refresh?force=true` (manual, user-initiated) MUST bypass TTL and refetch all classes.

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

`referenceDate` SHALL be the source's own date: IPC the INDEC reference month (e.g. `2026-06`; ≈6-week publish lag acceptable), FX the dolarapi `fechaActualizacion`, Brent/WTI the Yahoo `regularMarketTime` rendered as an AR-time instant. All timestamps SHALL be ISO-8601 in `America/Argentina/Buenos_Aires` (offset -03:00). IPC SHALL be the signed monthly variation (may be negative). Oil reference dates SHALL tolerate up to 4 days (futures weekend gap + holidays) before being flagged `referenceAged`.

#### Scenario: IPC reference month

- GIVEN IPC series latest point `2026-06`, WHEN GET, THEN `ipc-mensual` returns `referenceDate:"2026-06"` and signed value (e.g. `-0.1`)

#### Scenario: FX source date

- GIVEN dolarapi `fechaActualizacion` = `2026-08-09T20:58:00-03:00`, WHEN GET, THEN `usd-blue` returns it as `referenceDate`, unchanged

#### Scenario: Timezone conversion

- GIVEN `fetched_at` stored UTC `2026-08-09T23:58:00Z`, WHEN GET, THEN `updatedAt` = `2026-08-09T20:58:00-03:00`

### Requirement: EI-6 — Web tab

`IndicatorsPage` SHALL render 11 cards (label, value, unit, updatedAt; stale badge when `stale`; signed `changePercent` badge next to the value — green `+` up / red `-` down, 2 decimals — hidden when `changePercent` is `null`), auto-refresh every ≈5 min while the tab is active (TTL-respecting refresh), a manual refresh button (force), and loading/error/stale states. No charts in v1.

#### Scenario: Render

- GIVEN API returns 11 fresh items, WHEN page loads, THEN 11 cards show label, value, unit, updatedAt, no badge

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

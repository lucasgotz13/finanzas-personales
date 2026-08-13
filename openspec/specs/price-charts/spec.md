# Delta for price-charts

## ADDED Requirements

### Requirement: PC-1 — Series retrieval

`GET /api/v1/portfolio/history?range&currency` SHALL return the portfolio aggregate; `GET /api/v1/portfolio/positions/:id/history?range&currency` SHALL return one asset's series. `range` ∈ `3m|6m|1y`; `currency` ∈ `ARS|USD`; invalid → 422; unknown position → 404. Response: `{points:[{date,valueMinor}], currency, range, status:"fresh"|"stale"|"absent"}`. `value(t) = Σ quantity_i(today) × close_i(t)`. Reads MUST be cache-first, MUST NOT fetch on read; `force=true` bypasses.

#### Scenario: Aggregate and per-asset

- GIVEN cached series, WHEN GET either endpoint, THEN points for range/currency with fresh/stale/absent status (cache miss = absent, no fetch); no external call unless force.

### Requirement: PC-2 — Alignment and null safety

Series SHALL use `indicators.quote[0].close` (NOT adjclose). Yahoo omits non-trading days: series SHALL align to the range's common calendar; absent dates stay absent (never zero-filled). null/NaN closes SHALL drop that asset for that day; the aggregate SHALL keep the day with remaining assets. A 404 SHALL exclude the asset from the aggregate; its chart shows an empty state. Newly listed assets SHALL start at their first point.

#### Scenario: Holiday misalignment

- GIVEN AAPL.BA misses a BYMA holiday AAPL has, WHEN aligned, THEN that day is absent for AAPL.BA only; aggregate uses remaining assets.

#### Scenario: Null close / missing series

- GIVEN a null close or Yahoo 404 for one asset, WHEN aggregating, THEN that asset skipped (day kept); its chart drops the point or shows empty state.

### Requirement: PC-3 — CCL conversion

ARS mode SHALL convert USD-native series using CCL(t) = argentinadatos `contadoconliqui` **venta** on the same date; USD mode SHALL convert ARS-native (.BA) series dividing by CCL(t). Missing CCL SHALL forward-fill the last known value; dates before the first known CCL SHALL be dropped. argentinadatos down with no cached CCL SHALL degrade ARS to USD-only (`currency:"USD", degraded:true`) — 200, never an error.

#### Scenario: Forward-fill

- GIVEN CCL published only on trading days, WHEN converting a weekend date, THEN last known CCL used.

#### Scenario: Source down

- GIVEN argentinadatos down, no CCL cache, WHEN GET currency=ARS, THEN 200 USD series, degraded flag; no 5xx.

### Requirement: PC-4 — Series caching

`series_cache` (migration 005) SHALL store one row per `(ticker, range)` — JSON points + `fetched_at`; CCL rows keyed `(ccl, range)`. TTL SHALL be ~24h (NOT the 5-min snapshot TTL). Fetches SHALL be sequential, inheriting the Yahoo 429 cooldown. Failed fetch SHALL keep the last cached series, served `status:"stale"`.

#### Scenario: Failure keeps cache

- GIVEN cached series > 24h and refresh fails (429/network), WHEN GET force, THEN last series served stale; cooldown armed.

### Requirement: PC-5 — Charts UI

Inversiones SHALL render a PortfolioChart card at top: title, range chips 3m/6m/1y, ARS/USD toggle, es-AR currency-formatted values. Tapping a position row SHALL expand the AssetChart inline below it (one open at a time). recharts SHALL match La billetera: **ink** data line (never `--action` green), hairline axes, muted text, paper background, tabular es-AR tooltip. Both cards SHALL have loading, error ("Reintentar"), and empty states.

#### Scenario: Render and toggle

- GIVEN series data, WHEN page loads or chips/toggle change, THEN chart re-renders with ink line and es-AR tooltip values ("1.584,93").

#### Scenario: Empty and error states

- GIVEN empty portfolio, loading, or API error, WHEN rendered, THEN empty state, spinner, or error with "Reintentar" — never blank.

### Requirement: PC-6 — Honesty

The PortfolioChart SHALL ALWAYS show "Valores con cantidades actuales" directly on the card (es-AR), visible without interaction. Chart copy MUST NOT claim historical holdings, realized performance, or exact past wealth.

#### Scenario: Note visibility

- GIVEN chart data, WHEN viewed, THEN the note is permanently visible on the card.

### Requirement: PC-7 — Zero regression

This change MUST NOT modify existing capabilities; specs, core, and routes SHALL remain untouched; 365 existing tests SHALL pass unchanged. New code: priceCharts domain, new endpoints, migration 005, additive web components only.

#### Scenario: Existing suite unchanged

- GIVEN delivered codebase, WHEN capability added, THEN 365 tests pass unchanged; only new paths under /api/v1/portfolio/history.

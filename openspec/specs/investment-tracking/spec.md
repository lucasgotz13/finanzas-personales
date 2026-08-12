# Investment Tracking Specification

## Purpose

Portfolio valuation for CEDEARs and BYMA stocks: positions CRUD, Yahoo v8 price fetch with snapshot cache and TTL, USD-native valuation via CCL, avg-cost P&L, Inversiones tab.

## Requirements

### Requirement: PI-1 — Positions CRUD

A position SHALL have `ticker`, `name`, `quantity > 0`, `avgCostMinor > 0`, `currency`. Native currency SHALL be USD: `currency` fixed to `USD` in v1; `avgCostMinor` = USD cents. Ticker uppercased, `.BA` auto-appended when missing. List ordered by ticker. Delete SHALL be hard, with confirmation; no soft delete.

#### Scenario: Create (auto .BA)

- GIVEN `{ticker:"aapl", quantity:10, avgCostMinor:18000}`, WHEN create, THEN 201, stored `"AAPL.BA"`.

#### Scenario: Validation and duplicates

- GIVEN empty ticker, zero quantity, avgCostMinor ≤ 0, currency ≠ USD, or duplicate, WHEN create/update, THEN 422/409, nothing persisted.

#### Scenario: Quantity change recomputes

- GIVEN cached price, WHEN quantity changes, THEN valuation recomputed; no forced refetch.

#### Scenario: Hard delete

- GIVEN UI shows position, WHEN delete confirmed, THEN position and snapshots removed; no soft-delete.

### Requirement: PI-2 — Yahoo price fetch

The adapter SHALL GET `https://query1.finance.yahoo.com/v8/finance/chart/{TICKER}?interval=1d&range=1d`, one symbol per request, parsing `meta.regularMarketPrice`. Quotes SHALL normalize to USD: `meta.currency:"ARS"` (BYMA locals) via cached CCL; no CCL → `failed`. One failing symbol MUST NOT abort the batch. 429, 404, NaN/null, malformed → `failed`; prior price kept.

#### Scenario: Happy fetch

- GIVEN Yahoo reachable, WHEN refresh `AAPL.BA`, THEN `regularMarketPrice` cached.

#### Scenario: Failure modes

- GIVEN 404/null price, bad JSON, or 429, WHEN refresh, THEN `failed` (cooldown on 429); cache kept, others proceed.

### Requirement: PI-3 — Snapshot cache and degradation

Prices persist in `price_snapshots`, TTL ≈ 5 min (equities). GET SHALL be cache-first, MUST NOT fetch on read. `status` ∈ `fresh|stale|absent`: stale = beyond TTL; absent = never fetched. Non-forced refresh MUST NOT refetch age ≤ TTL (`cached`); `force=true` bypasses.

#### Scenario: Cache-first read

- GIVEN cached snapshot or none, WHEN GET, THEN price with `fresh` or `stale` (beyond TTL) or `absent` (`price:null`); no external request.

#### Scenario: TTL-respecting refresh

- GIVEN age 2 min, WHEN refresh non-forced, THEN `cached`; with `force=true`, refetched (`updated`).

### Requirement: PI-4 — Valuation and summary

Per position: price USD, value USD (`price × quantity`), value ARS via CCL, P&L ARS = `(price − avgCost) × quantity`, P&L %, currency. Totals: USD, ARS, P&L abs + %. CCL cached SHALL be used for ARS; CCL absent → USD-only, never blank.

#### Scenario: Full valuation

- GIVEN fresh price and CCL, WHEN GET, THEN per-position ARS value + P&L and totals; snapshot-less positions excluded ('—', `absent`).

#### Scenario: CCL degradation

- GIVEN CCL stale, WHEN GET, THEN ARS uses last known CCL, `ccStatus:"stale"` warning; CCL absent → ARS null (USD-only); never blank.

### Requirement: PI-5 — Refresh

`POST /api/v1/portfolio/refresh` SHALL fetch per-symbol sequentially (one in-flight), TTL-respecting; per-symbol `{status: updated|cached|failed, error?}`; `force` bypasses TTL. Auto-refresh ≈ 5 min ONLY while tab visible; manual button forces.

#### Scenario: Mixed batch

- GIVEN one symbol down, WHEN refresh, THEN `failed` (cache kept), others `updated`; 200.

#### Scenario: Visibility-gated refresh

- GIVEN tab hidden, WHEN 5 min elapse, THEN no refresh fires; when visible, refresh resumes.

### Requirement: PI-6 — Web tab

Inversiones tab SHALL render: money-first positions table with stale/absent chips, add/edit/delete form, summary card (ARS big, USD secondary, P&L chip), green refresh, empty state, loading/error with "Reintentar".

#### Scenario: Render and empty state

- GIVEN fresh-priced positions, WHEN page loads, THEN table + summary with totals and P&L chip; no positions → empty state with add CTA.

#### Scenario: Fetch failure

- GIVEN API error, WHEN page loads, THEN error state with "Reintentar"; no blank screen.

### Requirement: PI-7 — Zero regression

This change MUST NOT modify existing capabilities: specs, core, and routes SHALL remain untouched; 326 tests SHALL pass unchanged.

#### Scenario: Existing suite + additive routes

- GIVEN delivered codebase, WHEN capability added, THEN 326 tests pass unchanged; only new paths under `/api/v1/portfolio`.

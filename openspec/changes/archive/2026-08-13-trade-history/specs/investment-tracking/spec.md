# Delta for investment-tracking

## RENAMED Requirements

### Requirement: PI-1 — Positions CRUD → PI-1 — Positions (derived from trades)

(Reason: positions are no longer a manually edited entity; they are derived from the trade ledger.)
(Migration: tests and clients that create/update/delete positions directly must move to trade endpoints (TH-1); position read endpoints keep their response shape.)

## MODIFIED Requirements

### Requirement: PI-1 — Positions (derived from trades)

A position SHALL be derived from trades: `quantity = Σbuys − Σsells`, `avgCostMinor` = moving-average cost (TH-3). `GET /api/v1/portfolio/positions` SHALL serve derived data, ordered by ticker, each with `id`, `ticker`, `name`, `quantity`, `avgCostMinor`, `currency:USD`. Direct position create/update/delete SHALL be removed — mutations happen exclusively through trades (TH-1, TH-2); the positions table SHALL be kept only as rollback net. `id` SHALL be preserved from the legacy position record so existing chart endpoints (PC-1) keep working; tickers without a legacy record get a derived id. `name` SHALL be preserved from the legacy record; otherwise SHALL default to the ticker.
(Previously: positions were manually created/updated/deleted with direct `quantity` and `avgCostMinor`, and hard-deleted with confirmation.)

#### Scenario: Derived read

- GIVEN trades buy 10 @ 18000 and sell 3, WHEN `GET /api/v1/portfolio/positions`, THEN `AAPL.BA` has quantity 7, `avgCostMinor` 18000, ordered by ticker

#### Scenario: Mutation via trades only

- GIVEN derived positions, WHEN `POST`/`PUT`/`DELETE` on position mutation endpoints, THEN endpoint absent (404/405); changes happen through trades and are timeline-validated (TH-2)

#### Scenario: Trade change recomputes

- GIVEN cached price, WHEN a trade is created, edited, or deleted, THEN derived quantity and average are recomputed and valuation reflects it; no forced refetch

#### Scenario: Id and name preservation

- GIVEN legacy position `{id:5, name:"Apple"}` for `AAPL.BA`, WHEN derived, THEN id 5 and name "Apple" exposed; a new ticker without legacy record uses a derived id and name = ticker

### Requirement: PI-4 — Valuation and summary

Per position: price USD, value USD (`price × quantity`), value ARS via CCL, P&L ARS = `(price − avgCost) × quantity`, P&L %, currency. `avgCostMinor` SHALL be the moving-average cost derived from trades (TH-3). Totals: USD, ARS, P&L abs + %. CCL cached SHALL be used for ARS; CCL absent → USD-only, never blank.
(Previously: `avgCostMinor` came from the manually edited position record.)

#### Scenario: Full valuation

- GIVEN fresh price and CCL, WHEN GET, THEN per-position ARS value + P&L and totals; snapshot-less positions excluded ('—', `absent`)

#### Scenario: CCL degradation

- GIVEN CCL stale, WHEN GET, THEN ARS uses last known CCL, `ccStatus:"stale"` warning; CCL absent → ARS null (USD-only); never blank

#### Scenario: Derived avg-cost P&L

- GIVEN trades buy 10 @ 18000 and buy 10 @ 22000 (avg 20000) with cached price 25000, WHEN GET, THEN P&L = (25000 − 20000) × 20

### Requirement: PI-6 — Web tab

Inversiones tab SHALL render: money-first positions table (read-only, derived) with stale/absent chips, summary card (ARS big, USD secondary, P&L chip), green refresh, empty state, loading/error with "Reintentar". Position add/edit/delete SHALL be replaced by the trade list/form and realized P&L per asset + total (TH-6), keeping the inline-confirm pattern.
(Previously: the tab had an add/edit/delete form for manual positions.)

#### Scenario: Render and empty state

- GIVEN derived positions with fresh prices, WHEN page loads, THEN read-only table + summary with totals and P&L chip; no trades → empty state with trade add CTA

#### Scenario: Fetch failure

- GIVEN API error, WHEN page loads, THEN error state with "Reintentar"; no blank screen

### Requirement: PI-7 — Zero regression

This change MUST NOT modify capabilities other than investment-tracking: price-charts, economic-indicators, and expense-tracker-family specs, core, and routes SHALL remain untouched; their tests SHALL pass unchanged.
(Previously: the change could not touch any capability and 326 tests passed unchanged.)

#### Scenario: Other suites unchanged

- GIVEN delivered codebase, WHEN trade-history is delivered, THEN price-charts/indicators/expense-tracker tests pass unchanged; only new paths under `/api/v1/portfolio/trades`

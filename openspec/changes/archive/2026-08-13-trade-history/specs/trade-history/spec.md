# Trade History Specification

## Purpose

Operations ledger for CEDEARs/BYMA positions: buy/sell trades in USD, running-balance integrity, moving-average cost, derived positions, cumulative realized P&L per asset and portfolio, migration from legacy positions, Inversiones trade UI.

## Requirements

### Requirement: TH-1 — Trades CRUD

A trade SHALL have `type` ∈ `buy|sell`, `ticker`, `date`, `quantity > 0`, `priceMinor > 0`, `currency` fixed to `USD` (USD cents). Ticker SHALL be uppercased with `.BA` auto-appended when missing. `GET /api/v1/portfolio/trades` SHALL list all trades ordered by date. Create/update SHALL validate all fields; invalid type, quantity ≤ 0, priceMinor ≤ 0, currency ≠ USD, or malformed date SHALL return 422 with nothing persisted. Update/delete of an unknown id SHALL return 404. Update SHALL re-validate the full timeline per TH-2.

#### Scenario: Create buy with normalization

- GIVEN `{type:"buy", ticker:"aapl", date:"2026-08-01", quantity:10, priceMinor:18000, currency:"USD"}`
- WHEN `POST /api/v1/portfolio/trades`
- THEN 201 and the trade is stored with ticker `"AAPL.BA"`

#### Scenario: Validation failures

- GIVEN quantity 0, priceMinor ≤ 0, type ∉ `buy|sell`, currency ≠ USD, or invalid date
- WHEN create or update
- THEN 422, nothing persisted

#### Scenario: Unknown id

- GIVEN no trade with that id, WHEN `PUT`/`DELETE /api/v1/portfolio/trades/:id`, THEN 404

### Requirement: TH-2 — Timeline integrity

The running balance per ticker SHALL be computed chronologically over all trades (date order; same-date trades in deterministic insertion order). A sell SHALL be rejected with 422 when it would make the balance negative at any point; the error SHALL name the offending trade and what to fix. Edits and deletes SHALL be re-validated against the full timeline; an edit/delete that invalidates a later sell SHALL be rejected with 422 stating which trade to fix first. Buying SHALL always be allowed. Derived quantity MUST never be negative.

#### Scenario: Sell exceeding balance

- GIVEN 5 `AAPL.BA` bought, WHEN sell 10, THEN 422 naming the trade; nothing persisted

#### Scenario: Valid sell

- GIVEN 10 bought at 18000, WHEN sell 3, THEN 201; running balance 7

#### Scenario: Invalidating edit/delete

- GIVEN buys 10 and later sells 8, WHEN the buy is edited to 5 or deleted, THEN 422 naming the dependent sell as the one to fix first

#### Scenario: Same-day determinism

- GIVEN multiple trades on one date, WHEN balance computed, THEN insertion order decides the sequence

### Requirement: TH-3 — Moving-average cost and derived positions

A buy SHALL update the ticker average: `avg = (existingQty×avg + newQty×price) / totalQty`. A sell SHALL NOT change the average. The derived position per ticker SHALL be `quantity = Σbuys − Σsells` and `avgCostMinor = current moving average`. A fully-sold ticker SHALL have quantity 0 (no position); the next buy then starts a fresh average at its price (formula with quantity 0).

#### Scenario: Averaging buys

- GIVEN buy 10 @ 18000 then buy 10 @ 22000, WHEN derived, THEN quantity 20, `avgCostMinor` 20000

#### Scenario: Sell leaves average

- GIVEN quantity 20, avg 20000, WHEN sell 5 @ 25000, THEN `avgCostMinor` stays 20000, quantity 15

#### Scenario: Full sale resets

- GIVEN quantity 20, avg 20000, WHEN sell 20 then buy 5 @ 30000, THEN first quantity 0 (no position), then avg 30000

### Requirement: TH-4 — Realized P&L

Each sell SHALL realize `(price − avgCostAtSellTime) × soldQuantity` in minor units; negative (loss) SHALL be allowed. Cumulative realized per asset SHALL equal Σ realized over its sells; the portfolio total SHALL equal Σ over all sells.

#### Scenario: Gain

- GIVEN avg 20000, WHEN sell 5 @ 25000, THEN realized 25000 credited to asset and portfolio totals

#### Scenario: Loss

- GIVEN avg 20000, WHEN sell 5 @ 15000, THEN realized −25000, shown as a loss

### Requirement: TH-5 — Migration and seed

Migration 006 SHALL create the trades table and seed it: every existing position SHALL become an initial BUY trade (today's date, position quantity and `avgCostMinor`, ticker). Seeding SHALL run once and be idempotent — a re-run MUST NOT duplicate trades. Seed trades SHALL remain editable through the normal CRUD. The positions table SHALL be kept unchanged as rollback net.

#### Scenario: Seed matches pre-migration values

- GIVEN position `AAPL.BA` 10 @ 18000, WHEN migration 006 runs, THEN one BUY trade dated today; the derived position is exactly 10 / 18000

#### Scenario: Idempotent seed

- GIVEN migration already ran, WHEN it runs again, THEN no duplicate trades are created

### Requirement: TH-6 — Web

Inversiones SHALL render a trade list grouped per asset (date desc) and a trade form (type, ticker, date, quantity, price USD); edit/delete SHALL use the existing inline-confirm pattern. Realized P&L SHALL display cumulative per asset and portfolio total (money-first, gain/loss chips). Validation errors SHALL be in es-AR. Loading, error with "Reintentar", and empty states SHALL be present.

#### Scenario: Render and empty state

- GIVEN trades, WHEN page loads, THEN list grouped per asset date desc plus realized P&L per asset and total; no trades → empty state with add CTA

#### Scenario: Rejected sell feedback

- GIVEN balance 5, WHEN selling 10 in the form, THEN es-AR error naming the trade; nothing saved

#### Scenario: Fetch failure

- GIVEN API error, WHEN page loads, THEN error state with "Reintentar"; no blank screen

### Requirement: TH-7 — Zero regression

This change MUST NOT modify other capabilities: price-charts SHALL keep its today's-quantities approximation and honesty note (PC-6); economic-indicators and expense-tracker-family specs, core, routes, and tests SHALL remain untouched; their 421 baseline tests SHALL pass unchanged.

#### Scenario: Charts and suites untouched

- GIVEN delivered codebase, WHEN trade-history is delivered, THEN price-charts behavior/tests unchanged; only new paths under `/api/v1/portfolio/trades`

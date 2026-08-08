# Period Summaries Specification

## Purpose

Month/quarter/year summaries grouped per category and per currency, with net flow and savings rate, computed without cross-currency conversion.

## Requirements

### Requirement: PS-1 — Period grouping

The system MUST provide summaries for calendar month, quarter, and year, showing expense totals grouped per category AND per currency. Transactions MUST be attributed by transaction date; period boundaries MUST follow the AR timezone (America/Argentina/Buenos_Aires).

#### Scenario: Backdated entry appears in past period

- GIVEN an August expense dated July 15
- WHEN the July summary is requested
- THEN the expense is included in July totals

#### Scenario: Empty period

- GIVEN a month with no transactions
- WHEN its summary is requested
- THEN zeroed totals are returned without error

### Requirement: PS-2 — Net flow

The system MUST report net flow (income − expenses) per currency per period.

#### Scenario: Net flow computed per currency

- GIVEN a period with 900000 ARS income and 600000 ARS expenses, plus USD income 100
- WHEN the summary is requested
- THEN ARS net flow is 300000 and USD net flow is 100, reported separately

### Requirement: PS-3 — Savings rate

The system MUST report savings rate (income − expenses) / income per currency per period; when income is zero, the savings rate MUST be reported as undefined rather than a division error.

#### Scenario: Zero income

- GIVEN a period with expenses but no income
- WHEN the summary is requested
- THEN savings rate is reported as undefined

#### Scenario: Rate computed

- GIVEN a period with 900000 ARS income and 600000 ARS expenses
- WHEN the summary is requested
- THEN savings rate is 0.333 for ARS

### Requirement: PS-4 — No cross-currency conversion

The system MUST NOT convert or mix totals across currencies in summaries; each currency MUST be reported separately. FX at entry is used only for budget consumption (BM-1), never for summary totals.

#### Scenario: Per-currency totals

- GIVEN ARS and USD expenses in one period
- WHEN the summary is requested
- THEN ARS and USD totals are reported separately, never summed

### Requirement: PS-5 — Deleted categories remain

The system MUST include expenses of deleted categories in summaries, grouped under the category's current name (per CM-4).

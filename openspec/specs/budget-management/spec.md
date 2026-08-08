# Budget Management Specification

## Purpose

Per-category monthly caps and a global cap (sum of caps) with manual re-adjustment and over-budget status, expressed in base currency using FX rates recorded at entry.

## Requirements

### Requirement: BM-1 — Per-category monthly cap

The system MUST allow configuring a monthly cap per category, expressed in base currency (ARS). Each expense MUST count against its category's cap converted to ARS using the FX rate recorded at entry; spending is attributed to the calendar month of the transaction date.

#### Scenario: Foreign expense counts toward cap

- GIVEN category Food has cap 100000 ARS and a USD 5000 expense at entry rate 950 exists
- WHEN the month's budget status is computed
- THEN consumption is 47500 of 100000

#### Scenario: Backdated expense counts toward its month

- GIVEN a July expense registered in August
- WHEN July budget status is computed
- THEN the expense counts against July's cap, not August's

### Requirement: BM-2 — Global cap

The system MUST compute the global cap as the sum of all configured per-category caps. A category without a configured cap MUST NOT contribute to the global cap and MUST NOT be flagged over-budget.

#### Scenario: No budget configured

- GIVEN category Transport has no cap and high spending
- WHEN budget status is computed
- THEN Transport is never over-budget and adds nothing to the global cap

### Requirement: BM-3 — Manual re-adjustment

The system MUST allow the user to edit cap amounts by hand at any time; changes MUST take effect immediately; the system MUST NOT auto-adjust caps (no percentage-of-income or other automation).

#### Scenario: Cap edited mid-month

- GIVEN Food cap is 50000 with 60000 spent
- WHEN the user raises the cap to 70000
- THEN Food is no longer over-budget immediately

### Requirement: BM-4 — Over-budget status

The system MUST flag a category as over-budget when its month spending exceeds its cap, and MUST flag the global budget as over-budget when total spending of budgeted categories exceeds the global cap. Status MUST be computed on read.

#### Scenario: Global over-budget

- GIVEN caps of 100000 and 50000 with spending of 120000 and 40000
- WHEN budget status is computed
- THEN the first category is over-budget and the global budget is over-budget (160000 > 150000)

#### Scenario: Category over-budget, global OK

- GIVEN caps of 100000 and 50000 with spending of 110000 and 30000
- WHEN budget status is computed
- THEN the first category is over-budget but the global budget is not (140000 ≤ 150000)

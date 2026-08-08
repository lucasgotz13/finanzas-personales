# Income Tracking Specification

## Purpose

Registration of income as a transaction direction and provisioning of savings-rate inputs, with the same currency/FX discipline as expenses.

## Requirements

### Requirement: IT-1 — Transaction direction

The system MUST model every transaction with a direction of `expense` or `income`. Income registration MUST capture amount (integer minor units, > 0), currency, FX rate at entry (per ET-1/ET-2 rules), date, optional category, and optional note.

#### Scenario: Income registered

- GIVEN the user opens the income form
- WHEN they enter amount 900000 ARS, date August 1, category Salary
- THEN an income transaction is created and the period's income total increases by 900000

#### Scenario: Foreign-currency income

- GIVEN the user enters USD income
- WHEN a rate > 0 is provided at entry
- THEN the income is stored with currency, amount, and rate

#### Scenario: Rate missing rejected

- GIVEN the user enters USD income without a rate
- WHEN they submit
- THEN the system rejects the income

### Requirement: IT-2 — Income validation

The system MUST apply ET-2 validation to income: amount > 0, supported currency, rate > 0 for non-base currencies, valid non-deleted category. Invalid income MUST be rejected without persistence.

#### Scenario: Zero income rejected

- GIVEN the user enters income amount 0
- WHEN they submit
- THEN the system rejects the income

### Requirement: IT-3 — Savings rate inputs

The system MUST expose total income per currency per period as the income component of the savings rate, defined as (income − expenses) / income per currency.

#### Scenario: Income feeds savings rate

- GIVEN a period with 900000 ARS income and 600000 ARS expenses
- WHEN the period summary computes the savings rate
- THEN it reports 0.333 for ARS

#### Scenario: Income in its own currency only

- GIVEN USD income and ARS income in the same period
- WHEN the savings rate is computed
- THEN each currency is computed separately and never mixed

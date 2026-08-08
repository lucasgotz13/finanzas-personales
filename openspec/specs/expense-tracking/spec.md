# Expense Tracking Specification

## Purpose

Manual recording of expenses with currency and FX rate captured at entry, backdating, notes, and strict validation, so spending history is complete and backfill-proof.

## Requirements

### Requirement: ET-1 — Expense registration

The system MUST create an expense with amount (integer minor units, MUST be > 0), currency (MUST be a supported currency code; v1 supports ARS and USD), date, category, and optional note. For non-base currencies (base = ARS), the system MUST require an FX rate > 0 recorded at registration time and MUST persist it with the entry; for ARS, rate is 1 and MUST NOT be required. Every expense MUST reference a valid, non-deleted category.

#### Scenario: Happy path registration

- GIVEN the user is on the expense form
- WHEN they enter amount 15000 ARS, date today, category Food, note "Lunch", and submit
- THEN an expense is created with rate 1 and appears in today's period

#### Scenario: Foreign currency with FX at entry

- GIVEN the user enters a USD expense of 2500
- WHEN they provide rate 950 and submit
- THEN the expense is stored with currency USD, amount 2500, rate 950, and the rate is persisted with the entry

#### Scenario: Rate unknown is rejected

- GIVEN the user enters a USD expense without a rate
- WHEN they submit
- THEN the system rejects with a validation error and no expense is created

### Requirement: ET-2 — Validation rules

The system MUST reject expenses with amount ≤ 0, unsupported currency, missing or non-deleted-invalid category, or FX rate ≤ 0 for non-base currencies. Rejected expenses MUST NOT be persisted.

#### Scenario: Negative amount rejected

- GIVEN the user enters amount -100
- WHEN they submit
- THEN the system rejects the expense and nothing is persisted

#### Scenario: Deleted category rejected

- GIVEN the selected category was soft-deleted
- WHEN the user submits the expense
- THEN the system rejects the expense

### Requirement: ET-3 — Backdating

The system MUST accept a transaction date in the past (or future) and MUST attribute the expense to the period of that date, not the registration date.

#### Scenario: Backdated expense affects past period

- GIVEN an expense is registered on August 8 with date July 15
- WHEN the July summary is requested
- THEN the expense appears in the July totals

### Requirement: ET-4 — Notes

The system MUST store an optional free-text note per expense; empty notes MUST be allowed.

### Requirement: ET-5 — Update and delete

The system MUST allow editing amount, currency, rate, date, category, and note of an existing expense, and MUST allow deleting an expense. Edits MUST re-validate per ET-2.

#### Scenario: Invalid edit rejected

- GIVEN an existing expense
- WHEN the user changes the amount to 0
- THEN the edit is rejected and the original values are kept

#### Scenario: Delete removes from summaries

- GIVEN an expense in the current month
- WHEN the user deletes it
- THEN the period totals decrease accordingly

### Requirement: ET-6 — Duplicate entries allowed

The system MUST NOT reject duplicate expenses (same amount, currency, date, category), because manual entry may legitimately repeat.

#### Scenario: Duplicate accepted

- GIVEN an expense of 500 ARS in Food on July 1 exists
- WHEN the user registers an identical expense
- THEN both are stored and the period shows 1000 total

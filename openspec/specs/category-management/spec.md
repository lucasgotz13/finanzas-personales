# Category Management Specification

## Purpose

Hierarchical category tree with seeded defaults, stable IDs, soft-delete, and rename, so history survives reorganizations without breaking transaction links.

## Requirements

### Requirement: CM-1 — Hierarchical tree

The system MUST support categories with an optional parent category, forming a tree with no cycles; a category MUST NOT be its own ancestor.

#### Scenario: Nested category

- GIVEN parent category "Housing"
- WHEN the user creates child category "Rent" under it
- THEN the tree contains Housing → Rent

#### Scenario: Cycle rejected

- GIVEN category A is parent of B
- WHEN the user tries to set A's parent to B
- THEN the system rejects the change

### Requirement: CM-2 — Seeded defaults

The system MUST seed default categories on first run with stable IDs: Food, Transport, Housing, Utilities, Health, Entertainment, Education, Savings, Other, and Salary.

#### Scenario: Fresh install has defaults

- GIVEN an empty database
- WHEN the app initializes
- THEN the default categories exist and are selectable in transaction forms

### Requirement: CM-3 — Stable IDs

The system MUST assign each category a unique ID at creation that never changes; transactions MUST reference categories by ID, never by name.

#### Scenario: Rename keeps ID

- GIVEN category "Food" with ID 5 and historical transactions
- WHEN the user renames it to "Comida"
- THEN transactions still reference ID 5 and appear under "Comida" in summaries

### Requirement: CM-4 — Soft-delete

The system MUST soft-delete categories: deleted categories MUST be hidden from pickers and MUST NOT be assignable to new transactions, but MUST remain attached to existing transactions and historical summaries. A category with children MUST NOT be deletable until its children are deleted first.

#### Scenario: Deleted category keeps history

- GIVEN category "Health" with past expenses is deleted
- WHEN the user views the past period summary
- THEN the expenses still appear grouped under "Health"

#### Scenario: Deletion with children rejected

- GIVEN a category with child categories
- WHEN the user tries to delete it
- THEN the system rejects the deletion

#### Scenario: Deleted category not assignable

- GIVEN a deleted category
- WHEN the user submits a new expense referencing it
- THEN the system rejects the expense (ET-2)

### Requirement: CM-5 — Rename

The system MUST allow renaming a category at any time without altering transaction data or budget configuration attached to its ID.

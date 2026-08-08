# Proposal: Expense Tracker

## Intent

User can't see where money goes: no record, no breakdown, no budgets, no trends; inflation + mixed currencies make nominal comparisons misleading. Outcome: local-first app where recording expenses/income takes seconds; month/quarter/year views show spending per category and currency, budget status, savings rate.

## Assumptions

- Multi-currency: transactions store currency + FX at entry (backfill-proof).
- Income in v1 (drives savings rate). Manual entry, backdating, notes.
- Hierarchical categories, seeded defaults, stable IDs, soft-delete.
- Budgets: per-category + global cap (sum of caps), re-adjustable.
- Single user, no auth, local-first.
- Stack: React (Vite) + Express + SQLite, TS monorepo (not Next.js).
- Money in integer minor units; AR timezone.

## Scope

### In Scope
- Expense CRUD (manual, backdated, currency + FX, note).
- Income registration (direction field).
- Hierarchical category management (seed, rename, soft-delete).
- Per-category monthly budgets + global cap; over-budget status.
- Month/quarter/year summaries per category and currency, net flow, savings rate.
- SQLite schema + migrations + seed.

### Out of Scope
- Dashboards, investments, inflation-adjusted reports, CSV import/export, recurring transactions, auth, mobile, sync.

## Capabilities

### New Capabilities
- `expense-tracking`: CRUD, currency + FX, backdating, notes.
- `income-tracking`: income registration.
- `category-management`: hierarchical tree, defaults, stable IDs, soft-delete.
- `budget-management`: per-category + global caps.
- `period-summaries`: grouping, net flow, savings rate.

### Modified Capabilities
None (greenfield).

## Approach

Modular monolith, hexagonal, max 3 layers: domain core (entities, use cases, ports) + swappable adapters (Express HTTP, SQLite). Currency/FX is pure data: rate at entry, per-currency grouping, no conversion in v1. Future features add adapters without touching core; React SPA consumes REST API.

## Affected Areas

All new (greenfield):
- `packages/domain/`: entities, use cases, ports.
- `apps/api/`: Express + SQLite adapters, REST endpoints.
- `apps/web/`: React SPA, forms, categories, budgets, summaries.
- `db/migrations/`: SQLite schema + seed.

## Risks

- Inflation erodes ARS comparability: High. FX at entry, per-currency grouping.
- Over-engineering: Med. 3-layer cap, monolith, YAGNI.
- Category rename breaks history: Med. Stable IDs + soft-delete.
- Scaffold exceeds 400-line review budget: High. Chained PRs via work units.
- Scope creep to dashboards: Med. Explicit OUT list, spec guardrails.

## Rollback Plan

Greenfield: drop branch, delete `apps/` `packages/` `db/`; SQLite is a file, no reversal.

## Dependencies

Node 20+, npm, SQLite, Express, React + Vite.

## Success Criteria

- [ ] ARS + USD expenses grouped per currency.
- [ ] Income registered; period shows net flow + savings rate.
- [ ] Over-budget flagged.
- [ ] Rename/soft-delete category; history intact.
- [ ] Domain tests green; local-first run.

## Proposal Question Round

Defaults: export (defer or JSON v1?), budget re-adjust (manual or %-income?), Express vs Fastify (Express?).

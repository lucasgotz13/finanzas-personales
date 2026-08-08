# Finanzas Personales

Local-first personal finance tracker. Record expenses and income in ARS/USD with
the FX rate captured at entry, organize them in a hierarchical category tree,
configure monthly budgets per category (with a global cap), and review
month/quarter/year summaries per category and currency.

## Stack

- **Monorepo**: npm workspaces, TypeScript (strict), Vitest
- **Domain core**: pure TS package (`packages/domain`) — entities, value
  objects, use cases, ports; no framework imports
- **API**: Express + SQLite (`apps/api`) — REST under `/api/v1`, `node:sqlite`
  adapter, hand-rolled SQL migrations
- **Web**: React + Vite SPA (`apps/web`) — plain hooks, no state library
- **Money**: integer minor units; ARS is the base currency (rate 1);
  summaries never convert across currencies; budgets convert via stored rates

## Prerequisites

- Node.js >= 20 (uses the built-in `node:sqlite` module)
- npm

## Commands

```bash
npm install                 # install all workspace dependencies

npm run migrate             # create finanzas.db, apply schema + seed (idempotent)
npm run typecheck           # strict typecheck across all workspaces
npm test                    # full test suite across all workspaces

npm run dev:api             # Express API on http://localhost:3000
npm run dev:web             # Vite dev server on http://localhost:5173
```

`FINANZAS_DB=/path/to/db.sqlite npm run migrate` overrides the database file
location (default: `finanzas.db` in the repo root).

## Quick start

```bash
npm install
npm run migrate
npm run dev:api   # terminal 1
npm run dev:web   # terminal 2
```

Open http://localhost:5173, record an expense on the Transactions tab, set
budgets on the Budgets tab, and check the Summaries tab.

The web dev server proxies `/api` to the API on port 3000 (see
`apps/web/vite.config.ts`). The API runs migrations on boot and is idempotent;
point `FINANZAS_DB` somewhere else to use a different database file.

## Layout

```
db/migrations/    SQL migrations + seed
packages/domain/  pure domain: entities, VOs, use cases, ports, unit tests
apps/api/         Express HTTP adapters + SQLite repositories + integration tests
apps/web/         React SPA: pages, components, api client
scripts/          migration runner CLI
```

## API overview (`/api/v1`)

| Method/Path | Purpose |
|---|---|
| `POST/GET /transactions`, `PATCH/DELETE /transactions/:id` | expense/income CRUD |
| `GET/POST /categories/tree`, `PATCH/DELETE /categories/:id` | category tree management |
| `GET/PUT /budgets`, `GET /budgets/status?month=` | per-category caps + status |
| `GET /summaries?period=&date=` | month/quarter/year summaries |

Errors use `{ "error": { "code", "message", "details" } }` with
`VALIDATION_ERROR` (422), `NOT_FOUND` (404), `CONFLICT` (409).

# Finanzas Personales

Local-first personal finance tracker for the Argentine context. Record expenses
and income in ARS/USD with the FX rate captured at entry, organize them in a
hierarchical category tree, configure monthly budgets per category (with a
global cap), review month/quarter/year summaries per category and currency,
follow live national indicators (USD quotes, IPC, riesgo país, reservas,
BADLAR), and manage an investments ledger: buy/sell trades with derived
positions, realized P&L, and portfolio/asset price history charts (ARS/USD).
Protected by an optional single-user passphrase login.

## Stack

- **Monorepo**: npm workspaces, TypeScript (strict), Vitest
- **Domain core**: pure TS package (`packages/domain`) — entities, value
  objects, use cases, ports; no framework imports
- **API**: Express + SQLite (`apps/api`) — REST under `/api/v1`, `@libsql/client`
  adapter (local file or Turso remote), hand-rolled SQL migrations
- **Web**: React + Vite SPA (`apps/web`) — plain hooks, no state library;
  recharts for price history charts
- **Money**: integer minor units; ARS is the base currency (rate 1);
  summaries never convert across currencies; budgets convert via stored rates

## Prerequisites

- Node.js >= 20 (SQLite access via `@libsql/client`)
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

## Production (Turso)

The API and the migration runner talk to SQLite through `@libsql/client`,
which supports both local files and remote Turso databases.

- **Local file** (default): `finanzas.db` in the repo root, or the file given
  by `FINANZAS_DB`. No extra configuration needed.
- **Turso remote**: set `TURSO_DATABASE_URL` (the database URL, e.g.
  `libsql://my-db.turso.io`) and `TURSO_AUTH_TOKEN` (the database auth token).
  When these are set, the API and the migration runner target the remote
  database and ignore `FINANZAS_DB`.

```bash
# migrate the local database (idempotent)
npm run migrate

# migrate a Turso database
TURSO_DATABASE_URL=libsql://my-db.turso.io TURSO_AUTH_TOKEN=<token> npm run migrate
```

The API runs migrations on boot against the same target it serves.

## Authentication

Optional single-user access gate. Set `FINANZAS_AUTH_PASSPHRASE` and every
`/api/v1` endpoint requires login: the passphrase is exchanged for a signed
httpOnly session cookie (short session by default, 30 days with "Seguir
conectado").

- **Unset** (dev default): auth is disabled and the API stays open.
- **Set**: `POST /auth/login` issues the cookie, `GET /auth/status` probes it,
  `POST /auth/logout` clears it; anything else without a valid cookie → 401.
- **Fail-closed in production**: with `NODE_ENV=production`, a missing or
  shorter-than-12-characters passphrase prevents the API from starting.

The web app shows a login gate before any data; log out from the header.

## Quick start

```bash
npm install
npm run migrate
npm run dev:api   # terminal 1
npm run dev:web   # terminal 2
```

Open http://localhost:5173, record an expense on the Transacciones tab, manage
categories on Categorías, set budgets on the Presupuestos tab, and review the
Resúmenes. The Indicadores tab shows the live national indicators, and
Inversiones holds the trade ledger, derived positions, and price history
charts.

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
| `GET /categories/tree`, `GET /categories/deleted`, `POST /categories`, `PATCH/DELETE /categories/:id`, `POST /categories/:id/restore` | category tree management |
| `GET/PUT /budgets`, `GET /budgets/status?month=` | per-category caps + status |
| `GET /summaries?period=&date=` | month/quarter/year summaries |
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/status` | single-user passphrase login (signed httpOnly cookie) |
| `GET /indicators`, `POST /indicators/refresh?force=` | economic indicators (9 keys), TTL-gated refresh |
| `GET /portfolio`, `POST /portfolio/refresh?force=` | derived positions + portfolio valuation |
| `GET/POST /portfolio/trades`, `PUT/DELETE /portfolio/trades/:id` | buy/sell trade ledger |
| `GET /portfolio/history?range=&currency=`, `GET /portfolio/positions/:id/history` | portfolio/asset price history charts |

Errors use `{ "error": { "code", "message", "details" } }` with
`VALIDATION_ERROR` (422), `NOT_FOUND` (404), `CONFLICT` (409).

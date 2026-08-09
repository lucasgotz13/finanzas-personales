# Proposal: Argentina Economic Indicators Dashboard

## Intent

One-tab daily snapshot of key Argentina indicators, replacing 3-4 site visits and giving FX context for multi-currency finances. When unofficial sources are down: serve stale cached values with freshness timestamps — never a blank screen.

## Assumptions

- LOCKED v1: cards with current values + timestamps only (no charts); USD (blue, oficial, tarjeta, MEP, CCL — one call), riesgo país, monthly IPC, reservas, BADLAR; auto-refresh while on tab (USD ~5 min TTL) + manual button; fully decoupled from expenses; all sources keyless, proxied via apps/api with caching.
- Single user, no auth. Display-only; Money VO untouched.
- TTL per class: FX ~5 min; BCRA/riesgo país daily; IPC ~12 h (INDEC mid-month, ~6-week lag).
- Stale fallback: expired cache + failed refresh → serve stale with "updated X ago".

## Scope

### In Scope
- 9 cards: USD blue/oficial/tarjeta/MEP/CCL, riesgo país, IPC variation + reference date, reservas, BADLAR
- 4 external fetches (dolarapi, BCRA catalog, datos.gob.ar, argentinadatos)
- SQLite snapshot cache (migration 003) + per-class TTL
- Manual + auto refresh while tab active; timestamps; loading/error/stale states

### Out of Scope
- Historical series/charts (sources expose history; chart-ready later)
- Alerts; integration with user expenses; currency conversion
- Multi-source-per-indicator abstraction beyond the port
- Any change to expense-tracker core (zero regression surface)

## Capabilities

### New Capabilities
- `economic-indicators`: fetch/refresh from 4 keyless sources; SQLite snapshot cache with per-class TTL; REST serving; card UI with timestamps and stale-data degradation.

### Modified Capabilities
- None

## Approach

Additive hexagonal: `Indicator` entity + `IndicatorSource`/`IndicatorCache` ports + `IndicatorService` (TTL policy, stale fallback) in `packages/domain` — pure, unit-testable. Four HTTP adapters + `SqliteIndicatorCache` in `apps/api` (migration 003: `indicator_snapshots(key PK, value, unit, reference_date, fetched_at, source)`). REST: `GET /api/v1/indicators`, `POST /api/v1/indicators/refresh`. Web tab reuses `useApi`. ZERO changes to existing domain core.

## Affected Areas

- `packages/domain/src/` — New: entity, ports, service, exports, tests
- `apps/api/src/sources/` — New: 4 HTTP adapters
- `apps/api/src/` — New: sqlite cache, `http/routes/indicators.ts`, wiring
- `db/migrations/003_indicators.sql` — New: `indicator_snapshots` table
- `apps/web/src/` — New: IndicatorsPage, IndicatorCard, api.ts additions, tab

## Risks

- Unofficial sources (dolarapi, argentinadatos) no SLA — High: cache + stale + swappable port
- BCRA API churn (v3→v4) — Med: pin v4 endpoints; adapter isolates; cache absorbs
- IPC series ID drift; ~6-week INDEC lag — Med: resolve via /search; show reference date
- Unknown rate limits — Low: cache-first reads; one fetch per TTL
- Scope creep (charts/alerts/conversion) — Med: explicit OUT list

## Rollback Plan

Revert change commit: drop tab/route/adapters, roll back migration 003, remove domain files. All additive — core untouched, rollback isolated.

## Dependencies

dolarapi.com, BCRA API v4, apis.datos.gob.ar, argentinadatos.com — all keyless, verified live 2026-08-09 (exploration #41).

## Success Criteria

- [ ] 9 cards render current values with timestamps and units
- [ ] Manual + auto refresh (per TTL) work while tab active
- [ ] Source down → stale values + "updated X ago"; no blank/error screen
- [ ] Expense-tracker tests pass unchanged (zero core diffs)
- [ ] API returns `{key, value, unit, referenceDate, updatedAt, stale}` for all indicators

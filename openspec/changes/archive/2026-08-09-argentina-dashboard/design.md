# Design: Argentina Economic Indicators Dashboard

## Technical Approach

Additive hexagonal capability `economic-indicators` (EI-1..EI-7): pure domain core in `packages/domain` (types, catalog, ports, `IndicatorService` — TTL/stale/partial-failure); four HTTP adapters + `SqliteIndicatorCache` + REST routes in `apps/api`; one read-only web tab. Cache-first GET never fetches; refresh is per-class with TTL gating and `?force=true` bypass. Zero core changes (EI-7); archived tracker conventions (hexagonal, error envelope, `useApi`, tabs).

## Architecture Decisions

| Decision | Choice (rationale) |
|---|---|
| Domain model | Plain types + `catalog.ts` (keys, units, class map, TTLs); display-only |
| IPC ID resolution | Inside `DatosGobArSource`: `/search` fallback, in-memory cached ID, retry-once (HTTP → adapter, self-heals) |
| Value storage | REAL for all values (decimal rates/%, millions USD; rejected INTEGER minor units) |
| BCRA ≤0 rejection | In `BcraSource` (throws → class `failed`); locked under adapters |
| Timestamps | Cache stores UTC ISO; VO `arIsoString` → fixed `-03:00` (AR, no DST) |
| GET shape | Bare array of `IndicatorView`, matches `GET /transactions` |
| Refresh TTL check | Per class: all keys ≤ TTL → `cached`; contract is per class (EI-2/3) |
| App wiring | Optional `indicatorSources` dep; default real adapters; tests inject stubs (EI-7) |

## Data Flow

```
GET /indicators        getAll() → cache.get×9 → fresh|stale|absent views (no fetch)
POST /indicators/refresh?force=  per class:
  age ≤ TTL && !force → "cached"; else fetch → validate → cache.set → "updated";
  catch → "failed"+error   (cache untouched; other classes continue)
```

## File Changes

```
packages/domain/src/indicators/{types,catalog,ports,service}.ts   Create
packages/domain/src/vo/ar-tz.ts (arIsoString → -03:00)            Create
packages/domain/src/index.ts                                      Modify (exports)
packages/domain/tests/indicators/service.test.ts, vo/ar-tz.test.ts Create
db/migrations/003_indicators.sql                                  Create
apps/api/src/sources/{dolar-api,bcra,datos-gob-ar,argentinadatos}.ts  Create
apps/api/src/sqlite/indicator-cache.ts                            Create
apps/api/src/http/routes/indicators.ts                            Create
apps/api/src/http/app.ts                                          Modify
apps/api/tests/indicators.test.ts, sources/*.test.ts              Create
apps/web/src/{types.ts,api.ts,App.tsx}                            Modify
apps/web/src/pages/IndicatorsPage.tsx, components/IndicatorCard.tsx Create
```

## Interfaces / Contracts

```ts
type IndicatorClass = 'fx' | 'bcra' | 'ipc' | 'riesgo-pais';
type IndicatorKey = 'usd-blue'|'usd-oficial'|'usd-tarjeta'|'usd-mep'|'usd-ccl'|'riesgo-pais'|'ipc-mensual'|'reservas'|'badlar';
type IndicatorStatus = 'fresh' | 'stale' | 'absent';
interface IndicatorSample { key: IndicatorKey; value: number; referenceDate: string; }
interface IndicatorView { key: IndicatorKey; value: number|null; unit: string; referenceDate: string|null; updatedAt: string|null; stale: boolean; status: IndicatorStatus; }
interface IndicatorSource { readonly class: IndicatorClass; fetch(): Promise<IndicatorSample[]>; }
interface IndicatorCache { get(key: string): Promise<IndicatorSnapshot|null>; set(s: IndicatorSnapshot): Promise<void>; }  // {key,value,unit,referenceDate,fetchedAt,source}
type IndicatorRefreshResult = { class: IndicatorClass; status: 'updated'|'cached'|'failed'; error?: string };
```

Service: `getAll()` (cache-only), `refresh(force)` (per-class try/catch isolation, finite-value checks, TTL skip). Catalog: `KEYS`, `UNIT_BY_KEY` (FX `ARS/USD`, riesgo país `pb`, IPC `%`, reservas `millones USD`, BADLAR `% TNA`), `CLASS_BY_KEY`, `TTL_BY_CLASS` (fx 5 m, bcra 24 h, riesgo-pais 24 h, ipc 12 h).

Adapters (10 s timeout; malformed JSON → throw):
- `DolarApiSource` — `https://dolarapi.com/v1/dolares`; casas `blue/oficial/tarjeta/bolsa/contadoconliqui` → usd-blue/oficial/tarjeta/mep/ccl; value=`venta`, date=`fechaActualizacion`; reject `≤0`.
- `BcraSource` — `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/1` & `/7`, `?desde=&hasta=` 45d; latest `{fecha, valor}`; reject `≤0`.
- `DatosGobArSource` — `https://apis.datos.gob.ar/series/api/series/?ids={id}`; latest `[fecha, valor]`; `referenceDate=fecha.slice(0,7)`; signed. Invalid → `/search/?q=…` → pick `tasa_variacion_mensual`, cache ID, retry once.
- `ArgentinadatosSource` — `https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais`; latest `{valor, fecha}`; reject `≤0`.

SQLite (003): `indicator_snapshots(key TEXT PRIMARY KEY, value REAL NOT NULL, unit TEXT NOT NULL, reference_date TEXT NOT NULL, fetched_at TEXT NOT NULL, source TEXT NOT NULL)`; upsert `ON CONFLICT(key) DO UPDATE`.

API: `GET /api/v1/indicators` → 200 bare array (always 200; absent → `value:null`). `POST /api/v1/indicators/refresh?force=true` → `{results:[…]}`; errors reuse `{error:{code,message,details[]}}`.

Web: `api.getIndicators()`/`refreshIndicators(force)`; IndicatorsPage = `useApi` GET + 5-min non-forced interval (page unmounts with tab) + manual forced refresh + loading/error/stale states; `IndicatorCard` = label, value, unit, relative `updatedAt`, stale badge; no charts.

## Testing Strategy

- **Domain unit** (Vitest; fakes + `FakeClock`): TTL classes; cached/updated/forced refresh; partial + all-down failure; invalid values; AR-tz.
- **Adapter unit** (Vitest, stubbed `fetch`): parse shapes; timeout; malformed JSON; BCRA ≤0; IPC drift.
- **API integration** (supertest + temp SQLite + stubs): GET shapes, zero fetches; refresh partial/TTL/force; envelope.
- **Web component** (Vitest + RTL): 9 cards, stale badge, manual refresh, loading/error, interval cleanup.

## Threat Matrix

N/A — Express app routes only; loopback REST, single user. No routing/shell/subprocess/VCS-PR/executable/process-integration boundary; all five rows N/A.

## Migration / Rollout

Forward-only runner applies `003_indicators.sql` on boot and in tests (idempotent). Rollback per slice: revert PR; drop table or delete `finanzas.db`. No feature flags.

## Work-Unit Sketch (chained PRs, ≤400 lines each)

| WU | Content | Delivery |
|---|---|---|
| 1 | Domain core: types, catalog, ports, service, `arIsoString`, exports + unit tests | chain base |
| 2 | API data: migration 003, `SqliteIndicatorCache`, 4 sources + adapter tests | PR #2 |
| 3 | API wiring: indicators router, buildApp wiring, integration tests | PR #3 |
| 4 | Web: types/api.ts, IndicatorCard, IndicatorsPage, tab + component tests | PR #4 |

Each slice: typecheck + its tests + full existing suite green. Forecast: `400-line budget risk: Low`; `Chained PRs recommended: Yes`; `Decision needed before apply: Yes` (ask-on-risk).

## Open Questions

None blocking. IPC series ID resolved at implementation via `/search` (ID-configurable); BCRA params verified live in exploration #41.

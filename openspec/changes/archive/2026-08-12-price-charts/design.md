# Design: Price Charts

## Technical Approach

New pure-TS domain module `packages/domain/src/priceCharts/` following the `investments/` shape (types / ports / service / catalog): series VOs, range windowing, common-calendar alignment, CCL(t) conversion with bounded forward-fill, and portfolio aggregation. Two new adapters return **native-currency** daily points: `YahooSeriesSource` (v8 chart, `range` param, `indicators.quote[0].close`, null/NaN-safe) and `ArgentinadatosCclSeriesSource` (`contadoconliqui` **venta**, chronological). `SqliteSeriesCache` + migration `005_price_series`. Two GET routes on the existing `portfolioRouter`; web adds a lazy-loaded `PortfolioChart` card and inline `AssetChart` row expansion (recharts, world tokens). Maps to proposal approach; PC-1..PC-7.

## Architecture Decisions

| # | Decision | Option | Tradeoff | Choice |
|---|----------|--------|----------|--------|
| D1 | Cache stores **native** series; conversion at read | Adapter normalizes at fetch | Mixed native assets (CEDEARs USD + .BA ARS) make aggregate conversion wrong; CCL(t) is date-indexed | Native points + `nativeCurrency` per cache row; `CclConverter` converts per asset per point |
| D2 | **No aggregate cache** | Cache portfolio curve | Invalidation on position changes; derived math is cheap (≤365 pts × N) | Aggregate computed on every read from per-asset caches (PC-4 keys only `ticker/range` + `ccl/range`) |
| D3 | Fetch policy | Read hit never fetches | Freshness vs "MUST NOT fetch on read" (PC-1) | Cache-first: hit (fresh/stale) → serve cache; miss → `absent` (MUST NOT fetch on read); `force=true` → fetch sequentially; failed refresh keeps stale entry |
| D4 | Forward-fill bound | Unlimited fill | Stale CCL distorts history | Max **5 calendar days**; older dates dropped; pre-first-CCL dates dropped |
| D5 | Aggregate days | Zero-fill missing | Fabricates prices | Sum only assets with a point that day; day dropped when none have one (PC-2) |
| D6 | Per-asset chart UX | Modal | World bans modals for light tasks | Inline expand below the row, one open at a time |
| D7 | Degradation | Error on unproducible currency | PC-3 mandates 200 | `currency` reflects returned series + `degraded:true` (ARS requested, no CCL → USD points) |
| D8 | Units | Float values | World uses minor units, rounds once per figure | `valueMinor` ints (cents); CCL stored REAL (rate, like indicators); dates `YYYY-MM-DD` (UTC slice of Yahoo timestamps) |

## Data Flow

```
GET /portfolio/history?range&currency&force
  → ChartService.getPortfolioHistory(force)
      per position (sequential):
        SeriesCache.get(`series:{ticker}:{range}`)
        hit? ──no──→ absent (never fetch on read); force=true fetches → cache.set   [D3]
        CCL needed? → SeriesCache.get(`ccl:{range}`)
                      miss → absent (never fetch on read); force=true fetches       [D3]
      per point: convert native→target via CCL(t) (≤5d fill)   [D1,D4]
      align to range window (90/180/365d) → aggregate Σ qty×close(t)  [D5]
  → {points, currency, range, status, degraded?}
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/domain/src/priceCharts/{types,ports,catalog,align,ccl,service}.ts` | Create | VOs, ports, TTL/range/FF constants, alignment, converter, `ChartService` |
| `packages/domain/tests/priceCharts/*.test.ts` | Create | Unit tests (mirrors `tests/` layout) |
| `packages/domain/src/index.ts` | Modify | Export new types/services (additive) |
| `db/migrations/005_price_series.sql` | Create | `series_cache` table |
| `apps/api/src/sqlite/series-cache.ts` | Create | Upsert store, key → JSON points (clone of `price-cache.ts` pattern) |
| `apps/api/src/sources/yahoo-series.ts` | Create | v8 chart range fetch, close parse, 429 cooldown map (pattern from `yahoo.ts`) |
| `apps/api/src/sources/argentinadatos-ccl.ts` | Create | `contadoconliqui` daily venta series |
| `apps/api/src/http/routes/portfolio.ts` | Modify | `GET /history` + `GET /positions/:id/history`; `parseRange`/`parseCurrency` → 422 |
| `apps/api/src/http/app.ts` | Modify | Wire `ChartService` + new `AppDeps` fields (stub-injectable, like `portfolioSource`) |
| `apps/api/tests/helpers.ts`, `apps/api/tests/history.test.ts` | Modify/Create | Stub series sources; integration tests |
| `apps/web/src/{api,types}.ts` | Modify | `getPortfolioHistory` / `getPositionHistory` + response types |
| `apps/web/src/components/PortfolioChart.tsx`, `AssetChart.tsx` | Create | recharts, chips, toggle, honesty note, states |
| `apps/web/src/pages/InvestmentsPage.tsx`, `index.css`, `package.json` | Modify | Chart card + row tap expand; **cache warm-up**: on Inversiones tab open and `visibilitychange`→visible, `GET .../history?force=true` once per range per warm-up (bounded); subsequent renders are cache-first reads; token-styled chart CSS; `recharts` dep (lazy) |
| `apps/web/src/pages/__tests__/InvestmentsPage.test.tsx` | Modify | Chart render/toggle/note tests |

## Interfaces / Contracts

```ts
export type SeriesRange = '3m' | '6m' | '1y';          // windows 90/180/365d
export type SeriesCurrency = 'ARS' | 'USD';
export interface PricePoint { date: string; valueMinor: number }
export interface CclPoint { date: string; value: number }
export interface NativeSeries { ticker: string; nativeCurrency: SeriesCurrency; points: PricePoint[] }
export interface PriceSeriesSource { fetchSeries(ticker: string, range: SeriesRange): Promise<NativeSeries> }
export interface CclSeriesSource { fetchCclSeries(): Promise<CclPoint[]> }
export interface SeriesCache { get(key: string): Promise<SeriesSnapshot | null>; set(s: SeriesSnapshot): Promise<void> }
// keys: `series:{ticker}:{range}` | `ccl:{range}`; TTL 24h (SERIES_TTL_MS)
export interface HistoryResponse { points: PricePoint[]; currency: SeriesCurrency; range: SeriesRange;
  status: 'fresh' | 'stale' | 'absent'; degraded?: boolean }
// GET /api/v1/portfolio/history?range&currency[&force]  → 404 unknown position (per-asset)
// value(t) = Σ_i qty_i(today) × native_i(t); USD-native assets multiply by CCL(t); ARS-native assets divide by CCL(t); CCL(t) forward-filled at most 5 calendar days (per-asset convert, round once)
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (domain) | Alignment (holiday: AAPL.BA absent only), forward-fill ≤5d / drop beyond, pre-first-CCL drop, ARS/USD conversion, aggregate drops asset-less days, 404 exclusion | `packages/domain/tests/priceCharts/`, stub ports |
| Unit (adapters) | Mocked fetch (pattern `yahoo.test.ts`): ok series, 404, NaN/null close skipped, 429 → cooldown throw, CCL partial venta parse | vitest, injected `fetchFn` |
| Integration | supertest + temp SQLite + stub sources: 422 range/currency, 404 position, cache-first no-fetch (spy counts), force refresh, failure keeps stale, degraded ARS→USD, status fresh/stale/absent | `apps/api/tests/history.test.ts` + `helpers.ts` additions |
| Web | Chart renders ink line + es-AR tooltip values ("1.584,93"), chips/toggle re-render, honesty note always visible, empty/error/Reintentar; row tap expands inline | Spy `api` client (pattern `InvestmentsPage.test.tsx`); explicit chart dims or `ResizeObserver` mock for jsdom |

## Threat Matrix

| Boundary | Applicability |
|----------|---------------|
| Documentation-like paths | N/A — no executable docs |
| Git repo selection / Commit state / Push state / PR commands | N/A — no shell, subprocess, Git or PR automation; new HTTP routes go through the existing Express pipeline with domain-error mapping (422/404) and `wrap()` |

## Migration / Rollout

`005_price_series.sql` is additive; the existing runner (`scripts/migrate.ts`, startup + tests) applies it. Cache populates via web warm-up (`force=true` on Inversiones tab open / `visibilitychange`→visible); empty until then. Rollback: revert the change commit — routes, module, adapters, migration drop cleanly; existing capabilities untouched (PC-7, 365 tests).

## Work Units (chained PRs, ≤400 lines each)

- **WU1** — domain `priceCharts` module + unit tests + `index.ts` exports
- **WU2** — migration 005 + `SqliteSeriesCache` + both adapters + adapter unit tests
- **WU3** — routes + `app.ts` wiring + `helpers.ts` + integration tests
- **WU4** — web: api client, `PortfolioChart`, `AssetChart`, page wiring, CSS, recharts, component tests

## Open Questions

- [ ] None blocking. (Verify `contadoconliqui` response field names (`fecha`/`venta`) in RED test fixtures — proposal marks endpoint verified.)

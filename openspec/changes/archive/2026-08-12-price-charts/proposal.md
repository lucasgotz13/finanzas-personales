# Proposal: Price Charts

## Intent

The user sees how their portfolio and each asset evolved over 3m/6m/1y, in ARS or USD — the "how did I get here" behind today's P&L. Same weekly ritual as indicators; never a blank screen.

## Assumptions

Locked (user): portfolio total chart atop Inversiones + per-asset chart on row tap; ARS/USD toggle — ARS via keyless CCL daily series (api.argentinadatos.com/v1/cotizaciones/dolares/contadoconliqui, verified), USD native series converted where needed; chips 3m/6m/1y; recharts styled to La billetera (hairline axes, ink data line — never action green, muted axis text, tabular es-AR tooltip, paper background); honesty — curve = TODAY's quantities × historical prices, explicit note ("Valores con cantidades actuales"); Yahoo v8 series (timestamps + close, null-safe) per ticker/range, close not adjclose (documented), sequential fetch, inherited 429 cooldown, SQLite cache daily TTL (NOT 5-min); CCL series cached too.

Added: single user, cache-first; ARS uses CCL venta; degradation — source fail → last cached series, none → honest empty/error, argentinadatos down → USD-only.

## Scope

In: history endpoints (per-asset series + portfolio aggregate, server-side — quantities live in positions); range/currency params; series + CCL cache tables; web PortfolioChart + AssetChart (recharts), chips, toggle, row tap, approximation note, loading/error/empty states.

Out: P&L-vs-cost curve; indicator history (dólar/IPC); draw/crosshair; export; intraday; multi-asset overlay; range=max; buy/sell markers; changes to existing capabilities.

## Capabilities

New: `price-charts` — per-asset + portfolio time series in ARS/USD, daily-TTL cache, recharts UI in Inversiones.
Modified: None.

## Approach

New domain `packages/domain/src/priceCharts/`: series VOs, null-safe alignment, CCL(t) conversion, aggregate. Ports `PriceSeriesSource` + `SeriesCache`. Adapters: Yahoo v8 series (extend yahoo.ts), argentinadatos CCL series. `sqlite/series-cache.ts`. REST `GET /api/v1/portfolio/history` + `/portfolio/positions/:id/history`. Migration 005: series_cache. Zero diffs in existing capabilities.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/domain/src/priceCharts/` | New | VOs, ports, ChartService |
| `apps/api/src/sources/` + `sqlite/` | Modified/New | series adapters, daily-TTL cache |
| `apps/api/src/http/routes/portfolio.ts` | Modified | history endpoints |
| `db/migrations/005_price_series.sql` | New | series_cache table |
| `apps/web/` | Modified | recharts, PortfolioChart, AssetChart, InvestmentsPage |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Yahoo 429 on N×R first load | High | sequential + cooldown + cache-first |
| argentinadatos reliability | Med | USD-only degradation, cached CCL |
| Approximation confusion | Med | explicit note, wording specced |
| recharts bundle ~30-40 KB gz | Med | accepted; lazy-load |
| TTL drift (daily vs 5-min) | Low | daily TTL in cache layer |

## Rollback Plan

Revert commit: drop routes, domain module, adapters, web components, migration 005. Additive only — existing capabilities untouched.

## Dependencies

- Yahoo v8 chart, keyless (verified)
- argentinadatos CCL series (verified)
- recharts (new web dependency)

## Success Criteria

- [ ] Charts render 3m/6m/1y in ARS and USD, portfolio + per-asset
- [ ] ARS curve applies CCL(t) to USD-native assets
- [ ] Fresh cache renders without a Yahoo call
- [ ] Honesty note shown on portfolio chart
- [ ] Source failure → cached series or honest state, never blank
- [ ] All 365 existing tests pass, zero diffs outside new module

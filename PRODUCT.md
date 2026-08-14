# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Single user (the owner), mixed usage: quick daily expense/income entry on the phone, monthly budget and summary review, and routine checks of the Argentina indicators (USD quotes, IPC, riesgo país) as context for personal finances.

## Product Purpose

Personal finance tracker that integrates the owner's money with the real Argentine economic context: every transaction stores its currency and the FX rate captured at entry, budgets convert to ARS via that recorded rate, and the app surfaces current USD quotes, monthly inflation, and riesgo país alongside the owner's own numbers.

## Positioning

The Argentine economic context is the product: multi-currency expenses (ARS/USD) with honest FX-at-entry, ARS-denominated budgets that convert recorded rates, and live national indicators (dólar blue/oficial/tarjeta/MEP/CCL, IPC, riesgo país, reservas, BADLAR) in the same app where the money lives.

## Operating Context

Single user on phone and desktop. Daily ritual: record expenses/income in seconds (form remembers direction/currency/category/date). Monthly ritual: review budgets (per-category caps, over-budget status) and period summaries (per-currency, savings rate). Ambient ritual: check indicator cards (freshness badges VENCIDO/REFERENCIA ANTIGUA; data freshness is fetch-time based with per-class TTLs). Investing ritual: record buy/sell trades and review derived positions, realized P&L, and portfolio price history. Deployed stack: React SPA on Vercel, Express API on Render (stateless), SQLite on Turso (libSQL client). es-AR UI, neutral register.

## Capabilities and Constraints

- Multi-currency transactions (ARS/USD) with FX-at-entry; rate required for non-ARS (W1 rule enforced on create and edit)
- Edit/delete transactions from the UI with inline confirm; category soft-delete with restore (deleted-categories section)
- Hierarchical categories, monthly budgets per category + global cap (ARS, manual re-adjust), period summaries (month/quarter/year, per-currency, savings rate)
- Indicators: 9 cards (5 USD quotes, riesgo país, IPC mensual, reservas, BADLAR) with per-class TTLs, stale/absent degradation, reference-age guard; sources dolarapi, BCRA v4, ArgentinaDatos (riesgo país + IPC), all keyless
- Investments: buy/sell trade ledger with timeline validation (a sell can never exceed the running balance), positions derived from the ledger (moving-average cost, no manual position editing), realized P&L per ticker, and portfolio/asset price history charts (3m/6m/1y, ARS/USD, CCL-converted with graceful degradation)
- es-AR amounts: dot = thousands, comma = decimal (parseEsArAmount); money via Intl es-AR
- Tabs stay mounted (state preserved); responsive ≤640px; a11y: aria-labels, role=alert, :focus-visible, contrast AA (--muted-text #595959)
- 464 tests green; backend API stays English, UI Spanish; no auth (single user)

## Brand Commitments

- Name: "Finanzas Personales" (keep as-is)
- UI language: Spanish (es-AR), neutral register (no voseo in UI copy)
- Everything else visual is open (redesign in progress — old navy/white look is anti-reference, not authority)

## Evidence on Hand

- Real product in production: https://finanzas-gotz.vercel.app (Vercel SPA) · API https://finanzas-api-vmgd.onrender.com · DB Turso libsql://finanzas-lucasgotz13.aws-us-east-1.turso.io
- Design critique snapshots: .impeccable/critique/ (17/40 → 23/40)
- Live data sources verified: dolarapi.com/v1/dolares, api.bcra.gob.ar v4 Monetarias, api.argentinadatos.com (riesgo-pais/ultimo + finanzas/indices/inflacion last entry)
- No invented testimonials, pricing, or benchmarks exist and must not be fabricated

## Product Principles

1. The number must be honest: FX at entry, freshness badges, reference-age guard — when data is stale, say so.
2. Entry is a ritual: remembered fields, decimal comma accepted, validation that explains itself.
3. Mistakes are fixable: edit/delete with confirmation, soft-delete with restore, no dead ends.
4. Argentine context is not an add-on: currency, inflation, and risk live beside the owner's money.
5. Mobile is a first-class scene: thumb targets, no zoom traps, state survives tab switches.

## Accessibility & Inclusion

No product-specific accessibility requirement established beyond the shipped a11y baseline (labels, alerts, focus-visible, AA contrast); preserve it in the redesign.

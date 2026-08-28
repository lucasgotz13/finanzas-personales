---
name: Finanzas Personales
description: "El Legajo — the Argentine fiscal archive, well kept: kraft desk, manila folders, receipt-paper sheets, brown-black ink, stamp red; at night, one warm lamp over the open folder."
colors:
  ground: "#cbb490"
  card: "#ecd9ac"
  sheet: "#faf6ec"
  receipt: "#faf6ec"
  ink: "#2b241a"
  muted-text: "#514533"
  hairline: "#b39a6b"
  stamp: "#a63d2f"
  ink-btn-bg: "#2b241a"
  ink-btn-bg-hover: "#443826"
  ink-btn-text: "#faf6ec"
  danger: "#a63d2f"
  danger-bg: "#f0d9cb"
  error-border: "#cf8d7c"
  warn: "#754c10"
  warn-bg: "#e6cfa0"
  ok-bg: "#e2d2a4"
  disabled-bg: "#d9c49a"
  selection-bg: "#a63d2f"
  selection-text: "#faf6ec"
  night-ground: "#171208"
  night-card: "#241c11"
  night-sheet: "#2e2415"
  night-ink: "#f0e6d2"
  night-muted-text: "#a89877"
  night-hairline: "#3f3421"
  night-stamp: "#e08570"
  night-receipt: "#f0e6d2"
  night-ink-btn-bg: "#f0e6d2"
  night-ink-btn-bg-hover: "#d8cbae"
  night-ink-btn-text: "#241c11"
  night-danger: "#e08570"
  night-danger-bg: "#3a221a"
  night-warn: "#d9a05e"
  night-warn-bg: "#3a2d18"
  night-ok-bg: "#332a18"
  night-disabled-bg: "#3a3020"
typography:
  display:
    fontFamily: "'Courier Prime', 'Courier New', monospace"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "tnum"
  headline:
    fontFamily: "'Courier Prime', 'Courier New', monospace"
    fontSize: "1.05rem"
    fontWeight: 700
    letterSpacing: "0.02em"
  title:
    fontFamily: "'Courier Prime', 'Courier New', monospace"
    fontSize: "0.95rem"
    fontWeight: 700
    letterSpacing: "0.06em"
    lineHeight: 1.2
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
  label:
    fontFamily: "'Courier Prime', 'Courier New', monospace"
    fontSize: "0.72rem"
    fontWeight: 700
    letterSpacing: "0.06em"
    lineHeight: 1.2
rounded:
  card: "12px"
  control: "6px"
  chip: "4px"
  badge: "3px"
  tab: "6px 6px 0 0"
  folder-tab: "4px 4px 0 0"
spacing:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.ink-btn-bg}"
    textColor: "{colors.ink-btn-text}"
    rounded: "{rounded.control}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.ink-btn-bg-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.disabled-bg}"
    textColor: "{colors.muted-text}"
  button-danger:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.receipt}"
    rounded: "{rounded.control}"
    padding: "0.35rem 0.8rem"
  input-field:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.45rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.lg}"
  card-sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.lg}"
  nav-tab-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tab}"
    padding: "0.5rem 0.9rem"
  badge-over:
    backgroundColor: "transparent"
    textColor: "{colors.stamp}"
    rounded: "{rounded.badge}"
    padding: "0.05rem 0.4rem"
  badge-ok:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.badge}"
    padding: "0.05rem 0.4rem"
  chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "0.2rem 0.7rem"
  chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.chip}"
    padding: "0.2rem 0.7rem"
---

# Design System: Finanzas Personales

## Overview

**Creative North Star: "El Legajo"** — the Argentine fiscal archive, well kept. Your money as a filed record: each month a folder, each expense a numbered sheet (a *foja*), each state an ink stamp. The world refuses both the generic dashboard and the soft-boxed ledger alike.

Light is the working light over the desk: a kraft ground (#cbb490) that is the desk itself, manila folder faces (#ecd9ac) for cards, receipt paper (#faf6ec) for the sheets you actually write on, brown-black ink (#2b241a), and stamp red (#a63d2f) reserved for stamps and destructive acts. Dark is not a re-skin — it is a scene: the desk in shadow and the open folder under one warm lamp, everything else receding. The old navy/white dashboard look remains the declared anti-reference, and so does every generic blue-dark theme.

Honesty is the visual engine, inherited from the product: the honest total is the loudest thing on the screen, tables are carried by alignment instead of grid lines, and when data is stale the world says so with a stamp, not a shrug. Nothing floats; nothing lifts. Depth is one paper step at a time, and character comes from the hand — badges and slips are slightly tilted, like something actually stamped onto the file.

**Key Characteristics:**
- Kraft desk, manila folders, receipt-paper sheets, brown-black ink, one stamp red.
- Two typographic voices: Courier Prime (the typewriter) carries the printed stationery; system-ui carries the workhorse UI.
- Tabular figures on every amount — columns of money align like a ledger.
- Folder tabs everywhere: navigation, month picking, and card tops all use the same tab vocabulary.
- Rule-light tables: hairlines only where meaning demands; alignment does the work.
- The membrete total — a large typewriter figure under a ruled stationery line — is the loudest honest element on any screen.
- Dark mode is one warm lamp over the open folder; no blue-dark exists.
- Mobile (≤640px) is the drawer edge: manila bottom bar, folder tabs at thumb reach, 44px targets.

## Colors

A warm archival palette: three papers, one ink, one stamp red, and semantic tints mixed from the same brown-black base — in both themes.

### Primary
- **Kraft Ground** (light #cbb490 / dark #171208): the desk. Body background, header backdrop, and the `theme-color` meta (dark: #171208). Content never sits directly on it except the header; cards carry the work.
- **Manila Folder** (light #ecd9ac / dark #241c11): card faces — the folder front. Default card background, active desktop tab fill, mobile bottom bar.
- **Receipt Paper** (light #faf6ec / dark #2e2415): the sheet you write on. Inputs, `--card--sheet` surfaces, chart cards, chips, the confirm slip. The separate token **Receipt White** (light #faf6ec / dark #f0e6d2) is the pale ink used as text on ink-filled buttons and danger buttons.
- **Ink** (light #2b241a / dark #f0e6d2): brown-black reading ink — all primary text, table-header rule, active chips, chart lines. In dark mode it flips to warm lamp-lit cream.

### Secondary
- **Stamp Red** (light #a63d2f / dark #e08570): the only accent, and it means *stamped*: destructive buttons (Borrar), state stamps (OVER, VENCIDO), stale-card borders, the keyboard focus ring, and text selection. It is never a link color.
- **Warning Brown** (light #754c10 / dark #d9a05e): REFERENCIA ANTIGUA stamps on Warning Tint (light #e6cfa0 / dark #3a2d18).

### Neutral
- **Muted Ink** (light #514533 / dark #a89877): secondary text — table headers, folder labels, meta, quiet figures, disabled text. Tuned darker than the seed hex (#6b5d48) to hold the 4.5:1 body floor on both card and ground.
- **Hairline** (light #b39a6b / dark #3f3421): every 1px border — cards, fields, folder tabs, group edges, scrollbar.
- **Danger Tint** (light #f0d9cb / dark #3a221a): error-box ground with Error Border (light #cf8d7c / dark #6e4437) and stamp-red edge.
- **OK Tint** (light #e2d2a4 / dark #332a18): success-box ground; its text is ink, deliberately not green and not red.
- **Disabled Manila** (light #d9c49a / dark #3a3020): disabled primary buttons, with muted ink text — never a faded ink fill.

### Named Rules
**The Red-Is-a-Stamp Rule.** Stamp red means a stamp was applied: a destructive act (Borrar), a warning state (OVER, VENCIDO), or keyboard focus. Action links and navigation are ink underlines, never red — a red link never sits beside a red Borrar. On the first viewport, the only red is Borrar.

**The Three-Papers Rule.** A surface is exactly one of: desk (ground), folder (card), or sheet (receipt). Fields, chips, and slips are always sheet; cards are manila unless they *are* a sheet (`card--sheet`). No surface invents a fourth paper, and no surface is pure white.

**The Warm-Dark-Only Rule.** The only dark is lamp-warm brown-black. No navy, no blue-dark, no gray-dark clone: night is the same archive under different light, luminance and hue inverted together.

## Typography

**Typewriter Voice:** Courier Prime, self-hosted (400/700, latin + latin-ext woff2, `font-display: swap`), fallback 'Courier New', monospace.
**Workhorse Voice:** system-ui stack (system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif).

**Character:** a two-voice split. The typewriter speaks anything that could be typed onto paper — headings, folio numbers, amounts, dates, table headers, badges, tabs, folder labels, the membrete. The system stack carries everything that is furniture, not stationery — body rows, form labels, meta lines, helper text. A reader can tell the printed record from the interface at a glance.

### Hierarchy
- **Display** (Courier Prime, 700, 2rem → 1.6rem mobile, line-height 1.2, tabular): the membrete total only. The loudest text in the app.
- **Headline** (Courier Prime, 700, 1.05rem, 0.02em): card and page headings.
- **Title** (Courier Prime, 700, 0.95rem, 0.06em uppercase): the membrete label; the login gate h1 sits at 1.25rem.
- **Folio Figure** (Courier Prime, 700, 0.8–1.3rem, tabular): amounts (row amounts 0.95rem bold), indicator values (1.3rem), dates (0.85rem), folio numbers (0.8rem).
- **Body** (system-ui, 400, 0.9rem): table rows and general reading; inputs at 0.95rem, 16px on mobile to prevent iOS focus-zoom.
- **Label / Stamp** (Courier Prime, 700, 0.72rem, 0.06–0.08em, uppercase): table headers, folder tabs (0.8rem), badges and freshness stamps (0.7rem), folder labels (0.8rem, 0.06em). Form labels are the workhorse exception: system-ui 0.8rem, sentence case.

### Named Rules
**The Two Voices Rule.** If it could be typed onto the folder or stamped onto it, it is Courier Prime. If it is interface furniture, it is system-ui. Never swap the voices: no system-ui headings, no monospace helper paragraphs.

**The Tabular Money Rule.** Every rendered amount — totals, row amounts, indicator values, conversion previews, rate cells, tooltip values — carries `font-variant-numeric: tabular-nums`. Columns of money align; digits never wobble.

**The Loudest-Honest-Total Rule.** The membrete total (2rem/700 typewriter, tabular) is the loudest element on any screen. Supporting text never outshouts the number it supports, and the total is never decorated — its size *is* the honesty.

## Layout

A single centered column, max-width 900px, sitting on the kraft desk with 1.5rem top margin. The page is a stack of folder faces: money card (the membrete), entry sheet, ledger, each a card with 1rem padding and 1rem bottom margin.

The transaction form is a responsive grid (`repeat(auto-fit, minmax(140px, 1fr))`, 0.75rem gap) with a full-width action row. Indicators are a wrapping grid of file cards (min 180px, 1.25rem/0.75rem gap). Spacing rhythm is quarter-based: 0.25–0.5rem inside rows, 0.75–1rem within cards, 1.5–2.5rem between total figures. The login gate is a closed folder centered at 420px with 3rem top margin.

**Folder tabs are the navigation vocabulary in all three places they appear**, with one shared geometry (square top corners, transparent inactive state, hairline border only on the active tab):
- *Header tabs* (desktop): full names, active = manila fill.
- *Month tabs*: beside the compact month input; the active month is the pulled tab — taller (extra 0.2rem top padding), sheet fill, ink label. The input remains for arbitrary picks.
- *Mobile drawer edge* (≤640px): header tabs hide; a fixed manila bottom bar takes over with the short stamped labels (TRANS., CATEG., PRESUP., RESÚM., INDIC., INVERS.), safe-area inset, and the active tab as the pulled one (sheet fill, flush to the bar's lip).

At ≤640px: cards slim to 0.75rem padding, tables scroll horizontally inside their card (the actions cell stays sticky, painted in its card's paper), the form goes single-column, and every interactive target grows to 44px min-height with 16px input text. Main gains bottom padding for the bar plus the safe-area inset. Tabs stay mounted but hidden at every width.

## Elevation & Depth

Nearly flat, with one whisper: the world's depth is the paper stack (desk → folder → sheet), not shadows. Cards carry one shared token — `0 1px 2px rgba(43,36,26,0.14)` (dark: `0 1px 3px rgba(0,0,0,0.5)`) — plus their hairline border. The mobile bottom bar lifts with the same shadow reversed (`0 -1px 3px`). Nothing elevates on hover.

Depth after dark is *lighting*, not shadow: one fixed radial gradient — `radial-gradient(160% 90% at 50% 0%, rgba(255,196,110,0.16), rgba(255,196,110,0.04) 45%, transparent 75%)` — lays lamp light over the open folder, and cards catch a faint warm gradient at their top edge (alpha ≤0.06 so ink keeps ≥4.5:1). The lamp is static world lighting, not motion and not decoration; it is intentionally not gated on reduced-motion.

### Named Rules
**The One Lamp Rule.** Dark mode has exactly one light source: the warm radial over the open folder. It never moves, never pulses, and never gains a second source or a cool tint.

## Shapes

Two-radius form language with a tab and a stamp: cards are gently curved (12px); buttons, fields, error/success boxes, and tooltips are moderately curved (6px); chips are tight (4px); stamps are nearly square (3px). Folder tabs and bottom-bar tabs have square bottom corners (`6px 6px 0 0`), and every decorative card tab is a small 2.4rem × 9px block with `4px 4px 0 0` corners rising 9px above its card — same geometry on the membrete, each indicator card, and the login cover.

Borders are the single 1px hairline, with two deliberate heavier strokes: the 2px `currentColor` border of every stamp (badges, freshness stamps, the round theme toggle), and the 1px ink rule under table headers (semantic, not decorative). The signature gesture is the hand-tilt: stamps rotate −1.5deg, the theme toggle −6deg, the confirm slip −0.6deg — evidence of a hand, never enough to hurt legibility.

## Components

### Buttons
- **Shape:** 6px radius; flat, no border, no shadow.
- **Primary (the stamped impression):** ink fill with receipt-white text (light #2b241a/#faf6ec; dark #f0e6d2/#241c11), 600, padding 0.5rem 1rem. Hover deepens (light #443826; dark #d8cbae). Disabled turns neutral warm (#d9c49a/#3a3020) with muted text — never faded ink.
- **Danger (the red stamp):** stamp red fill, receipt-white text, compact padding (0.35rem 0.8rem); hover adjusts brightness only. One style everywhere (row Borrar, category delete).
- **Link:** borderless underlined ink text at 0.85rem, 1px underline (thickens to 2px on hover), 3px offset. Muted variant for navigate/cancel (Editar, Cancelar); the muted logout sits at the header's end. Red is never a link color.

### Stamps (badges)
- **Style:** uppercase Courier Prime 700, 0.72rem (freshness pair 0.7rem), 0.08em letterspacing, 2px `currentColor` border, 3px radius, rotated −1.5deg, `white-space: nowrap`.
- **Variants:** `over` = stamp red; `ok` = ink; VENCIDO = stamp red; REFERENCIA ANTIGUA = warning brown. Color only — the tinted grounds live in the success/error boxes, not the stamps.

### Chips (range chips)
- **Style:** little receipt slips — sheet fill, 1px hairline, 4px radius, Courier Prime 700 at 0.75rem, padding 0.2rem 0.7rem.
- **State:** active = ink fill with manila text, ink border. No pills, no rounded-full anywhere.

### Cards / Containers
- **Corner Style:** 12px radius.
- **Background:** manila by default; sheet for chart cards and written-on surfaces. Dark cards carry the faint lamp gradient at the top edge.
- **Shadow Strategy:** the single shadow token; see Elevation & Depth.
- **Border:** 1px hairline; stale indicator cards swap the border to stamp red.
- **Card tab:** the 2.4rem × 9px folder tab, background merged with the card below, on the membrete, every indicator card, and the login cover.
- **Internal padding:** 1rem (0.75rem mobile); indicator cards 0.75rem 1rem.

### Inputs / Fields
- **Style:** one printed-field baseline for every input and select: sheet fill, 1px hairline, 6px radius, 0.95rem ink text, 0.45rem padding. Labels are 0.8rem, stacked above with a 0.25rem gap. Decimal/date/month inputs read in the typewriter voice with tabular figures. Selects and checkboxes use ink accent-color; the caret is ink.
- **Focus:** system-wide 2px stamp-red outline, 2px offset on `:focus-visible`. Single exception: the login form uses a 2px ink ring instead, because autofocus lands on the untouched passphrase and red would read as an unexplained error — stamp red stays reserved for real errors.
- **Error / Disabled:** errors surface as a receipt sheet with stamp-red edge (danger text on danger tint, 6px radius, role="alert"); field strokes stay hairline. Disabled controls drop to 45% opacity.
- **Mobile:** 16px text and 44px min-height everywhere (no iOS focus-zoom).

### Tables (fojas — signature)
The transaction ledger and all alignment tables (summaries, budget caps) are carried by alignment, not grid: left-aligned columns, tabular figures, no vertical lines, no zebra. Hairlines appear only where meaning demands — the 1px **ink** rule under the header row and the hairline group edge under the last row. Each foja opens with its folio number (zero-padded, Courier Prime 700, muted, `aria-hidden` — decoration out of the a11y tree) beside the tabular date. Sorting lives in a 44px ghost button inside the Monto header with an ↕/↑/↓ indicator, announced by a muted hint line and an ink "Restablecer orden" link.

### Navigation
- **Desktop:** transparent header directly on the desk — membrete h1 in Courier Prime 700 at 1.15rem, theme toggle (round ink stamp, 2.5rem, rotated −6deg, turns stamp red on hover), header tabs, muted Salir link at the end.
- **Mobile (≤640px):** the manila drawer edge — fixed bottom bar, hairline top border, reversed whisper shadow, safe-area inset, uppercase Courier Prime short labels, 44px targets, active tab as the pulled folder tab.

### The Membrete (signature)
The printed folder header on the money card: a ruled stationery line (hairline bottom border) with the uppercase muted label at left and the tabular period at right, then per-currency totals — 0.8rem muted currency label above the 2rem/700 typewriter figure. On load it stamps in and settles: a 0.45s scale 1.05 → 0.995 → 1 settle with exponential ease-out, gated on `prefers-reduced-motion: no-preference`, from an already-visible default. The honest total is the thesis made visible.

### The Inline Confirm Slip (signature)
Destructive confirmation happens in the row, never a modal: a question at 600 ("¿Borrar la transacción?") with a muted consequence note, a red Borrar, a muted Cancelar — and the *tira de prueba*: a receipt slip showing exactly what will be removed, quiet typewriter fields on sheet paper, tilted −0.6deg, marked `aria-hidden` as a decorative duplicate of the row beside it.

### Charts
Ink line on receipt paper: chart cards use the sheet surface, the line is ink (`stroke: var(--ink)` overriding recharts presentation attributes), grid is hairline, ticks are muted, and the tooltip is a small sheet slip with typewriter date and bold tabular value. Range chips are receipt slips. No accent color ever enters a data line.

## Do's and Don'ts

### Do:
- **Do** speak in two voices: Courier Prime for anything printed onto the file, system-ui for interface furniture.
- **Do** set every amount in tabular figures, bold in the typewriter voice, loudest at the membrete total (2rem/700).
- **Do** reserve stamp red for stamps: Borrar, OVER/VENCIDO, stale borders, and the focus ring. Links are ink underlines.
- **Do** use the folder-tab vocabulary for navigation, month picking, and card tops — same geometry everywhere.
- **Do** keep tables rule-light: ink rule under the header, hairline at the group edge, alignment for everything else.
- **Do** tilt stamps and slips slightly (−0.6° to −6°) and keep it subtle.
- **Do** keep night as one warm lamp: radial glow, warm-tinted cards, no second light source.
- **Do** keep 44px targets, 16px mobile inputs, and the 4.5:1 muted-text floor (#514533 light / #a89877 dark).

### Don't:
- **Don't** use red for links, navigation, success, or decoration — red means a stamp was applied, nothing else.
- **Don't** invent a fourth surface: the world is desk, folder, and sheet. No pure white, no cool gray.
- **Don't** grid a table or add zebra rows — if a line doesn't carry meaning, it doesn't get drawn.
- **Don't** let anything outshout the membrete total, and don't decorate the total — its size is the honesty.
- **Don't** flatten the hand: stamps without the tilt are labels, and labels are another UI.
- **Don't** ship a blue-dark or gray-dark theme; night is lamp-warm or it is not this product.
- **Don't** animate into the world: the stamp-settle on the membrete is the only entrance animation, and it respects reduced-motion.

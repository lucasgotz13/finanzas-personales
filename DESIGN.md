---
name: Finanzas Personales
description: "La billetera — warm-paper personal finance tracker where money is always the loudest thing and one green means action."
colors:
  action: "#0e7a3d"
  action-hover: "#0b6634"
  danger: "#b3261e"
  danger-hover: "#8f1c16"
  danger-bg: "#fdecea"
  error-border: "#f5c6c0"
  warn: "#b45309"
  warn-bg: "#fff4e5"
  ok-bg: "#eef2ee"
  ink: "#1a1815"
  muted-text: "#595959"
  ground: "#f7f5f0"
  card: "#ffffff"
  hairline: "#e8e4dc"
  disabled-bg: "#d9d5cc"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    fontFeature: "tnum"
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 600
    fontFeature: "tnum"
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
rounded:
  md: "8px"
  lg: "12px"
  full: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    typography: "{typography.title}"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.disabled-bg}"
    textColor: "{colors.muted-text}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.35rem 0.8rem"
  button-danger-hover:
    backgroundColor: "{colors.danger-hover}"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.action}"
    typography:
      fontSize: "0.85rem"
      fontWeight: 400
  button-link-muted:
    backgroundColor: "transparent"
    textColor: "{colors.muted-text}"
  input-field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.45rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
  chip-ok:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
  chip-danger:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger}"
    rounded: "{rounded.full}"
  chip-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn}"
    rounded: "{rounded.full}"
  nav-tab-active:
    textColor: "{colors.ink}"
    typography:
      fontWeight: 700
  money-total:
    typography: "{typography.display}"
---

# Design System: Finanzas Personales

## Overview

**Creative North Star: "La Billetera"** — the Argentine fintech screen language for the owner's own money: the money is always the loudest thing, one saturated action color exists only where something can be done, and state lives in chips.

The world is a calm warm-paper workspace: a near-black warm ink on a light paper ground (#f7f5f0) with white cards floating on it, quiet hairlines instead of loud table grids, and a single saturated green that is reserved for the moment of action. The old navy/white dashboard look is the declared anti-reference — this world refuses the generic dashboard table sea.

Loudness is managed, not flat: numbers scale up by role (month totals the largest, list amounts next, meta smallest) and every amount sits on tabular figures so columns of money align like a ledger. Status never borrows the action hue: freshness and budget health live in small uppercase pills on tinted grounds. On phones the navigation drops to a fixed bottom bar at thumb reach, and destructive choices confirm inline in the row rather than in a modal.

**Key Characteristics:**
- Money is the loudest thing: tabular figures on every amount, bold at list level, largest at totals.
- ONE saturated green; it appears only where something can be done.
- State lives in chips: pill badges carry over-budget, freshness, and reference-age status.
- Warm paper ground, white cards, warm near-black ink; calm light theme for day and night scanning.
- Flat depth: hairline borders plus a whisper shadow; nothing ever lifts on hover.
- Bottom-bar navigation at thumb reach on phones (≤640px).

## Colors

A warm neutral system with one saturated action accent and a semantic red/amber chip palette; everything else is paper and ink.

### Primary
- **Action Green** (#0e7a3d): the system's single saturated color. Used only for things the owner can do: the Guardar submit button, destructive-free action links (Renombrar, Restaurar), and the :focus-visible keyboard outline (2px, 2px offset). It also appears as hover darkening (#0b6634).
- **Action Green Hover** (#0b6634): darken on hover/active for green controls.

### Status (semantic, chip and message grounds)
- **Danger Red** (#b3261e): destructive intent — Borrar buttons, over-budget badge text, error boxes. Hover darkens to #8f1c16.
- **Danger Tint** (#fdecea): ground for danger chips, error boxes, and stale cards (border #f5c6c0).
- **Warning Amber** (#b45309): REFERENCIA ANTIGUA (aged data) chip text, on Amber Tint (#fff4e5).
- **OK Gray-Green Tint** (#eef2ee): ground for the "ok" chip and success box; its text is ink, deliberately NOT the action green.

### Neutral
- **Warm Ink** (#1a1815): primary text, card titles, active navigation. The warm near-black that carries all reading.
- **Warm Muted Ink** (#595959): secondary text — table headers, form labels, currency labels, meta, rate cells, muted links. Contrast-AA on both ground and card.
- **Warm Paper** (#f7f5f0): the ground. Body background, header backdrop, theme-color; the calm light surface for day and night scanning.
- **Card White** (#ffffff): every surface that sits on the paper — cards, form fields, the mobile bottom bar.
- **Warm Hairline** (#e8e4dc): 1px borders on cards, fields, and table row separators; header underlines (2px, ink) are the exception.
- **Disabled Warm Gray** (#d9d5cc): disabled primary buttons, with muted ink text — the action hue is for actionable buttons only, never a faded green.

### Named Rules
**The One Green Rule.** The action green is the only saturated accent in the system, and it means one thing: something can be done here. It is never used for status (the OK chip is ink on gray-green), never for location (active nav is ink, not green), and never for disabled controls (gray-warm instead). On the first viewport it appears on Guardar only.

**The State-in-Chips Rule.** Status is never painted with the action hue. Budget health, freshness, and reference age live in small uppercase pills on tinted grounds: red for over-budget or VENCIDO, amber for REFERENCIA ANTIGUA, ink-on-gray-green for OK.

**The Active-Is-Ink Rule.** The current navigation location is bold ink with a 2px ink underline (bottom-border on desktop tabs, top-border on the mobile bar) — a state, not an action. Green marks what you CAN do, ink marks where you ARE.

## Dark (night)

One dark theme exists: **"La Billetera de noche"** — the same warm world after dark, not a new brand. Warm paper becomes warm near-black, white cards become warm charcoal, hairlines step one shade lighter, and ink flips to warm light. The navy/blue-dark dashboard look remains the declared anti-reference: there is no blue-dark option and no third theme.

The theme follows the system on first visit (`prefers-color-scheme`) and the header toggle flips it manually; the choice persists in `localStorage` (`finanzas-theme`) and an inline head script applies it before first paint, so there is never a flash of the wrong theme.

### Tokens (night values)

- **Warm Light Ink** (#f2ede2): text, card titles, active navigation — the night reading ink.
- **Warm Muted Light** (#b3ac9d): secondary text; AA on the dark card.
- **Warm Night Ground** (#1a1815): the ground; body background and theme-color in dark.
- **Warm Charcoal Card** (#262219): every surface that sits on the night ground.
- **Night Hairline** (#3a352b): 1px borders on cards, fields, and row separators.
- **Action Green** (#0e7a3d) and hover (#0b6634): filled buttons unchanged.
- **Action Link Light** (#58c46f): action link text and the :focus-visible outline in dark.
- **Danger Light** (#e57373) on **Danger Night Tint** (#3a2320), border **#6e3b35**.
- **Warning Light** (#e0a458) on **Warning Night Tint** (#3a2f1e).
- **OK Night Tint** (#232b23); its text stays the night ink.
- **Disabled Night** (#3a362e): disabled primary buttons.
- **Night Whisper** (`0 1px 3px rgba(0, 0, 0, 0.45)`): the one shadow token after dark.

### Named Rules

**The One Green Rule (night amendment).** Filled action buttons keep the saturated green with white text — the green means "something can be done" in both themes. Link text and the focus outline switch to a lighter green (`--action-link`, #58c46f) so action text keeps AA contrast on the dark card; in the light theme the token equals the action green itself, so one rule covers both.

**The Warm-Night-Only Rule.** The only dark is the warm one. No navy, no blue-dark, no gray-dark clone: dark mode is the same palette and the same role structure, luminance inverted.

**Chips after dark.** Status tints darken with the ground (danger #3a2320, amber #3a2f1e, ok #232b23) and their text lightens (#e57373, #e0a458) to hold contrast on the darker tints. The ok chip stays ink-on-tint — state never borrows the action hue, in either theme.

**Charts after dark.** The chart ink line flips to the warm light ink via CSS overrides on the recharts classes (`stroke: var(--ink)`); grid stays hairline and ticks muted. The action green still never appears in a data line.

## Typography

**Body Font:** system-ui stack (system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif). No custom fonts are loaded; the system's character comes from weight, size, and numerals, not typeface.

**Character:** a quiet utility face where money speaks through structure — tabular figures on every amount, weight steps that ladder the hierarchy, and uppercase set only inside the tiny status pills.

### Hierarchy
- **Money Totals** (700, 1.5rem → 1.4rem mobile, line-height 1.2, tabular): the per-currency month totals. The loudest text on screen — money is always the loudest thing.
- **Indicator Values** (600, 1.35rem → 1.2rem mobile, tabular): the big number on each indicator card, with a 400, 0.8rem unit suffix.
- **Title** (600, 1rem): row amounts in the transaction list (with −/+ sign), card section headings. The money-card heading is the same size but muted — it introduces, it never competes.
- **Body** (400, 0.9rem): table rows and general reading; form inputs sit slightly larger (0.95rem, 16px on mobile to prevent iOS focus-zoom).
- **Label** (600, 0.8rem): table headers, form labels, currency labels; buttons at 1rem/600; link-buttons at 0.85rem.
- **Chip / Meta** (600, 0.75rem — 0.7rem for VENCIDO/REFERENCIA ANTIGUA, uppercase): status pills; updated/ref lines at 0.75rem.

### Named Rules
**The Tabular Money Rule.** Every rendered amount — totals, row amounts, indicator values, the live conversion preview — is set with `font-variant-numeric: tabular-nums`. Columns of money must align; digits never wobble.

**The Loudness Ladder Rule.** Money loudness is fixed by role, not by context: totals (1.5rem/700) > indicator values (1.35rem/600) > row amounts (1rem/600) > quiet meta (0.8rem muted). Supporting text never outshouts the number it supports.

## Layout

A single centered column of cards, max-width 900px, on the paper ground. The page flows as stacked sections: money card, entry card, list card — each a white card with 1rem padding, 1rem bottom margin, and a 1rem rounded corner.

The transaction form is a responsive grid (`repeat(auto-fit, minmax(140px, 1fr))`) with a 0.75rem gap; its action row spans the full width. The indicators page is a wrapping card grid (min 180px per card, 0.75rem gap). Spacing rhythm is tight and quarter-based: 0.25–0.5rem inside rows and labels, 0.75–1rem between sections and inside cards, 1.5–2.5rem between total figures.

At the ≤640px breakpoint the layout surrenders to the phone: header stacks and the bottom bar owns navigation, the form goes single-column, cards slim to 0.75rem padding, tables scroll horizontally inside their card, and every interactive target grows to 44px min-height with 16px input text (no iOS focus-zoom). The main column gains bottom padding for the fixed bar plus the safe-area inset.

## Elevation & Depth

Flat by design: depth is the single step from paper to card. Cards carry one shared whisper shadow (0 1px 3px rgba(26, 24, 21, 0.06)) plus their hairline border; the mobile bottom bar lifts with the same whisper reversed (0 -1px 3px). Nothing elevates on hover, nothing casts ambient shadow, and state changes express themselves through color, not depth.

### Shadow Vocabulary
- **Whisper** (`0 1px 3px rgba(26, 24, 21, 0.06)`): the only shadow token. Cards and the bottom bar (reversed, `0 -1px 3px`).

### Named Rules
**The Whisper-Only Rule.** One shadow token, one depth step. Elevation never grows on hover, and a surface is never more than one hairlined step off the paper.

## Shapes

A two-radius form language plus the pill: cards and indicator cards are gently curved (12px); buttons, fields, error/success boxes, and inline inputs are moderately curved (8px); all chips and badges are fully rounded pills (999px). Borders are the single 1px warm hairline (#e8e4dc), used on cards, fields, and table row separators; the only 2px strokes in the system are the ink navigation underlines (state, not shape) and the focus-visible outline. Nothing is clipped, no corner is sharper than 8px.

## Components

### Buttons
- **Shape:** 8px radius; flat (no shadow, no border).
- **Primary:** Action Green (#0e7a3d) with white text, 600, padding 0.5rem 1rem. Hover darkens to #0b6634. Disabled turns warm gray (#d9d5cc) with muted text — never a faded green. 44px min-height on mobile.
- **Danger:** Danger Red (#b3261e), white text, compact padding (0.35rem 0.8rem); hover #8f1c16. One consistent danger style everywhere (row Borrar, category delete).
- **Link:** borderless, underlined text button at 0.85rem. Green (#0e7a3d) when it performs an action (Renombrar, Restaurar); muted (#595959 → ink on hover) when it navigates or cancels (Editar, Cancelar). Green on the first viewport is Guardar only.

### Chips
- **Style:** fully rounded pills (999px), uppercase, 600, 0.75rem (0.7rem for the freshness pair), tight padding (0.1rem 0.5rem), `white-space: nowrap`.
- **Variants:** `over` = danger text on danger tint; `ok` = ink on gray-green tint (never the action green); VENCIDO = danger on danger tint; REFERENCIA ANTIGUA = amber on amber tint.

### Cards / Containers
- **Corner Style:** 12px radius.
- **Background:** Card White (#ffffff).
- **Shadow Strategy:** the single Whisper token; see Elevation & Depth.
- **Border:** 1px Warm Hairline (#e8e4dc).
- **Internal Padding:** 1rem (0.75rem on mobile), 1rem bottom margin; indicator cards slightly tighter (0.75rem 1rem).
- **Stale state:** a stale indicator card swaps its border to the error tint (#f5c6c0).

### Inputs / Fields
- **Style:** Card White ground, 1px hairline border, 8px radius, 0.95rem ink text; labels are 0.8rem muted, stacked above the field with a 0.25rem gap.
- **Focus:** system-wide 2px Action Green outline with 2px offset on :focus-visible (WCAG 2.4.7).
- **Error / Disabled:** errors surface as a tinted box (danger text on danger tint, 8px) below the form with role="alert" — field strokes stay hairline, the message does the talking. Disabled controls drop to 45% opacity.
- **Mobile:** 16px text and 44px min-height (no iOS focus-zoom); applies to form fields, inline table/tree inputs, and all buttons.

### Navigation
- **Desktop:** header sits directly on the paper — transparent background, ink title at 1.1rem, underline tabs (0.95rem, muted → ink on hover; active = ink 700 with a 2px ink bottom border).
- **Mobile (≤640px):** the header tabs hide and a fixed bottom bar takes over — Card White, hairline top border, reversed Whisper shadow, safe-area bottom inset, 44px targets, 0.8rem labels, and the same ink-underline active state drawn as a top border. Page-level filter tabs (Todas/Gasto/Ingreso) scroll horizontally at 44px.

### The Money Card (signature)
The first card on the Transacciones page. A muted 1rem/600 heading ("Total del mes"), then per-currency totals: 0.8rem muted currency label above a 1.5rem/700 tabular figure. The month total is the loudest number on the screen — the thesis made visible.

### The Inline Confirm Prompt (signature)
Destructive confirmations happen in the row, never in a modal: a 600-weight question ("¿Borrar la transacción?") with a 0.75rem muted consequence note, a compact danger button, and a muted cancel link. Light tasks stay light.

## Do's and Don'ts

### Do:
- **Do** set every amount in tabular figures, bold at list level (1rem/600) and largest at totals (1.5rem/700).
- **Do** reserve the action green for actionable elements only — on the first viewport, Guardar is its only home.
- **Do** express status in pills: tinted grounds, uppercase 600 text, ink for OK.
- **Do** mark the active navigation location in bold ink with a 2px ink underline.
- **Do** keep cards flat: hairline border, Whisper shadow, 12px radius, 1rem padding.
- **Do** keep touch targets at 44px and mobile inputs at 16px.
- **Do** keep the warm light ground (#f7f5f0); the old navy/white look is the anti-reference.

### Don't:
- **Don't** use the action green for status, location, or disabled controls — it means "something can be done" and nothing else.
- **Don't** introduce a second saturated accent; the palette is one green, one red, one amber on warm paper.
- **Don't** let money lose its tabular alignment, and don't let supporting text outshout the number it supports.
- **Don't** darken or elevate surfaces for depth — paper and card are the only two steps.
- **Don't** drop the calm light theme for a dark or navy treatment; the world is paper, ink, and one green.

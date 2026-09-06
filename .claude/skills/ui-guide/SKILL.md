---
name: ui-guide
description: Design system for the Campus Assistant — tokens, typography, component rules, motion and responsive behaviour. Invoke before writing or editing ANY frontend file under web/src, before adding a screen or component, and before choosing any colour, font size, spacing value, or breakpoint. Also use when a UI change "looks off" and you need the canonical rule.
---

# Campus Assistant — UI System

Full rationale lives in `docs/UI_GUIDE.md`. This is the working checklist.

> **Rebuilt 5 September 2026 from the owner's reference designs in
> `screenshots/`.** If you remember this project as "white page, orange→pink
> gradient, glass surfaces, floating cards, motion everywhere" — that system is
> **gone**. Do not restore any part of it. Flat pastel blocks on a warm-grey
> ground, one typeface, no gradients.

## Before you write a component

1. Use a token from `web/src/styles/theme.css`. A hardcoded hex, px spacing or
   px radius in a component file is a defect.
2. Check `web/src/components/` — the primitive probably exists:
   `Button` `Card` `Stat` `Badge` `Note` `Field` `Table` `Modal` `Tabs`
   `PageHead` `EmptyState` `Skeleton` `FilePicker` `Calendar` `WeekStrip`
   `Logo` `Icon` `BarChart` `LineChart` `DonutChart` `Progress` `Reveal`
   `Counter` `Frame` `JourneyPath`.
3. Build the 375px layout first, then widen.

## The palette, and what each colour means

Ground `--bg #F5F5F4` · blocks `--surface #FFFFFF` · text and emphasis
`--ink #202124`.

Four pastel families, opted into with `.tone-lime` / `-lavender` / `-peach` /
`-sky`, which set `--tone`, `--tone-soft`, `--tone-edge`, `--tone-ink`:

- **Lime** `#DAF39F` — the accent: active nav, selected date, progress fill,
  headline highlighter, "on track".
- **Sky** `#CDE8F7` — citations and documents, everywhere.
- **Lavender** `#EBD3FF` — labs and practicals.
- **Peach** `#FFDEB0` — needs attention, not yet failing.

## The rules that get broken most

- **Lime is a background, never text.** On white it is 1.3:1. Text on lime is
  `--ink`; lime-family text on white is `--lime-ink`.
- **The primary button is ink, not lime.** Lime marks state; ink is the action.
  `variant="accent"` is only for a primary action on an ink panel.
- **One typeface — Manrope.** There is no `--font-display`/`--font-heading`/
  `--font-body`; those tokens were deleted so nobody reintroduces a second face
  by reaching for a name that still resolves. Hierarchy is weight + size.
- **`--s5` (24px) is the default padding and gap.** Reaching for `--s3` is why
  a screen ends up feeling cramped.
- **No gradients.** The one exception is the area fade under the line chart.
- **Nothing loops while idle.** No float, drift, marquee or pulse keyframes —
  they were deleted, not left unused.
- **Nothing renders initials as a logo.** The brand mark is the ghost in
  `components/Logo.jsx`.
- **Cards do not cast shadows.** Only the modal, drawer, dropdown and
  back-to-top do; a card gets a 1px `--border`.

## Overlays must be portalled

`Modal` and both drawers render into `document.body` via `createPortal`.
`position: fixed` resolves against the nearest transformed/animated ancestor,
and `.content` is animated — so an in-place backdrop covers the content box
rather than the viewport. That was a real, reported bug. Any new overlay
portals too.

## Navigation is fixed by decision, not by preference

- The desktop sidebar is **permanent**. No collapse toggle, no persisted
  collapsed state.
- Below 960px: topbar + hamburger → left drawer with the **same** list in the
  **same** order. No bottom tab bar, no "More" bucket.
- The drawer must close on navigate, Escape, scrim click **and** on the
  viewport crossing 960px — otherwise it stays mounted holding the scroll lock.

## Breakpoints

560 (dialogs centre, toasts dock right) · 720 (two-up, wider padding) ·
900 (site nav, three-up) · **960 (the app sidebar)** · 1200 (four-up).

Verify at 375px, 768px and 1440px. No horizontal page scroll, ever — wide
tables get `.table-wrap`.

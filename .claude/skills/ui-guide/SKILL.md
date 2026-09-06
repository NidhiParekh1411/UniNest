---
name: ui-guide
description: Design system for the UniNest — tokens, typography, component rules, motion and responsive behaviour. Invoke before writing or editing ANY frontend file under web/src, before adding a screen or component, and before choosing any colour, font size, spacing value, or breakpoint. Also use when a UI change "looks off" and you need the canonical rule.
---

# UniNest — UI System

Full rationale lives in `docs/UI_GUIDE.md`. This is the working checklist.

> **Rebuilt 5 September 2026 from the owner's reference designs in
> `screenshots/`.** If you remember this project as "white page, orange→pink
> gradient, glass surfaces, floating cards, motion everywhere" — that system is
> **gone**. Do not restore any part of it. Flat pastel blocks on a warm-grey
> ground, one typeface.
>
> **Revised later the same day** from `college_ref(2)` and `(6)`–`(11)`. Three
> earlier rules were relaxed *deliberately*, on the owner's instruction. If you
> are about to "fix" one of these, don't:
>
> - **Gradients exist again**, in one role only — see "Where a gradient is
>   allowed" below.
> - **One loop exists**: the landing page's step ribbon. See "Motion".
> - **The brand mark is an owl**, not a ghost. `components/Logo.jsx` is the
>   glyph, `web/public/brand/*.webp` is the illustrated mascot, and
>   `<Mascot>` renders the latter.
> - **Photographs are used**, from `web/public/img/`. See `docs/IMAGES.md`.

## Before you write a component

1. Use a token from `web/src/styles/theme.css`. A hardcoded hex, px spacing or
   px radius in a component file is a defect.
2. Check `web/src/components/` — the primitive probably exists:
   `Button` `Card` `Stat` `Badge` `Note` `Field` `Table` `Modal` `Tabs`
   `PageHead` `EmptyState` `Skeleton` `FilePicker` `Calendar` `WeekStrip`
   `Logo` `Mascot` `Icon` `Marquee` `SubjectRail` `SubjectCard` `CourseMeter`
   `DocumentViewer` `BarChart` `LineChart` `DonutChart` `Progress` `Reveal`
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
- **A gradient is never a surface.** See below.
- **Nothing loops except the ribbon.** No float, drift or pulse.
- **Nothing renders initials as a logo.** The brand mark is the owl in
  `components/Logo.jsx`.
- **Cards do not cast shadows.** Only the modal, drawer, dropdown and
  back-to-top do; a card gets a 1px `--border`.

## Where a gradient is allowed

Exactly one role: a large, soft, out-of-focus wash **behind** a panel. Never on
a button, a card, a border, a chip or text. Three tokens, all mixed only from
the four pastel families so a wash cannot introduce a new colour:

- `--grad-sand` — the sign-in aside.
- `--grad-aurora` — the bloom rising from the bottom of the assistant, behind
  the composer. The composer itself stays a solid white block; an input on a
  gradient is unreadable.
- `--grad-dusk` — an ink panel that needs depth. Currently unused.

Plus `--fade-x-bg` / `--fade-x-surface`, which are masks rather than paint:
they dissolve a horizontally scrolling strip into its background instead of
cutting it off. Match the one to whatever the strip sits on.

If you can see where a gradient starts and stops, it is being used wrongly.

## Motion

Short, mostly opacity and position. Two things are allowed to repeat:

- **The step ribbon** on the landing page (`components/Marquee.jsx`). It holds
  its children twice and animates to `-50%`, so the loop is seamless with no
  measuring. It pauses on hover and on focus-within, and under
  `prefers-reduced-motion` the animation is dropped and it becomes an ordinary
  horizontal scroller — the global reduce rule alone would park it at -50%.
- **A spinner**, while something is genuinely loading.

Staggered entrances (`riseInSoft`) are for a list that arrives as a group —
the assistant's suggestions. Each child sets `--i`; the delay is capped so a
long list never keeps the reader waiting.

## Colour has two jobs, and they must not be mixed

- **Identity.** A subject's pastel comes from `toneFor(index)` in
  `components/SubjectRail.jsx` and stays the same on the dashboard rail, the
  attendance grid and the results grid. This is what stops a page of eight
  subjects reading as one block.
- **Status.** `ok` / `warn` / `bad` mean position against a threshold — 75%
  attendance, 40% marks. They belong on the badge and the meter, and nowhere
  else.

Painting the whole card by status was the fault the owner reported as
"similar colour everywhere": nearly everything is above the line, so nearly
everything was the same green.

## Overlays must be portalled

`Modal`, `DocumentViewer` and both drawers render into `document.body` via
`createPortal`.
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

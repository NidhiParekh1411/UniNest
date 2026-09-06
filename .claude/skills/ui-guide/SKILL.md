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
> - **Nothing loops.** The step ribbon that was the one exception is gone —
>   the six steps sit on a static arc now (`components/ArcSteps.jsx`).
> - **The brand mark is an owl**, not a ghost. `components/Logo.jsx` is the
>   glyph, `web/public/brand/*.webp` is the illustrated mascot, and
>   `<Mascot>` renders the latter.
> - **Photographs are used**, from `web/public/img/`. See `docs/IMAGES.md`.
> - **White text exists**, but only over a photograph, and only through
>   `--on-photo` / `--on-photo-2` with `--veil-photo*` underneath it.

## Before you write a component

1. Use a token from `web/src/styles/theme.css`. A hardcoded hex, px spacing or
   px radius in a component file is a defect.
2. Check `web/src/components/` — the primitive probably exists:
   `Button` `Card` `Stat` `Badge` `Note` `Field` `Table` `Modal` `Tabs`
   `PageHead` `EmptyState` `Skeleton` `FilePicker` `Calendar` `WeekStrip`
   `Logo` `Mascot` `Icon` `ArcSteps` `PhotoFan` `SubjectRail` `SubjectCard`
   `CourseMeter` `DocumentViewer` `Refreshed` `BarChart` `LineChart`
   `DonutChart` `Ring` `Progress` `Reveal` `Counter` `Frame` `JourneyPath`.
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
- **Nothing loops.** No float, drift, marquee or pulse. Motion is a response
  to something the reader did.
- **Colour identifies a subject; it does not fill its card.** A subject's
  pastel is a 5px rail down the edge of a white card plus a tint behind its
  code — see `.subject-card`. Filling the card was tried and reverted: five
  subjects meant five washes of colour and every screen looked the same.
- **A skeleton is only for a screen with nothing on it.** `useApi` distinguishes
  `loading` (nothing yet) from `refreshing` (checking for newer). A refetch
  updates in place through `Refreshed`; it never blanks the page.
- **Nothing renders initials as a logo.** The brand mark is the owl in
  `components/Logo.jsx`.
- **Cards do not cast shadows.** Only the modal, drawer, dropdown,
  back-to-top, an open arc step and a fanned photograph do; a card gets a 1px
  `--border`.
- **A heading with a `.mark` uses `--mark-lh`.** The highlighter is drawn at the
  height of the font's content area no matter what `line-height` says, so
  tighter leading puts the lime block on the line above. This was a real,
  reported bug.
- **`mask-image` reads alpha, not colour.** An edge fade written as a mask goes
  transparent → opaque → transparent (`--fade-x-mask`). Writing it the way you
  would write a paint gradient inverts it and erases the middle of the strip.
  This was also a real, reported bug — twice, in two components.

## Where a gradient is allowed

Exactly one role: a large, soft, out-of-focus wash **behind** a panel. Never on
a button, a card, a border, a chip or text. Three tokens, all mixed only from
the four pastel families so a wash cannot introduce a new colour:

- `--grad-sand` — the sign-in aside.
- `--grad-aurora` — the bloom rising from the bottom of the assistant, behind
  the composer. The composer itself stays a solid white block; an input on a
  gradient is unreadable.
- `--grad-dusk` — an ink panel that needs depth. Currently unused.

Plus `--fade-x-mask`, which dissolves a horizontally scrolling strip into its
background instead of cutting it off. **It is a mask: only alpha counts**, so
its stops run transparent → opaque → transparent. Written the way a paint
gradient would be (page colour at the ends, clear in the middle) it inverts and
erases the middle of the strip — which is what emptied the step ribbon and the
whole "My subjects" rail at once.

Plus `--veil-photo` / `--veil-photo-strong`, which darken the foot of a
photograph so a caption can stand on it. They are the only reason `--on-photo`
exists.

If you can see where a gradient starts and stops, it is being used wrongly.

## Motion

Short, mostly opacity and position. Nothing loops while idle. The one thing
allowed to repeat is **a spinner**, while something is genuinely loading.

The step ribbon used to be a second exception and is not any more: a diagram of
a six-step process is meant to be read, and a conveyor belt means the step you
want is always the one sliding away. `components/ArcSteps.jsx` lays the six
cards on a static arc instead.

`swapIn` is the entrance `Refreshed` replays when a screen's data is replaced
behind a background refresh — see "Loading versus refreshing".

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

**And identity gets a rail, not a fill.** Swapping status for identity but
keeping the pastel as the card's background was the second version of the same
mistake — five subjects meant five washes of colour and every screen looked
alike. The card is white with a 5px rail of the subject's colour and a tint
behind its code.

## Loading versus refreshing

`loading` from `useApi` means "nothing has ever arrived" and goes false for
good after the first response. `refreshing` covers every fetch after it: old
data stays on screen, new data replaces it, and `Refreshed` replays `swapIn`
without remounting — so an open tab or a half-typed field survives. Never show
a skeleton on a refetch; that is what made closing the document viewer look
like a page reload.

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

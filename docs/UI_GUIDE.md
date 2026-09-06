# UI Guide — UniNest

The design system, and why each rule exists. The canonical values live in
`web/src/styles/theme.css`; this file explains them. If the two disagree, the
stylesheet is right and this file is stale — fix it.

> **Rewritten 5 September 2026.** The previous direction — white page, one
> orange→pink gradient, glass surfaces, floating cards, motion everywhere — is
> **void**. Do not restore any part of it from memory. The current system was
> derived from five reference designs the project owner supplied in
> `screenshots/`; `college_ref(1)` carries the literal palette and typeface.

---

## The idea in one paragraph

Flat white blocks on a warm-grey ground, generously rounded and generously
spaced. One typeface. Colour **classifies** rather than decorates: four pastel
families, applied consistently, so a colour on a card means the same thing as
that colour on a chip. Emphasis is ink-black, never saturation. There are no
gradients, no glass, no floating cards, no drifting blobs and no perpetual
animation. A surface either sits on the page or is genuinely above it — a
dialog, a drawer, a dropdown — and only the second kind casts a shadow.

The failure this replaces: a screen where every element competed for attention
through gradient, shadow and motion, so nothing was actually emphasised.

---

## Colour

### The ground and the blocks

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F5F5F4` | the page |
| `--surface` | `#FFFFFF` | cards, the sidebar, the header once scrolled |
| `--surface-2` | `#EFEFEC` | quiet fills — segmented tracks, avatars, table hovers |
| `--border` | `#E7E7E3` | the hairline around a block |
| `--ink` | `#202124` | text, primary buttons, active pills, dark bands |

The page is grey and the cards are white. This is inverted from the old system
on purpose: it is what makes a card read as a *block* without needing a shadow
to lift it off the background.

### The four pastel families

| Family | Fill | Edge | Ink |
|---|---|---|---|
| Lime | `--lime` `#DAF39F` | `--lime-2` | `--lime-ink` |
| Lavender | `--lavender` `#EBD3FF` | `--lavender-2` | `--lavender-ink` |
| Peach | `--peach` `#FFDEB0` | `--peach-2` | `--peach-ink` |
| Sky | `--sky` `#CDE8F7` | `--sky-2` | `--sky-ink` |

A block opts into a family with `.tone-lime` (or `-lavender`, `-peach`,
`-sky`), which sets `--tone`, `--tone-soft`, `--tone-edge` and `--tone-ink`.
Everything inside then reads those variables. That is why `.feature` and
`.aud` never name a colour: the card, its icon chip and its rule all agree
because they read the same three variables.

Where each family is spoken for:

- **Lime** — the accent. Active nav, selected date, progress fill, the
  highlighter behind a headline phrase, "on track" in a chart.
- **Sky** — citations and documents, throughout. A citation card, its index
  chip, and the document tint on the hero demo are all sky.
- **Lavender** — labs and practicals.
- **Peach** — "needs attention" that is not yet a failure.

### Two rules that are easy to get wrong

1. **Lime is a background, never a text colour.** `#DAF39F` on white is 1.3:1.
   Text sitting *on* lime is `--ink`; lime-family text on white is
   `--lime-ink` (`#40631A`, 6.4:1).
2. **The primary button is ink, not lime.** This surprises people, and it is
   what the reference does — the black pill is the action, the lime block is
   the state. `variant="accent"` (lime) exists for one case: a primary action
   sitting on an ink panel, where an ink button would vanish.

---

## Type

**One family: Manrope**, loaded at 400/500/600/700/800. There is no display
face and no secondary UI face. Hierarchy comes from weight and size only, which
is why headings are 800 and not 700 — that extra step is doing the work three
typefaces used to do.

| Token | px | Use |
|---|---|---|
| `--fs-2xs` | 11 | eyebrows, badges, meta |
| `--fs-xs` | 12 | secondary lines, hints |
| `--fs-sm` | 13 | UI default — labels, buttons, list rows |
| `--fs-md` | 14 | body |
| `--fs-lg` | 16 | card titles |
| `--fs-xl` | 19 | modal titles, role headings |
| `--fs-2xl` | 24 | page titles |
| `--fs-3xl` | 30 | stat values, page titles ≥720px |
| `--fs-hero` / `--fs-section` | fluid | public site only |

Headings carry `letter-spacing: -0.025em` and heavier titles go to `-0.04em`.
Numerals that sit in a column get `font-variant-numeric: tabular-nums`.

---

## Space

The 4px grid, `--s1` … `--s9`. **`--s5` (24px) is the default card padding and
the default gap between blocks.** The most common fault in the old system was
reaching for `--s3` where the reference uses `--s5`; if a screen feels
cramped or "overwhelming", that is almost always the cause, not the amount of
content.

Section rhythm on the public site is `--section-y`, which clamps between 56px
and 104px.

---

## Shape and elevation

Radii: `--r-sm` 10 · `--r` 14 · `--r-lg` 20 (cards) · `--r-xl` 26 (dialogs,
auth card) · `--r-2xl` 32 (the CTA band) · `--r-full` (pills, buttons, avatars,
calendar days).

**Buttons and chips are fully round.** Cards are 20px. That contrast — round
controls on square-ish blocks — is the reference's signature.

Shadows exist for four things and nothing else: the modal, the drawer, the
suggestion dropdown, the back-to-top button. A card gets a 1px border instead.
`--shadow-lg` is for something covering the page; there is no `--shadow-accent`
any more.

---

## Motion

Short, and mostly opacity or position. `--t-fast` 130ms, `--t` 220ms,
`--t-slow` 420ms.

Allowed: hover and focus transitions, the page-entrance fade, dialog and drawer
entrances, scroll reveals on the public site, the typing indicator, the
skeleton shimmer.

Not allowed: anything that loops while idle. No `float`, no `drift`, no
`marquee`, no `pulseRing`, no rotating logo. Those keyframes were deleted, not
merely unused — if you find yourself writing one, that is the signal to stop.

Everything is disabled under `prefers-reduced-motion`.

---

## Components

Primitives live in `web/src/components/`. Check before you write:

`Button` `Card` `Stat` `Badge` `Note` `Field` `Table` `Modal` `Tabs`
`PageHead` `EmptyState` `Skeleton` `FilePicker` `Calendar` `WeekStrip`
`Logo` `Icon` `BarChart` `LineChart` `DonutChart` `Progress` `Reveal`
`Counter` `Frame` `JourneyPath`.

### The brand mark

A ghost, drawn in `components/Logo.jsx` as one path with `fill-rule: evenodd`
so the eyes are holes punched through the body rather than shapes painted on
it. That is what lets one mark sit on white, on ink and on lime without a
variant for each — the body inherits `currentColor` and the eyes show whatever
is behind them.

**Nothing renders initials.** A two-letter monogram in a coloured square was
the single clearest "generated" tell on the old landing page.

### Buttons

`primary` (ink) · default (white, bordered) · `ghost` · `accent` (lime, ink
text) · `danger` · `outline-inv` (on ink panels). Sizes `sm` / default / `lg`,
plus `btn-icon` and `btn-block`.

### Tabs are a segmented control

`Tabs` renders `.segmented` — a pill track with an ink pill on the selection,
matching the reference's *All / Mandatory / Completed* row. It replaced an
underlined tab strip. The prop shape (`tabs`, `value`, `onChange`) did not
change, so every existing caller works untouched.

`.content > .segmented` gets `margin-bottom: --s5`, scoped to a direct child so
a segmented control used as a `PageHead` action (the timetable's Day/Week
switch) is not pushed away from its title.

### Dialogs and drawers must be portalled

`Modal` and both drawers render into `document.body` through `createPortal`.
This is not stylistic. `position: fixed` is resolved against the nearest
ancestor with a transform, filter or animation — and every app screen sits
inside `.content`, which is animated. Rendered in place, a `inset: 0` backdrop
covered the *content box* rather than the window. That was the reported
"dialog with a dark background that doesn't cover the screen" bug; the portal
is the fix, and any new overlay must do the same.

---

## Responsive

Breakpoints: **560** (dialogs centre, toasts dock right) · **720** (two-up
grids, wider padding) · **900** (public site nav, three-up grids) · **960**
(the app sidebar) · **1200** (four-up).

The app rail arrives at 960px rather than 900px because it costs 252px and the
content beside it needs room to hold two columns.

### Navigation

**The sidebar is permanent.** There is no collapse control and no persisted
collapsed state — that was removed at the owner's request, and the icon-rail
tooltips went with it.

Below 960px the rail is replaced by a topbar with a hamburger that opens a
left drawer containing the *same* nav list in the *same* order. There is no
bottom tab bar and no "More" bucket any more: one nav, everywhere.

The drawer closes on navigation, on Escape, on scrim click, and on the viewport
crossing 960px. That last one matters — without it the drawer stayed mounted
and invisible on rotation, still holding the body scroll lock, which is what
made the old mobile menu feel broken.

Check every screen at **375px, 768px and 1440px**. Wide tables get their own
`overflow-x: auto` wrapper (`.table-wrap`); the page body never scrolls
sideways.

---

## Charts

Hand-rolled SVG in `components/Charts.jsx` — no charting library. Series
colours are flat pastels: lime above a threshold, peach approaching it, a muted
red below. The single surviving gradient in the codebase is the area fade under
the line chart, which is a legibility device rather than decoration.

Gridlines are `--border`. Axis labels are 11px `--text-3`. The 75% attendance
line is a dashed `--border-strong` rule, not a red one — the *bars* carry the
alarm, and a red line plus red bars is two channels saying one thing.

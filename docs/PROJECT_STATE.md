# Project State — read this first

**Last updated:** 5 September 2026 · **Phase 1 complete · runs with no database · UI redesigned from the owner's references**

If you are a new session picking this up: read this file, then `CLAUDE.md`, then
`docs/REQUIREMENTS.md`. Everything below reflects the code as it actually is, not
as it was planned.

---

## Run it

```bash
npm install
npm run dev       # api :4000, web :5173 — no database required
```

**The app now runs with zero setup.** `lib/db.js` tries MongoDB for three
seconds and falls back to the JSON files in `server/data/` if it is unreachable,
printing which store it chose. To use a real database, set `MONGODB_URI` in
`server/.env` and run `npm run seed`. `DB_DRIVER` forces the choice:
`file` never contacts Mongo, `mongo` requires it and fails loudly without it.

**Stop the server before running `npm run seed` in file mode.** The server holds
the dataset in memory and the seed rewrites the files underneath it. `db.js`
detects the external write and reloads rather than clobbering — but the process
still has to restart to serve the new data.

Records live in MongoDB. `npm run seed` calls `deleteMany({})` on every
collection before inserting, so point `MONGODB_URI` at a scratch database.
The API will not start if the database is unreachable — it prints one line
saying so instead of failing separately on every route.

Then open <http://localhost:5173>. Both sign-in screens offer one-tap demo
accounts, so no credentials need typing.

| Command | What it does |
|---|---|
| `npm run dev` | Runs API and web together with prefixed output |
| `npm run seed` | Wipes and regenerates every collection |
| `npm run eval` | 26-case retrieval/routing/abstention harness |
| `npm run smoke` | 52-assertion end-to-end API test across all three roles (needs `npm run dev` running) |
| `npm run build` | Production build of the frontend |

### Demo accounts — password `demo1234` for all

| Role | Email | Notes |
|---|---|---|
| Student | `ayaan.vyas9@student.college.edu` | CE, semester 5 — the richest data |
| Faculty | `anjali.mehta@college.edu` | The faculty member with the most waiting to be graded |
| Admin | `admin@college.edu` | Full access |

The seed uses a fixed PRNG seed, so these are stable across reseeds. If you change
the generator, `GET /api/auth/demo-accounts` always returns the current set — and
that endpoint is what the sign-in screens call, so the one-tap buttons never go
stale. It deliberately picks the faculty member with the most to look at, so the
demo opens on a full dashboard rather than empty states.

### Seeded data

16 faculty · 72 students · 117 subjects (3 branches × 8 semesters) · 466 timetable
entries · 360 attendance records · 1,800 results · 14 documents / 69 indexed
passages · 45 assignments · 143 submissions · 10 announcements (3 scheduled).

---

## Status by feature

| Requirement | State | Where |
|---|---|---|
| Three roles with scoped access | **Done** — enforced server-side on every route | `server/src/lib/auth.js`, every route file |
| Separate student vs. merged staff login | **Done** — distinct copy and imagery per portal, cross-portal use blocked | `web/src/pages/Login.jsx`, `routes/auth.js` |
| Semester-aware timetables | **Done** — per branch/semester; faculty get a cross-cohort teaching view | `pages/Timetable.jsx`, `routes/academics.js` |
| Faculty↔subject mapping per semester | **Done** — reassignable inline by admin | `pages/SubjectsAdmin.jsx` |
| Attendance charts | **Done** — bar chart vs. the 75% line, donut, per-subject bars, recent-session trail, cohort table | `pages/Attendance.jsx`, `components/Charts.jsx` |
| Results charts | **Done** — SPI trend line, CPI donut, per-subject bars, ranked cohort table | `pages/Results.jsx` |
| PDF / Excel / Word ingestion | **Done** — format-aware extraction, chunking, indexing on upload | `lib/parse.js`, `rag/chunk.js` |
| PowerPoint ingestion | **Done** — dependency-free PPTX reader; slide titles become section headings | `lib/parse.js` |
| Handwritten notes | **Done 5 Sep 2026** — read by the model at upload, chunked and indexed like any other text. Falls back to "stored but not searchable" with no key | `rag/enrich.js` |
| Assignment submission by students | **Done** — any supported format including photos of handwritten work; late flagged | `pages/Assignments.jsx` |
| Faculty grading + feedback | **Done** | same |
| Faculty sharing notes with students | **Done** — upload with branch/semester/subject scoping | `pages/Library.jsx` |
| RAG chat with citations | **Done** — BM25 + scope filter + recency, structural citations with excerpts | `rag/` |
| Abstention ("not found") | **Done** — dual gate (BM25 score + IDF-weighted coverage), 3/3 on the eval | `rag/retrieve.js` |
| Structured vs. document routing | **Done** — 22/22 on the eval, including the "my attendance" vs. "attendance policy" pair | `rag/router.js` |
| Follow-up when underspecified | **Done** — returns selectable options; answering re-runs the original question | `rag/answer.js`, `pages/Assistant.jsx` |
| Keyword suggestion dropdown | **Done** — 11 keyword groups, role-filtered, keyboard navigable | `rag/suggest.js`, `pages/Assistant.jsx` |
| Question-bank agent from PPT/material | **Done** — offline extraction path + Gemini path, always a reviewable draft | `rag/generate.js`, `pages/QuestionBanks.jsx` |
| Scheduled announcements / reminders | **Done** — publish now or at a chosen time; hidden from the audience until due | `routes/announcements.js`, `pages/Notices.jsx` |
| Document versioning | **Done** — an upload can supersede another; superseded content is excluded from answers but browsable by staff | `routes/documents.js`, `rag/retrieve.js` |
| Public marketing site | **Done** — landing (hero photo fan, worked example, step ribbon, masonry features, audiences, CTA) + About with sourced GLS University content | `pages/Landing.jsx`, `pages/About.jsx`, `components/Site*.jsx` |
| Document viewer | **Done 5 Sep 2026** — PDFs and images render; other formats fall back to the indexed passages. AI summary, topics, dates and tags beside it | `components/DocumentViewer.jsx` |
| Account editing | **Done 5 Sep 2026** — the PATCH endpoint existed but nothing called it; admins can now correct name, email, cohort and password | `pages/People.jsx`, `routes/users.js` |
| Visual system | **Rebuilt 5 Sep 2026, revised the same day** — flat pastel blocks (lime/lavender/peach/sky) on a warm-grey ground, Manrope only, ink emphasis. Gradients permitted in one role only (large washes behind a panel). Derived from `screenshots/college_ref(1)–(11)` | `web/src/styles/theme.css`, `app.css` |
| Brand mark | **Done 5 Sep 2026** — an owl. `components/Logo.jsx` is the glyph (one evenodd path, holes for eyes); `web/public/brand/*.webp` is the illustrated mascot from the owner's artwork. No component renders initials | `components/Logo.jsx`, `web/public/brand/` |
| Photography | **Done 5 Sep 2026** — 19 CC0 photographs bundled at 1280w WebP, 879 KB total. Nothing is fetched at runtime | `web/public/img/`, `docs/IMAGES.md` |
| Calendar | **Done 5 Sep 2026** — month grid with prev/next, jump-to-today, per-day session dots; drives the timetable's Day view | `components/Calendar.jsx`, `pages/Timetable.jsx` |
| Responsive web + phone | **Done** — permanent sidebar ≥960px; below that a topbar hamburger opens a left drawer with the same nav list. The collapsible rail, the bottom tab bar and the "More" sheet were all removed | `styles/app.css`, `components/Shell.jsx` |
| MongoDB | **Done** — every collection, indexed | `lib/db.js` |
| Runs without a database | **Done 5 Sep 2026** — file-backed driver behind the same `db` surface, chosen automatically when Mongo is unreachable; guards against clobbering files another process changed | `lib/db.js` |

---

## Architecture in one paragraph

React (Vite) talks to an Express API through a dev proxy, so the frontend uses
relative `/api` URLs and there is no CORS or base-URL config. The API persists to
MongoDB behind `lib/db.js`, the only module that imports the driver. Its methods
are async, so every route and RAG module awaits them; `lib/async-routes.js` wraps
the mounted handlers once at startup so a rejected promise reaches the error
middleware instead of escaping to the process. On upload, a document is parsed by format, split into
overlapping sentence-aligned passages carrying their section heading, and written
to a `chunks` table. On a question, the router decides between a record lookup and
document retrieval; retrieval filters by the caller's scope *before* ranking,
scores with BM25, boosts recency, and refuses to answer unless both the score and
the IDF-weighted term coverage clear their thresholds. Answer text is composed
either extractively (default, no network) or by Gemini (`GEMINI_API_KEY`), and
citations are always returned as structured data the UI renders separately.

---

## Limitations — the honest list

These are known and deliberate, not oversights.

### Blocking for production
1. **No transactions, and writes are not atomic across collections.** Deleting a
   document removes its chunks in a second call; a crash between the two leaves
   orphans. Mongo supports multi-document transactions on a replica set (Atlas is
   one) — `lib/db.js` does not expose them yet.
2. **OCR needs a key.** Handwritten notes, photographed circulars and scanned
   PDFs are read by the model in `rag/enrich.js` and indexed like any other
   text — but only when `GEMINI_API_KEY` is set. With no key they are stored
   and downloadable but invisible to the assistant, and the upload response
   says so explicitly rather than silently indexing nothing. **Fix for a fully
   offline path: Tesseract.js in `lib/parse.js`.**
3. **Passwords use a shared demo value and there is no reset flow.** No email
   verification, no forgot-password, no rate limiting on sign-in.
4. **No file-content validation beyond the extension.** A renamed executable would
   be accepted by the type check (it would fail to parse, but it is stored).
5. **Uploaded files are served by id with a scope check but no signed URLs**, and
   the upload directory is not swept — deleted documents remove their file, but an
   interrupted upload can orphan one.

### Quality ceilings
6. **Retrieval is lexical (BM25), not semantic.** It handles paraphrase through a
   stemmer and a hand-built synonym table, which works well on this corpus but will
   miss genuinely novel phrasings. A student asking about "how many lectures can I
   skip" is handled; one asking in a way that shares no vocabulary with the
   document is not. **Fix: sentence embeddings + a vector store, hybrid with BM25.**
7. **Offline answer composition stitches sentences.** It is accurate — it can only
   quote — but it reads like quotation, not prose. Setting `GEMINI_API_KEY` upgrades
   this immediately with no other change.
8. **Offline question generation needs editing.** On prose lecture notes it produces
   a coherent paper; on a bullet-heavy slide deck it leans on slide titles. This is
   why every generated bank is a draft that a faculty member publishes explicitly.
9. **Mixed-language queries are barely supported.** A handful of common
   transliterations (`hajri`, `pariksha`, `chutti`) are mapped in `rag/tokenize.js`.
   Real Gujarati/Hindi support needs a multilingual embedding model — the deck lists
   this as an open question, and it is still open.
10. **Conversation memory is shallow.** The last three turns are passed to the LLM,
    and follow-ups work through explicit slot overrides rather than true coreference.
    "What about semester 6?" as free text will not resolve; the option chips will.

### Not built
11. **No attendance-marking or result-entry UI.** The API endpoints exist and are
    tested (`POST /api/academics/attendance/mark`, `/results/publish`); no screen
    calls them yet. Faculty currently read attendance and results but cannot write
    them from the interface.
12. **No email or push notification.** Scheduled announcements appear in-app at
    their publish time; nobody is told.
13. **No bulk import.** Timetables, attendance and results cannot be uploaded as a
    spreadsheet, which is how a real college would load them. The Excel parser
    exists and returns structured `tables`, but nothing consumes it for record
    ingestion yet.
14. **No tests beyond the two harnesses.** `npm run eval` covers retrieval quality
    and `npm run smoke` covers API behaviour across roles. There are no component or
    browser tests, and the UI has not been verified in a real browser this session —
    it builds clean and the markup was written against the design system, but
    someone should look at it on a phone.
15. **No audit log.** Who changed a grade, and when, is not recorded.
16. **Timezone handling is naive.** Scheduling uses the browser's local time and
    stores an ISO instant; a college operating across timezones would need care.

---

## Where to go next — suggested order

**Phase 2 — make it real (highest value first)**
1. Attendance-marking and result-entry screens. The endpoints are done; this is
   pure UI and it is the biggest gap between "demo" and "usable".
2. Bulk spreadsheet import for timetables, attendance and results, using the
   `tables` output already produced by `lib/parse.js`.
3. A local OCR path in `lib/parse.js`, so scanned material is searchable
   without a key as well as with one.
4. Multi-document transactions in `lib/db.js` for the delete-document-and-chunks
   path, now that the store supports them.

**Phase 3 — make it good**
5. Semantic retrieval: embeddings alongside BM25, fused by reciprocal rank. Keep
   the abstention gate; re-run `npm run eval` and do not accept a drop in the
   abstention score to buy accuracy elsewhere.
6. Real auth: password reset, rate limiting, optional SSO against the college ID
   system (which also answers the deck's open question about the source of truth for
   branch and semester).
7. Notifications — email or web push — when a scheduled announcement fires, a
   grade is published, or attendance drops below 75%.
8. Multilingual support, if the college confirms it is in scope.

**Still open, needs the client to decide** — the six questions at the end of
`docs/REQUIREMENTS.md`. Numbers 3 (which AI service, given student data privacy)
and 6 (source of truth for branch/semester) both block Phase 3 work.

---

## Where we left off

**4 September 2026 — the UI was rebuilt.** The app now has a public site in
front of it and a new visual language throughout.

What changed:

- **New public layer.** `/` (landing) and `/about` (GLS University), wrapped in
  `SiteLayout` with a sticky glass header whose nav pill follows the cursor, and
  a four-column footer. `/login` and `/staff` are now a centred glass card on a
  gradient field with a segmented portal switch, replacing the old split-screen.
- **New design system.** `theme.css` and `app.css` were rewritten. Gradients,
  glass, elevation and motion are now load-bearing; the previous
  "near-monochrome and flat" direction is gone. `docs/UI_GUIDE.md` and
  `.claude/skills/ui-guide/SKILL.md` were rewritten to match — **read those, not
  your memory of the old ones.**
- **Three type voices**: Bricolage Grotesque (display), Plus Jakarta Sans (UI),
  Inter (body), JetBrains Mono (codes).
- **New primitives** in `components/`: `Reveal` (scroll reveal, count-up
  `Counter`, `useScrolled`, `Frame`), `JourneyPath`, `SiteHeader`, `SiteFooter`,
  `SiteLayout`. Content for the public site lives in `lib/site.js`.
- **Shell** gained a JS-positioned sliding active indicator and a collapsible
  76px icon rail persisted in `localStorage`.
- Every existing app screen was restyled through CSS alone — no page component
  under `pages/` other than `Login.jsx` was touched, because the class names were
  already semantic.

### 5 September 2026 — the app runs with no database

Sign-in was failing because there was no MongoDB on the machine and `db.js`
spoke only to a Mongo driver, so the API exited at startup. `server/data/*.json`
still held a complete dataset from before the migration but nothing read it.

`lib/db.js` now carries **two drivers behind one surface**: the Mongo one, and a
file-backed one that loads `server/data/*.json` into memory and persists writes
back. `connect()` picks between them, and `collection()` dispatches. Rule 3 is
intact — nothing outside `db.js` knows which store is live.

Three things worth knowing:

- **`db` is built at module load, before `connect()` runs.** Its methods
  therefore resolve the driver *at call time*. Binding early pins every route to
  Mongo and the fallback silently never runs — that was the first bug.
- **Rows are cloned on read.** Mongo returns a fresh object every time; without
  cloning, a caller mutating a result corrupts the store, and only in file mode.
- **Concurrent writers are guarded, not solved.** Before persisting, the driver
  compares the file's mtime against what it last saw; if another process wrote
  it, it reloads and discards its own copy rather than resurrecting a stale
  dataset. This is the seed-while-running case, and it is the failure that
  orphaned 63 submissions during this session before the guard existed.

**Verified against the file store:** `npm run smoke` **52/52**, `npm run eval`
**26/26**, and sign-in confirmed for all three roles through the Vite proxy — the
same path the browser takes.

### Still NOT verified: how the UI looks

The new interface has **not been seen rendering in a browser**. Browser tooling
was unavailable. What is verified: the build is clean, every module transforms,
every class name used in JSX resolves to a CSS rule, and the app serves HTTP 200.
What that does not cover is appearance. **Open it at 375px, 768px and 1440px
before showing it to anyone.**

### Also new

- `docs/DATABASE_SETUP.html` — a step-by-step MongoDB Atlas guide written for the
  project owner, in plain language.
- `docs/AI_APPROACH.html` — what the RAG layer is, why there is no Python, and
  three costed options for adding it.
- `docs/IMAGES.md` + `web/public/images/` — the photo shopping list. Every photo
  slot renders a branded placeholder naming its missing file, so the site is
  presentable with zero images added.
- `docs/ABOUT_SOURCES.md` — every GLS University fact on the About page, with its
  source. Keep it accurate.

### Still true from the MongoDB migration

- **Every `db.*` call is async.** The failure mode is silent: an unawaited call
  spreads a Promise into an object and yields nothing, so a field simply goes
  missing from a response. See House rule 3 in `CLAUDE.md`.
- **Per-row lookups were replaced by `lookup()` batch queries.** Reintroducing an
  `await` inside a row loop turns a constant query count into an N+1 against Atlas.
- **`GEMINI_MODEL` matters.** `gemini-2.0-flash` 404s on current keys; the default
  is `gemini-3.6-flash`.
- **An LLM failure is not reported as abstention.** `compose()` falls back to
  extractive composition unless the model explicitly returns `NOT_FOUND`.

### 5 September 2026 (later) — the interface was redesigned

The owner supplied five reference designs in `screenshots/` and asked for a
system that reads as designed rather than generated. `college_ref(1)` carries a
literal palette sheet and names the typeface, so it was taken as the spec.

**The direction, and what it replaced.** Flat white blocks on a warm-grey
ground (`--bg #F5F5F4`, `--surface #FFFFFF`), one typeface (Manrope), ink for
emphasis, and four pastel families that *classify* — lime for the accent and
"on track", sky for citations and documents, lavender for labs, peach for
"needs attention". Deleted outright: every gradient, all glass and backdrop
blur, card shadows, the three-typeface stack, and every looping keyframe
(`float`, `drift`, `marquee`, `pulseRing`, `sheen`). `theme.css` and `app.css`
were rewritten rather than edited.

**The brand mark is a ghost**, per the owner's request — one path with
`fill-rule: evenodd`, so the eyes are holes rather than painted shapes and the
same mark works on white, ink and lime. It is in the sidebar, site header,
footer, login card, chat avatar, chat empty state and the favicon. **No
component renders initials any more**; the `CA` monogram was the clearest
"AI-generated" tell on the old landing page.

**Three bugs fixed, one of them the one that was reported:**

1. **The upload dialog's scrim did not cover the screen.** `position: fixed` is
   resolved against the nearest ancestor with a transform, filter or animation —
   and every app screen sits inside `.content`, which is animated. The backdrop
   was therefore sized to the content box. `Modal` now renders through
   `createPortal` into `document.body`, which has no such ancestor. Both drawers
   do the same. **Any new overlay must too** — this will recur otherwise.
2. **The mobile menu could stay mounted and invisible**, still holding the body
   scroll lock, when the viewport crossed the breakpoint with the drawer open.
   Both drawers now close on a `matchMedia` change as well as on navigate,
   Escape and scrim click.
3. `Modal` did not restore focus to the trigger on close, and the page shifted
   sideways as the scrollbar disappeared. Both handled.

**Structural changes to navigation** (all at the owner's request):

- The desktop sidebar is **permanent**. The collapse toggle, the 76px icon rail,
  the hover tooltips and the `shell:rail-collapsed` localStorage key are gone.
- The bottom tab bar and the "More" bottom sheet are gone. Below 960px there is
  a topbar hamburger opening a left drawer with the **same** list in the **same**
  order, so mobile and desktop navigation are no longer different products.
- Every destination remains reachable; nothing was removed from the nav.

**The timetable now has a real calendar.** `components/Calendar.jsx` is a
Monday-first month grid with previous/next month, a jump-to-today control, and a
dot on any date carrying sessions. The page gained a Day/Week switch: Day is
calendar + the selected date's schedule, Week is the previous whole-week grid.
`WeekStrip` (the reference's seven-day row) is built and exported but not yet
placed on a screen.

**The landing page was cut back.** Removed: the tilted floating card stack with
orbiting badges, the scrolling marquee, the count-up stat strip, the two
invented testimonials, and the four-photo campus grid of empty placeholders.
What remains is hero, how-it-works, features, roles, CTA — five sections instead
of nine. The hero's worked example (question → answer → citation) was kept but
laid flat, because it is evidence of what the product does rather than
decoration.

**Also:** `Tabs` became a segmented pill control (same props, every caller
untouched); a shared `FilePicker` with drag-and-drop replaced two diverging
inline-styled dropzones; `Note` replaced five `auth-alert` divs carrying inline
colour overrides; the icon set was redrawn on a consistent 1.7 stroke and gained
`ghost`, `graduation`, `books`, `papers`, `calendarDays`, `bell` and the missing
chevron directions.

**Verified:** the production build is clean, every class name used in JSX
resolves to a rule in `app.css`, every `var(--token)` referenced anywhere
resolves in `theme.css`, and there are no unused imports. `npm run smoke` reports
**50 passed, 1 failed** and `npm run eval` **23/26** — see the note below.

### Not verified: how it looks

**Browser tooling was unavailable again this session, so none of this has been
seen rendering.** The checks above are structural, and structural checks cannot
catch a layout that is merely ugly. **Open it at 375px, 768px and 1440px.**
Specific things to look at first, because they are new geometry rather than
restyled markup: the month calendar inside the 320px timetable aside, the mobile
drawer, the upload dialog at both widths, and the landing hero at 375px.

### Two pre-existing test failures, not caused by the redesign

No file under `server/` was modified this session, so neither of these is a
consequence of the UI work — but both contradict this document's earlier claims
and should be looked at:

- `npm run smoke` — **50 passed, 1 failed** (the suite stops short of its
  documented 52 assertions because the failure skips a dependent one).
  `found ungraded submission to grade (none in seed)` fails because previous runs graded every submission in the live
  dataset. Reseeding should clear it.
- `npm run eval` — **23/26**, where this file previously claimed 26/26. The
  three failures are `how many classes can I miss`, `how is CGPA calculated`
  and `what is the placement eligibility criteria` — all document-retrieval
  cases, all against the unmodified seed corpus. Worth a `rag-engineer` pass.

### 5 September 2026 (later still) — UniNest, and three real bugs fixed

The product was renamed **Campus Assistant → UniNest** and the brand mark
changed from a ghost to an owl, from the owner's own artwork in `assets/`.

**This repo is now a git repository.** `main` and `v1` are frozen at the state
described in the previous section; all work below is on **`v2`**.

Three reported problems, and what each actually was:

1. **"The generator shows none of my uploads."** Both of the owner's uploads
   — a scanned PDF and a photographed question paper — extracted *zero* text
   locally, so they were indexed with no passages and filtered out of the
   source list (which requires `chunkCount > 0`). `rag/enrich.js` now hands
   the file to the model after ingestion, in the background. Verified on the
   two real files: the PDF went 0 → 19 passages, the image 0 → 5, both with a
   summary, topics and tags.

2. **"Generation isn't working."** `GEMINI_MODEL` was `gemini-3.6-flash`,
   which has a **20-request-per-day** free-tier cap. It had been exhausted,
   every call was 429ing, and the adapter swallowed it and silently fell back
   to extractive answers. Default is now `gemini-3.5-flash`; every Gemini call
   goes through one transport that retries a short back-off, records an
   exhausted quota, and reports it through `providerStatus()` instead of
   hiding it. **Check `/api/chat/status` before concluding the AI is broken.**

3. **"The library shows metadata instead of the document."** It did — the old
   dialog showed type, version and chunk counts and never the file.
   `components/DocumentViewer.jsx` is a Preview-style split: the PDF or image
   on the left, the model's summary, topics, dates and tags on the right.
   Downloads were also 401ing, because `<a download>` cannot send a bearer
   token; files are fetched as blobs now.

Also fixed: the black rectangle on tapping the assistant's input (the global
`:focus-visible` box-shadow ring, which the textarea cancelled `outline` for
but not `box-shadow`), and the landing nav never highlighting a section (it
compared `location.hash`, which the anchor scroll updates via
`history.replaceState` without telling react-router — now a scroll spy).

Design changes: a photo fan in the hero, a self-scrolling ribbon for the six
steps, a column-based masonry for the features, a two-panel sign-in, an aurora
behind the assistant's composer, and a subject-identity colour system shared
by the dashboard rail, the attendance grid and the results grid.
`docs/UI_GUIDE.md` and the `ui-guide` skill both carry a **Revised** banner
listing the three rules that were deliberately relaxed — read them before
"fixing" a gradient or the marquee back out.

### 6 September 2026 — the owner reviewed it on screen

The first review with actual screenshots (`Issues/`). Two of the complaints
turned out to be one bug, and it is worth knowing which.

**The inverted edge mask.** `--fade-x-bg` / `--fade-x-surface` were written as
*paint* gradients — page colour at the ends, transparent in the middle — and
then used as `mask-image`, where only the alpha channel counts and colour is
ignored entirely. The mask was therefore exactly backwards: it kept the ends
and erased the middle. That is the white block in the centre of the landing
page's step ribbon **and** the reason the dashboard's whole "My subjects" rail
looked like an empty white band. They were reported as two unrelated problems.
There is one token now, `--fade-x-mask`, and the comment on it says why.

**The highlighter over the line above.** An inline element's background covers
its *content area*, whose height comes from the font's own ascent and descent —
about 1.3em for Manrope — and no `line-height` shrinks it. `.hero-title` was at
1.18, so the lime block sat on the descenders above it. Leading for a marked
heading comes from `--mark-lh` (1.44) now.

Everything else that changed:

- **The step ribbon is gone.** Six cards on a static arc instead
  (`components/ArcSteps.jsx`), each pushed down by a parabola of its index. The
  body arrives on hover, on focus and on tap, absolutely positioned so opening
  one cannot move its neighbours. Nothing in the system loops again;
  `@keyframes marquee` was deleted with its only caller.
- **The feature grid is photographs.** Each tile is a picture with a veil that
  darkens towards its foot, the title on the dark, and the body revealed on
  hover. Where there is no pointer, the body is simply always shown.
- **The subject pastel is a rail, not a fill.** This is the second correction to
  the same thing: the previous session moved colour from *status* to
  *identity*, which was right, but kept it as the card's background — so five
  subjects meant five washes of colour and attendance, results and the
  dashboard all read as the same screen. White card, 5px rail, tinted code.
- **Loading versus refreshing.** `useApi` now distinguishes "nothing has ever
  arrived" from "checking for newer". A refetch keeps the old content on screen
  and swaps it with a soft entrance via `Refreshed`, which does not remount —
  so an open tab or a half-typed field survives. Closing the document viewer
  used to blank the entire library back to skeletons and rebuild it.
- **Sign-in is the whole window**, with the owl centred in one half against the
  form in the other, instead of a card floating in an empty page.
- **The About page** had two empty halves (the hero and the history timeline);
  both now carry photographs. The subscribe box at its foot did nothing when
  submitted and is a closing panel with the three mascots instead.
- **The assistant's attendance answer** is a ring per subject with the number
  in the middle, not a stack of near-identical progress bars.
- **Dashboard notices** carried a chevron but were not links. They are now.
- **"Next lessons"** has a fixed-height pane, and its grid row aligns to
  `start` — picking a day with six lectures used to resize the card and, through
  the stretched row, the empty "Pending work" card beside it.
- **All three mascot artworks** still had opaque white where the backdrop had
  been keyed out — invisible on white, a grey smudge on anything else. Keyed
  properly by flooding from the image borders.

### On the document analysis: it is cached, not re-billed

Asked directly, so recorded here. Opening a document in the viewer calls
`GET /api/documents/:id`, which reads `doc.analysis` out of the database. **No
model call.** Gemini is called exactly twice in a document's life: once in the
background right after upload (`enrichInBackground`), and again only if someone
presses **Analyse again**, which posts to `/:id/analyse` with `force: true`.
`enrichDocument` returns early when `analysis.status === 'ready'` and `force` is
not set, so even a stray call costs nothing.

### Tests after this session

- `npm run smoke` — **50 passed, 1 failed**. Same single pre-existing failure
  (`found ungraded submission to grade (none in seed)`): the live dataset has
  no ungraded submission left because earlier runs graded them all. Reseeding
  clears it.
- `npm run eval` — **25/26**, up from 24/26.
- Every page was rendered server-side through `react-dom/server` with a stubbed
  auth context, which is how a JSX mistake that turns a ternary into literal
  page text gets caught without a browser. All thirteen render clean.

### Still not verified: how it looks

**There was still no browser this session.** The checks above are structural
and behavioural, not visual. Open it at 375 / 768 / 1440 and look at the new
geometry first:

- The **arc** at 900–1200px. Six cards across a wrapper is tight; the end cards
  open their panel inwards so it cannot leave the page, and that is the part
  most likely to look wrong.
- The **photo tiles** at 720px, where the masonry goes to two columns, and the
  hover reveal (`max-height: 14em`) against the longest body text.
- The **curved photo stack** beside the history timeline — it reserves its own
  height with `padding-bottom: 128%`, which is arithmetic, not observation.
- The **sign-in** now that it is full-bleed: both halves scroll independently,
  so check the form at a short viewport.
- The **subject rail and cards** — the point of the change is that five
  subjects no longer read as one block. That is a judgement only you can make.

### 6 September 2026 (later) — a second on-screen review

Six things the owner asked for after looking at it again. Two were bugs with a
shared shape: a decorative effect was hiding information.

- **The edge fade was hiding the rail, not softening it.** `--fade-x-mask` took
  alpha to zero at both ends of "My subjects", so the first and last cards came
  out half-erased even when fully in view — reported as "the first and last
  card is hidden and there is no way to scroll". The mask is off the rail and
  `SubjectRail` renders an ink chevron on whichever side still has cards behind
  it, measured off `scrollLeft` so touch and trackpad scrolling keep it honest.
  Fixing that exposed a second one: `scroll-snap-align: start` snaps to the
  **scroll-padding** edge, so without `scroll-padding-inline` the first card
  snapped past the rail's own padding and an untouched rail sat at
  `scrollLeft: 24` showing a "previous" arrow with nothing behind it.
  `--fade-x-mask` now has no callers; it is kept, annotated, because the
  correct way to write one is worth not losing.
- **`BarChart`'s threshold label was underneath the last bar.** It was drawn
  inside the plot at the right-hand end, anchored `end` — which is precisely
  where the tallest bar stands. On the faculty dashboard the bar covered "75%"
  and left "required" floating alone. There is a 34px reserved gutter now and
  the label sits outside the plot, vertically centred on the dashed line. The
  word "required" moved to the three card subtitles.
- **The attendance and results cards get a threshold meter.** `Progress` said
  nothing about the number those screens are actually about, and 82% vs 95%
  read as the same "nearly full" bar. `ThresholdMeter` combs the track into
  twenty ticks and draws the requirement — 75% attendance, 40% marks — as an
  ink gate across the scale. The comb is hairlines in the card's colour laid
  over track and fill, **not** discrete segments: segments round to the nearest
  notch, which would put 74% and 76% on the same one, on opposite sides of the
  line that decides examination eligibility. `Progress` stays for the cohort
  table and the two dashboards.
- **About us is the last nav item.** The two in-page anchors must stay in
  document order or the scroll spy lights the wrong link; there is a comment on
  `NAV` saying so.
- **The About page's closing panel is `lime-soft`, and so is the contact
  section above it** — with `paddingTop: 0` the two fused into one continuous
  wash and the panel lost its edge. `.section-closing` puts `--s7` of page
  ground in the seam.
- **The sign-in aside's two point cards were 62% white on a near-white wash**,
  so they had no edge and read as smudges under the mascot. They are one opaque
  block with a hairline between the rows, centred on the owl's axis with a
  lede, and the heading dropped a step so the *form's* title is the page's
  primary heading.

Also `#e79b91` — the pastel red that fills a bar — was hardcoded in three
files and is `--bad-2` now, in the role `--lime-2` and `--peach-2` play.

Verified in a browser at 1440: nav order and scroll spy, the About seam
(54px), the rail resting at `scrollLeft: 0` with one chevron and no page
overflow, the meters with their gate markers, and the chart label clear of the
bars. Production build clean.

### Next task

1. **Look at all of this in a browser** at 375 / 768 / 1440.
2. **Attendance marking and result entry screens.** Unchanged: the API is built
   and tested, so it is UI work against known contracts, and it removes the
   most obvious "this is a demo" gap. Read `docs/UI_GUIDE.md` first, not your
   memory of it — it was revised again this session.
3. **The remaining failing eval case**, which predates this session.
4. **Consider a paid Gemini tier or a lighter model** if the free daily
   allowance keeps running out mid-demo. `gemini-flash-lite-latest` and
   `gemini-3.1-flash-lite` both had quota available when this was written.

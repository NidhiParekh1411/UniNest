# CLAUDE.md — College RAG Assistant

Guidelines for any Claude session working in this repo. Read this first, then
`docs/PROJECT_STATE.md` to find out where the last session stopped.

## What this is

An AI-powered college knowledge assistant: a RAG chatbot plus a structured
records system (timetables, attendance, results, assignments) with three roles —
**student**, **faculty**, **admin**. Originating requirements come from
`reference/college_rag_assistant_presentation.pptx`; they are transcribed in
`docs/REQUIREMENTS.md` so nobody has to re-open the deck.

## Stack (Phase 1 — deliberate choices)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite, plain CSS with design tokens | No UI framework — the design system is small and hand-owned |
| Backend | Node 20+ / Express (ESM) | Single runtime; local Python is 3.9 and fragile for ML deps |
| Database | MongoDB via `src/lib/db.js`, with an automatic JSON-file fallback | Every access goes through the `db` module. With no MongoDB reachable it serves `server/data/*.json`, so a fresh clone runs with zero setup. The API surface is async either way — see House rule 3 |
| Retrieval | BM25 + heuristics, pure JS (`src/rag/`) | Runs with **zero API keys**. No network dependency for a demo |
| LLM | Pluggable adapter `src/rag/llm.js` | Extractive fallback by default; set `GEMINI_API_KEY` to upgrade generation |
| Auth | JWT (HS256) + role-based middleware | |

**Do not add a heavyweight dependency without asking.** Current server deps:
express, cors, jsonwebtoken, bcryptjs, multer, dotenv, pdf-parse, mammoth, xlsx,
mongodb.
Frontend deps: react, react-dom, react-router-dom. Charts are hand-rolled SVG —
do not install a charting library, it will not match the design language.

## Repo map

```
CLAUDE.md              this file
docs/                  requirements, state, roadmap, UI guide  <- START HERE
reference/             the original source PPTX
.claude/skills/ui-guide/   design system as an invocable skill
.claude/agents/        subagent definitions for this repo
server/
  src/index.js         express app + route mounting
  src/lib/db.js        MongoDB access layer — the only module that talks to the driver
  src/lib/async-routes.js  forwards async handler rejections to the error middleware
  src/lib/auth.js      JWT sign/verify + requireRole middleware
  src/lib/parse.js     PDF/DOCX/XLSX/image text extraction
  src/routes/*.js      one file per resource
  src/rag/             chunk, index, retrieve, route intents, llm adapter
  src/seed/seed.js     regenerates all demo data (idempotent, destructive)
  data/uploads/        uploaded binaries; records live in MongoDB (gitignored)
web/
  src/styles/theme.css design tokens — change colors HERE, nowhere else
  src/lib/api.js       single fetch wrapper; all network calls go through it
  src/components/      shared UI primitives
  src/pages/           one file per route, grouped by role
```

## House rules

1. **Design tokens only.** Never hardcode a hex value in a component. If you need
   a color, it exists in `theme.css` or it should be added there. Same for
   spacing, radius, and shadow. See `docs/UI_GUIDE.md`.
2. **Mobile is not an afterthought.** Every screen is built mobile-first and must
   be checked at 375px, 768px, and 1440px. No horizontal page scroll, ever —
   wide tables get their own `overflow-x: auto` wrapper.
3. **All data access through `db.js`.** No route or RAG module imports the Mongo
   driver, and nothing outside `db.js` knows which of the two stores is active
   (`driverName()` reports it). Add a method to *both* drivers or to neither. Every `db.*` method is **async and must be awaited** — an unawaited
   call yields a Promise that spreads into nothing and fails silently, which is
   exactly how this migration's worst bugs looked. Two related traps: write
   `(await db.x.byId(id))?.name`, never `await db.x.byId(id)?.name` (the second
   optional-chains the Promise and awaits `undefined`); and never `await` inside
   a `.map()` — preload with `lookup()` and read the Map synchronously, or you
   have written an N+1 against Atlas.
4. **Role scoping is enforced server-side.** The UI hiding a button is not
   security. Every route that returns student data filters by the *token's*
   identity, never by an id passed in the request body.
5. **The assistant must never guess.** If retrieval scores below threshold, it
   answers "not found in official documents". Citations are mandatory on any
   document-grounded answer. This is a core product promise from the deck.
6. **Keep `docs/PROJECT_STATE.md` current.** When you finish a chunk of work,
   update the "Status" table and the "Where we left off" section. That file is
   the handoff contract between sessions.

## Running it

```bash
npm install          # root — installs both workspaces
npm run dev          # api on :4000, web on :5173 — works with no database
```

That is the whole setup. With no MongoDB reachable the API loads
`server/data/*.json` and says so on startup. To use a real database instead,
copy `server/.env.example` to `server/.env`, set `MONGODB_URI`, and run
`npm run seed` (DESTRUCTIVE — wipes every collection). See
`docs/DATABASE_SETUP.html`.

**Never run `npm run seed` while `npm run dev` is up in file mode.** The server
holds the dataset in memory; the seed rewrites the files underneath it. `db.js`
detects this and reloads rather than clobbering, but restart the server after.

Demo logins are printed by the seed script and listed in `docs/PROJECT_STATE.md`.

## Known deliberate gaps

Phase 1 stops short in specific, documented places. Before you "fix" something
that looks unfinished, check the Limitations section of `docs/PROJECT_STATE.md` —
it is probably a known, intentional boundary with a planned phase.

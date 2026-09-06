# College RAG Assistant

An AI knowledge assistant for a college: a retrieval-grounded chatbot plus the
structured records — timetables, attendance, results, assignments — that student
questions actually depend on. Three roles, scoped access, and answers that always
name the document they came from.

Built from the problem statement in `reference/college_rag_assistant_presentation.pptx`.

```bash
npm install
cp server/.env.example server/.env    # then set MONGODB_URI
npm run seed
npm run dev      # → http://localhost:5173
```

Records live in MongoDB — a free Atlas cluster or a local `mongod`. Both sign-in
screens offer one-tap demo accounts. Answer composition runs offline by default;
no AI key is required.

## What it does

- **Grounded answers with citations.** Every document answer names the circular and
  section it came from, and shows the excerpt on tap.
- **Says when it doesn't know.** A dual confidence gate (BM25 score plus
  IDF-weighted term coverage) refuses to answer rather than guess on policy.
- **Knows the difference** between "what's my attendance" (a record lookup) and
  "what's the attendance policy" (a document question).
- **Asks instead of assuming.** An underspecified question returns selectable
  options rather than a guess.
- **Suggests as you type.** Typing "exam" surfaces exam-related actions, filtered
  by what your role is allowed to do.
- **Drafts question banks** from uploaded slides or notes — always as a draft a
  faculty member reviews before publishing.
- **Schedules announcements** to appear at a chosen time.
- **Versions documents**, so a superseded circular can never be quoted.

## Stack

React 18 + Vite · Express (ESM) · MongoDB behind a single access module ·
BM25 retrieval in pure JavaScript · optional Gemini for answer synthesis.
No UI framework, no chart library, no icon package.

## Documentation

| File | What's in it |
|---|---|
| `docs/PROJECT_STATE.md` | **Start here.** Status per feature, honest limitations, what to do next |
| `docs/REQUIREMENTS.md` | The deck and the client brief, transcribed |
| `docs/UI_GUIDE.md` | The design system and its reasoning |
| `CLAUDE.md` | Working guidelines for this repo |

## Tests

```bash
npm run eval     # 26 retrieval/routing/abstention cases
npm run smoke    # 52 end-to-end API assertions across all three roles (needs `npm run dev`)
```

Both read `MONGODB_URI`, so point them at a scratch database rather than the one
holding anything you care about — `npm run seed` wipes every collection.

## Configuration

Copy `server/.env.example` to `server/.env`.

| Variable | Notes |
|---|---|
| `MONGODB_URI` | **Required.** Atlas SRV string, or `mongodb://127.0.0.1:27017` for a local `mongod` |
| `MONGODB_DB` | Database name, default `college_rag` |
| `GEMINI_API_KEY` | Optional. Blank leaves answers extractive and fully offline; setting it upgrades answer synthesis and question generation with no other change |
| `GEMINI_MODEL` | Default `gemini-3.6-flash` |

---

Demonstration build. Student records in this environment are generated sample
data, shaped so a college's real records can replace them directly.

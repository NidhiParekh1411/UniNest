# Requirements

Two sources: the original problem statement deck (`reference/`) and the client's
Phase 1 brief. Transcribed here so no session needs to re-open the PPTX.

## A. From the deck (TridyaTech problem statement)

**Problem.** Student information is scattered across circulars, timetables,
syllabi and policy PDFs. No single search surface. Documents are revised often,
so even the correct PDF may be stale. Result: the same questions repeatedly land
on faculty and admin.

**Solution pillars.**
- Answers generated from real official documents, never invented
- Every answer names the exact document and section it came from
- Conversation memory, so follow-ups don't need repeated context
- Explicit abstention: "not found in official documents" over a guess

**Capabilities — data & access.**
- Semester-aware timetables (own branch, semester, lab schedule — not a generic table)
- Faculty↔subject mapping tracked per semester, so "who teaches X" has one answer
- Attendance & results lookup, filtered by branch/semester/exam type before any number is shown
- Reads PDF, Excel, Word, each parsed with the right extractor

**Capabilities — access & automation.**
- Students get read-only chat; faculty/admin get a separate login to upload and update
- Underspecified questions get a follow-up with options, not a guess
- Content generator: turns subject material into a draft question bank for faculty review
- Date-wise document versioning, so the assistant knows which circular is current

**Architecture.** Offline ingestion (auth-gated upload → format-aware parsing →
knowledge base of vectors + dated structured tables). Online query (authenticate
→ route intent → scoped retrieval → LLM synthesis → verified, cited answer).

**Algorithm.**
*Ingestion:* authenticate uploader → detect file type → tabular data validated and
upserted relationally / prose OCR'd if scanned, chunked, embedded → tag every
record with upload date and source file.
*Query:* authenticate and load branch+semester → parse question, detect missing
detail → ask follow-up if missing → classify intent (structured vs document) →
SQL scoped to student, or top-k latest-version chunks → LLM grounded answer →
return with citation.

**Deck's proposed tech.** PyMuPDF/python-docx/openpyxl/Tesseract; Sentence-
Transformers; PostgreSQL + pgvector; Flask/Django REST; React; OpenAI/Groq/Ollama;
JWT + RBAC; intent classifier; python-pptx content generation.
*Phase 1 deviates deliberately — see the stack table in CLAUDE.md.*

**Data strategy.** Public real documents for the knowledge base (UGC/AICTE
circulars). Structured records are private by nature, so a seed generator creates
realistic demo records (8-semester structure, real subject naming, plausible
attendance) clearly labeled as demo and shaped so real records drop in directly.

**Assumptions.** Digital-ready documents; spreadsheets with consistent columns;
student branch+semester known at login; uploads are authoritative; reasonable
campus connectivity.

**Challenges.** Keeping the index current; OCR quality on scans/handwriting;
avoiding confident wrong answers; no ready test set; mixed-language (Gujarati/
Hindi/English) queries; structured-vs-document routing reliability; strict access
control so no student sees another's records.

**Open questions from the deck** (still open, decide before Phase 3):
1. Plug into the existing college portal, or stay standalone?
2. Target scale — how many documents, how many concurrent students?
3. Preferred AI service given student-data privacy?
4. Is Gujarati/Hindi query support in scope for this phase?
5. Must professors review AI-generated question banks before publishing?
6. Source of truth for a student's branch and semester — college ID system or manual?

## B. Client brief (Phase 1)

**Functional.**
- Students in different semesters see different timetables
- Every faculty member teaches different subjects across different semesters
- Attendance and results charts for every student
- Three roles — admin, student, faculty — each with access scoped accordingly
- Supported documents: PDF, Excel, Word, handwritten notes (student assignment
  submission); faculty share notes with students in the same formats
- An AI agent that builds a question bank from a PPT or other faculty-supplied material
- Separate login UI per role; **admin and faculty may share one login screen**
- Reminder/scheduling: upload a document, detail, or announcement to publish at a set time
- Chatbot has a dropdown of recommended actions — e.g. typing "exam" suggests
  exam-related actions

**Non-functional.**
- Theme: minimal. White background, black text, grey for secondary surfaces, and
  one beautiful gradient accent (orange → pink)
- A proper, considered font pairing
- Graceful across all device sizes, web and phone
- Phase 1 = complete UI with features wired so real backends slot in easily
- Local file-based storage now; MongoDB later
- Must be demo-ready today

## C. Decisions taken (2026-09-02)

| Decision | Choice | Rationale |
|---|---|---|
| LLM | Offline-first, no key required; Gemini adapter behind `GEMINI_API_KEY` | No key available at build time; demo must not depend on network |
| Backend runtime | Node, not Python | Local Python is 3.9.1; ML deps slow and fragile to install same-day |
| Delivery | Local `npm run dev`, screen-shared | No hosting needed for this round |
| Charts | Hand-rolled SVG | Full control of the minimal aesthetic; zero dependency weight |

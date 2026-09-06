// Shared tokenizer. Kept in one place so the index and the query use identical
// normalisation — a mismatch here silently destroys recall.

const STOP = new Set(`a an the is are was were am be been being of for for to in on at by with from as
and or but if then than that this these those it its i we you he she they them my our your his her
what which who whom whose when where why how do does did done can could should would will shall may
might must have has had not no nor so such about into over under again further once here there all
any both each few more most other some only own same too very s t just don now`.split(/\s+/));

// Domain vocabulary. Students type abbreviations and colloquialisms that never
// appear verbatim in an official circular — a circular says "Cumulative
// Performance Index", a student types "CGPA". Expanding at tokenisation time
// (on both sides) is what closes that gap.
//
// A few Hindi/Gujarati transliterations are included as a first step towards the
// mixed-language support the problem statement calls out. Full multilingual
// handling is a later phase — see docs/PROJECT_STATE.md.
// Canonical groups: words that mean the same thing in a college document all
// collapse to one token, applied to BOTH the index and the query. Without this,
// a student asking about the "attendance policy" ranks a document titled
// "Placement Policy" above one titled "Academic Regulations — Attendance",
// purely because the former happens to use the word the student typed.
const CANONICAL = {
  policy: ['policy', 'policies', 'regulation', 'regulations', 'rule', 'rules', 'norm', 'norms', 'guideline', 'guidelines'],
  examination: ['examination', 'examinations', 'exam', 'exams', 'test', 'tests', 'paper'],
  faculty: ['faculty', 'professor', 'professors', 'teacher', 'teachers', 'lecturer', 'lecturers', 'staff'],
  marks: ['marks', 'mark', 'score', 'scores', 'grade', 'grades'],
  attendance: ['attendance', 'attend', 'attends', 'attended', 'attending', 'presence'],
  fee: ['fee', 'fees', 'payment', 'charges'],
  laboratory: ['laboratory', 'laboratories', 'lab', 'labs', 'practical', 'practicals'],
  timetable: ['timetable', 'timetables', 'schedule', 'schedules'],
  deadline: ['deadline', 'deadlines', 'due', 'lastdate'],
  permitted: ['permitted', 'permission', 'allowed', 'allow', 'allows', 'eligible', 'eligibility'],
};

const CANONICAL_MAP = Object.fromEntries(
  Object.entries(CANONICAL).flatMap(([canon, words]) => words.map((w) => [w, canon])),
);

const SYNONYMS = {
  cgpa: 'cumulative performance index',
  cpi: 'cumulative performance index',
  sgpa: 'semester performance index',
  spi: 'semester performance index',
  hod: 'head of department',
  tpo: 'training placement officer',
  ppt: 'presentation slides',
  prof: 'professor',
  viva: 'viva voce',
  reval: 're evaluation',
  revaluation: 're evaluation',
  xerox: 'photocopy',
  atkt: 'backlog',
  marksheet: 'grade card',
  bunk: 'absent attendance',
  bunked: 'absent attendance',
  hostel: 'hostel resident warden',
  ragging: 'ragging',
  // transliterations
  hajri: 'attendance',
  pariksha: 'examination',
  chutti: 'leave holiday',
  rajaa: 'leave holiday',
  fee_bharvo: 'fee payment',
};

// A compact Porter-style stemmer. The important property is not linguistic
// correctness but *consistency*: "use", "using" and "used" must all collapse to
// the same key, or the index and the query will never meet.
function stem(word) {
  let w = word;
  if (w.length <= 3) return w;

  if (/ies$/.test(w) && w.length > 4) w = `${w.slice(0, -3)}y`;
  else if (/(sses|shes|ches|xes)$/.test(w)) w = w.slice(0, -2);
  else if (/[^s]s$/.test(w)) w = w.slice(0, -1);

  const strip = (suffix, min = 4) => {
    if (w.endsWith(suffix) && w.length - suffix.length >= min) { w = w.slice(0, -suffix.length); return true; }
    return false;
  };

  strip('ation', 3) ? (w += 'at') : (strip('ition', 3) ? (w += 'it') : strip('ion', 4));
  strip('ment') || strip('ness') || strip('able') || strip('ible')
    || strip('ing', 3) || strip('edly') || strip('ed', 3) || strip('ly', 3) || strip('ity') || strip('ive');

  if (w.endsWith('e') && w.length > 3) w = w.slice(0, -1);
  // running -> runn -> run
  if (/([bdfglmnprt])\1$/.test(w)) w = w.slice(0, -1);
  return w;
}

export function tokenize(text, { keepStop = false, expand = true } = {}) {
  if (!text) return [];
  let normalised = text.toLowerCase();

  if (expand) {
    // Whole-word replacement only, so "labour" is never rewritten via "lab".
    // Abbreviations expand to a phrase first, then everything collapses to its
    // canonical form.
    normalised = normalised.replace(/[a-z]+/g, (w) => SYNONYMS[w] ?? w);
    normalised = normalised.replace(/[a-z]+/g, (w) => CANONICAL_MAP[w] ?? w);
  }

  return normalised
    .replace(/[^a-z0-9ऀ-ॿ઀-૿\s./-]/g, ' ')
    .split(/[\s./-]+/)
    .filter(Boolean)
    .filter((w) => keepStop || (!STOP.has(w) && w.length > 1))
    .map(stem);
}

export function isStopword(w) { return STOP.has(w); }

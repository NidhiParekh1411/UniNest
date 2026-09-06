// Chat composer suggestions. As the user types, matching keywords surface a
// dropdown of concrete actions — the brief's example: typing "exam" offers
// exam-related things to do.
//
// Suggestions are scoped: a student is never offered "mark attendance", and a
// suggestion referencing the caller's own data is phrased in the first person.

const CATALOGUE = [
  {
    keywords: ['exam', 'test', 'paper', 'midsem', 'mid sem', 'final', 'endsem'],
    label: 'Exams',
    items: [
      { text: 'What is my exam timetable?', roles: ['student'], icon: 'calendar' },
      { text: 'What were my midsem marks?', roles: ['student'], icon: 'chart' },
      { text: 'What is the exam re-evaluation policy?', roles: ['student', 'faculty', 'admin'], icon: 'doc' },
      { text: 'What is the minimum attendance to sit for exams?', roles: ['student', 'faculty', 'admin'], icon: 'doc' },
      { text: 'Generate a question bank for my subject', roles: ['faculty', 'admin'], icon: 'sparkle' },
      { text: 'Publish an exam announcement', roles: ['faculty', 'admin'], icon: 'megaphone' },
    ],
  },
  {
    keywords: ['attendance', 'present', 'absent', 'short', 'defaulter'],
    label: 'Attendance',
    items: [
      { text: 'What is my attendance percentage?', roles: ['student'], icon: 'chart' },
      { text: 'Which subjects am I short of attendance in?', roles: ['student'], icon: 'alert' },
      { text: 'What is the attendance policy?', roles: ['student', 'faculty', 'admin'], icon: 'doc' },
      { text: 'Show attendance for my classes', roles: ['faculty', 'admin'], icon: 'chart' },
      { text: 'What happens if attendance falls below 75%?', roles: ['student', 'faculty', 'admin'], icon: 'doc' },
    ],
  },
  {
    keywords: ['result', 'marks', 'grade', 'score', 'cgpa', 'spi'],
    label: 'Results',
    items: [
      { text: 'Show my results for this semester', roles: ['student'], icon: 'chart' },
      { text: 'What were my midsem marks?', roles: ['student'], icon: 'chart' },
      { text: 'How is CGPA calculated?', roles: ['student', 'faculty', 'admin'], icon: 'doc' },
      { text: 'What are the passing criteria?', roles: ['student', 'faculty', 'admin'], icon: 'doc' },
      { text: 'Publish results for a subject', roles: ['faculty', 'admin'], icon: 'upload' },
    ],
  },
  {
    keywords: ['timetable', 'time table', 'schedule', 'class', 'lecture', 'lab', 'period'],
    label: 'Timetable',
    items: [
      { text: 'What is my timetable today?', roles: ['student'], icon: 'calendar' },
      { text: 'Show my full week timetable', roles: ['student'], icon: 'calendar' },
      { text: 'When is my next lab session?', roles: ['student'], icon: 'calendar' },
      { text: 'Show the timetable for my subjects', roles: ['faculty', 'admin'], icon: 'calendar' },
    ],
  },
  {
    keywords: ['assignment', 'submit', 'submission', 'due', 'deadline', 'homework'],
    label: 'Assignments',
    items: [
      { text: 'What assignments are pending for me?', roles: ['student'], icon: 'clipboard' },
      { text: 'What is due this week?', roles: ['student'], icon: 'clock' },
      { text: 'What is the late submission policy?', roles: ['student', 'faculty', 'admin'], icon: 'doc' },
      { text: 'Show submissions awaiting my review', roles: ['faculty', 'admin'], icon: 'clipboard' },
    ],
  },
  {
    keywords: ['faculty', 'teacher', 'professor', 'who teaches', 'sir', 'madam', 'hod'],
    label: 'Faculty',
    items: [
      { text: 'Who teaches Database Management Systems?', roles: ['student', 'faculty', 'admin'], icon: 'user' },
      { text: 'Which subjects does my class have this semester?', roles: ['student'], icon: 'book' },
      { text: 'How do I contact my subject faculty?', roles: ['student'], icon: 'doc' },
    ],
  },
  {
    keywords: ['fee', 'fees', 'payment', 'scholarship', 'refund'],
    label: 'Fees',
    items: [
      { text: 'What is the fee payment deadline?', roles: ['student'], icon: 'doc' },
      { text: 'What is the fee refund policy?', roles: ['student', 'faculty', 'admin'], icon: 'doc' },
      { text: 'Which scholarships am I eligible for?', roles: ['student'], icon: 'doc' },
    ],
  },
  {
    keywords: ['placement', 'internship', 'job', 'company', 'training'],
    label: 'Placements',
    items: [
      { text: 'What are the placement eligibility criteria?', roles: ['student', 'faculty', 'admin'], icon: 'doc' },
      { text: 'What is the internship policy?', roles: ['student', 'faculty', 'admin'], icon: 'doc' },
      { text: 'Show the latest placement announcements', roles: ['student', 'faculty', 'admin'], icon: 'megaphone' },
    ],
  },
  {
    keywords: ['note', 'notes', 'material', 'ppt', 'slide', 'syllabus', 'book'],
    label: 'Study material',
    items: [
      { text: 'Show study material shared for my semester', roles: ['student'], icon: 'book' },
      { text: 'What is the syllabus for this semester?', roles: ['student', 'faculty', 'admin'], icon: 'book' },
      { text: 'Upload notes for my students', roles: ['faculty', 'admin'], icon: 'upload' },
      { text: 'Generate a question bank from my slides', roles: ['faculty', 'admin'], icon: 'sparkle' },
    ],
  },
  {
    keywords: ['leave', 'holiday', 'vacation', 'absent application', 'medical'],
    label: 'Leave & holidays',
    items: [
      { text: 'What is the medical leave policy?', roles: ['student', 'faculty', 'admin'], icon: 'doc' },
      { text: 'What are the upcoming holidays?', roles: ['student', 'faculty', 'admin'], icon: 'calendar' },
    ],
  },
  {
    keywords: ['library', 'hostel', 'transport', 'bus', 'canteen', 'wifi', 'id card'],
    label: 'Campus',
    items: [
      { text: 'What are the library timings and rules?', roles: ['student', 'faculty', 'admin'], icon: 'doc' },
      { text: 'What is the hostel curfew policy?', roles: ['student'], icon: 'doc' },
      { text: 'How do I get a duplicate ID card?', roles: ['student'], icon: 'doc' },
    ],
  },
];

// Shown when the composer is empty — a starting point rather than a blank page.
const STARTERS = {
  student: [
    { text: 'What is my timetable today?', icon: 'calendar' },
    { text: 'What is my attendance percentage?', icon: 'chart' },
    { text: 'What assignments are pending for me?', icon: 'clipboard' },
    { text: 'What is the minimum attendance to sit for exams?', icon: 'doc' },
  ],
  faculty: [
    { text: 'Generate a question bank from my slides', icon: 'sparkle' },
    { text: 'Show submissions awaiting my review', icon: 'clipboard' },
    { text: 'Who teaches Database Management Systems?', icon: 'user' },
    { text: 'What is the exam re-evaluation policy?', icon: 'doc' },
  ],
  admin: [
    { text: 'Show the latest placement announcements', icon: 'megaphone' },
    { text: 'What is the attendance policy?', icon: 'doc' },
    { text: 'Who teaches Database Management Systems?', icon: 'user' },
    { text: 'What are the placement eligibility criteria?', icon: 'doc' },
  ],
};

export function suggest(query, scope, limit = 6) {
  const role = scope.role ?? 'student';
  const q = (query ?? '').trim().toLowerCase();

  if (!q) {
    return [{ label: 'Try asking', items: (STARTERS[role] ?? STARTERS.student).map((i) => ({ ...i, roles: [role] })) }];
  }

  const groups = [];
  for (const group of CATALOGUE) {
    // A keyword matches when the typed text is a prefix of it or contains it —
    // so "exa" matches "exam" and "my exam date" matches too.
    const hit = group.keywords.some((k) => k.startsWith(q) || q.includes(k) || (q.length >= 3 && k.startsWith(q.split(/\s+/).pop())));
    if (!hit) continue;
    const items = group.items.filter((i) => i.roles.includes(role));
    if (items.length) groups.push({ label: group.label, items });
  }

  let count = 0;
  const out = [];
  for (const g of groups) {
    if (count >= limit) break;
    const items = g.items.slice(0, limit - count);
    count += items.length;
    out.push({ label: g.label, items });
  }
  return out;
}

export const suggestionCatalogue = CATALOGUE;

// Content for the public site, kept out of the components so copy can be
// edited without touching layout.
//
// The GLS University facts below are taken from glsuniversity.ac.in and the
// Gujarat Law Society site (see docs/ABOUT_SOURCES.md). They describe the real
// institution this project is built for. The product itself is presented under
// a neutral name — the assistant is the software, GLS is the campus it serves.

export const PRODUCT = {
  name: 'Campus Assistant',
  // The brand mark is a drawn ghost — see components/Logo.jsx. Nothing renders
  // initials any more; `mark` is kept only as the alt text for the glyph.
  mark: 'Campus Assistant',
  tagline: 'AI knowledge assistant',
  description:
    'Ask a question in plain English and get an answer drawn from your college’s own circulars, timetables and notes — with the document it came from attached.',
};

export const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About us' },
  { to: '/#how', label: 'How it works' },
  { to: '/#features', label: 'Features' },
];

/* --------------------------------------------------------- landing content */

export const HERO_STATS = [
  { value: 3, suffix: '', label: 'Roles, each scoped server-side' },
  { value: 117, suffix: '', label: 'Subjects across 3 branches' },
  { value: 100, suffix: '%', label: 'Answers carry a citation' },
  { value: 0, suffix: '', label: 'Guesses when a document is silent' },
];

export const FEATURES = [
  {
    icon: 'sparkle',
    tone: 'lime',
    title: 'Answers you can check',
    body: 'Every document-grounded reply names the circular, the section and the passage it came from. If the corpus does not cover the question, it says so instead of inventing an answer.',
  },
  {
    icon: 'calendar',
    tone: 'lavender',
    title: 'Your timetable, not a generic one',
    body: 'Scoped to your branch, semester and lab batch from your account — so “when is my next lab” has exactly one correct answer.',
  },
  {
    icon: 'chart',
    tone: 'peach',
    title: 'Attendance against the 75% line',
    body: 'Per-subject bars, a term trend and a plain reading of where you stand against the requirement to sit the end-semester exam.',
  },
  {
    icon: 'upload',
    tone: 'sky',
    title: 'Format-aware ingestion',
    body: 'PDF, Word, Excel and PowerPoint are each parsed the right way — slide titles become section headings, spreadsheet tables stay tables.',
  },
  {
    icon: 'layers',
    tone: 'lime',
    title: 'Question banks from your own material',
    body: 'Faculty turn a lecture deck into a draft paper, review every question, and publish only what they approve.',
  },
  {
    icon: 'shield',
    tone: 'lavender',
    title: 'Versioned and role-scoped',
    body: 'A new circular retires the one it replaces, so nothing stale is ever quoted — and no student can reach another student’s record.',
  },
];

// The "path" through the product, drawn as reference 1's dashed route.
export const JOURNEY = [
  {
    step: '01',
    icon: 'upload',
    title: 'Staff publish the source',
    body: 'A circular, a timetable, a set of notes or a slide deck is uploaded once and scoped to the branches and semesters it applies to.',
  },
  {
    step: '02',
    icon: 'layers',
    title: 'It is split and indexed',
    body: 'Text is extracted per format, cut into overlapping passages that carry their section heading, and written to a searchable index.',
  },
  {
    step: '03',
    icon: 'search',
    title: 'A student asks in plain English',
    body: 'The router decides whether the question wants a record lookup — “my attendance” — or a document search — “the attendance policy”.',
  },
  {
    step: '04',
    icon: 'shield',
    title: 'Scope is applied before ranking',
    body: 'Only material the asker is entitled to see is considered, so scoping is a property of retrieval rather than a filter on the way out.',
  },
  {
    step: '05',
    icon: 'sparkle',
    title: 'The answer is composed with citations',
    body: 'Passages are stitched into a reply that names its sources. Below the confidence threshold it abstains — “not found in official documents”.',
  },
  {
    step: '06',
    icon: 'check',
    title: 'You verify in one tap',
    body: 'Every citation opens the passage it quoted, so the answer is checkable rather than merely confident.',
  },
];

export const AUDIENCES = [
  {
    icon: 'user',
    tone: 'lime',
    role: 'Students',
    body: 'One place for the timetable, attendance, results, assignments and every notice that applies to your semester.',
    points: ['Ask and get a cited answer', 'Submit work in any format', 'See the 75% line clearly'],
  },
  {
    icon: 'users',
    tone: 'lavender',
    role: 'Faculty',
    body: 'Publish once and let the assistant answer the same question a hundred times, correctly scoped to who is asking.',
    points: ['Upload notes and circulars', 'Grade with feedback', 'Draft question banks'],
  },
  {
    icon: 'shield',
    tone: 'peach',
    role: 'Administration',
    body: 'Map faculty to subjects, manage cohorts, and schedule announcements to appear at the moment they matter.',
    points: ['Subject and faculty mapping', 'Scheduled notices', 'Cohort-wide reporting'],
  },
];

export const TESTIMONIALS = [
  {
    quote:
      'I used to ask three people before finding out whether a re-exam form was still open. Now I ask once and get the circular that says so.',
    name: 'Ayaan Vyas',
    detail: 'Computer Engineering · Semester 5',
    image: '/images/student-1.jpg',
  },
  {
    quote:
      'The same five questions arrived in my inbox every week. I upload the notes once and the assistant answers them — with the page it read.',
    name: 'Dr. Anjali Mehta',
    detail: 'Faculty · Computer Engineering',
    image: '/images/faculty-1.jpg',
  },
];

/* -------------------------------------------------------- GLS University --- */

export const COLLEGE = {
  name: 'GLS University',
  society: 'Gujarat Law Society',
  motto: 'Learn Love Serve',
  societyFounded: 1927,
  universityFounded: 2015,
  address: 'GLS Campus, Opp. Law Garden, Ellisbridge, Ahmedabad, Gujarat 380006',
  city: 'Ahmedabad',
  website: 'https://www.glsuniversity.ac.in',
  email: 'info@glsuniversity.ac.in',
  accreditation: 'NAAC A+ · CGPA 3.44',
};

// Every entry is sourced — see docs/ABOUT_SOURCES.md.
export const COLLEGE_MILESTONES = [
  {
    year: '1927',
    icon: 'flag',
    title: 'The Gujarat Law Society is founded',
    body: 'Established by Sardar Vallabhbhai Patel, Shri Ganesh Vasudev Mavlankar — later the first Speaker of the Lok Sabha — and Shri I. M. Nanavati, with a founding vision of excellence in education.',
  },
  {
    year: 'Decades on',
    icon: 'layers',
    title: 'A multi-disciplinary trust',
    body: 'GLS grows into one of the largest and oldest educational bodies in Gujarat, operating more than thirty institutions across law, commerce, management, computing and the arts.',
  },
  {
    year: '2015',
    icon: 'award',
    title: 'GLS University is established',
    body: 'Created in April 2015 under The Gujarat Private Universities (Amendment) Act, carrying the society’s legacy into a single university with the motto “Learn Love Serve”.',
  },
  {
    year: 'Today',
    icon: 'trophy',
    title: 'NAAC A+ and a campus in the city centre',
    body: 'Accredited Grade A+ with a CGPA of 3.44 by the National Assessment and Accreditation Council, on a ten-acre campus in the heart of Ahmedabad, opposite Law Garden.',
  },
];

export const COLLEGE_FACULTIES = [
  { icon: 'cpu', name: 'Computer Applications & IT', programmes: ['BCA (Hons)', 'Integrated MCA', 'B.Sc. (IT)', 'M.Sc. Cyber Security', 'MCA', 'Ph.D.'] },
  { icon: 'briefcase', name: 'Management', programmes: ['MBA', 'Ph.D.'] },
  { icon: 'chart', name: 'Commerce', programmes: ['B.Com', 'B.Com (Fintech)', 'B.Com + ACCA (UK)', 'M.Com', 'Ph.D.'] },
  { icon: 'target', name: 'Business Administration', programmes: ['BBA', 'BBA (Hons.)', 'Integrated MBA', 'BBA + ACCA (UK)'] },
  { icon: 'scale', name: 'Law', programmes: ['Integrated BA LL.B.', 'Integrated BBA LL.B. (Hons)', 'LL.B. (Hons)', 'LL.M.', 'Ph.D.'] },
  { icon: 'palette', name: 'Design', programmes: ['Bachelor of Design', 'Global B.Des (Hons.)', 'Master of Design', 'Ph.D. in Design'] },
  { icon: 'bolt', name: 'Engineering & Technology', programmes: ['B.Tech', 'Integrated B.Tech – MBA', 'Integrated M.Tech', 'Ph.D.'] },
  { icon: 'music', name: 'Performing Arts', programmes: ['BA / B.Com / BBA (Performing Arts)', 'MPA'] },
  { icon: 'globe', name: 'International & Liberal Studies', programmes: ['MS Finance', 'Global Programmes', 'Liberal Studies'] },
];

export const COLLEGE_STATS = [
  { value: 1927, label: 'Society founded', plain: true },
  { value: 30, suffix: '+', label: 'Institutions under GLS' },
  { value: 9, label: 'Faculties at the university' },
  { value: 1000, suffix: '+', label: 'Recruiters on campus' },
];

export const COLLEGE_VALUES = [
  {
    icon: 'star',
    title: 'Academic excellence',
    body: 'Quality education and training across multiple verticals, delivered with structured scholarship and professionalism.',
  },
  {
    icon: 'target',
    title: 'Practical skill',
    body: 'A curriculum weighted towards practical skill sets with a quality orientation, not theory alone.',
  },
  {
    icon: 'globe',
    title: 'Nationally rooted, globally relevant',
    body: 'National rootedness, regional recognition and global relevance — the university’s own stated ambition.',
  },
  {
    icon: 'users',
    title: 'Responsibility to stakeholders',
    body: 'Value created through economic, social and environmental development, with compassionate and capable leadership.',
  },
];

/* --------------------------------------------------------------- footer --- */

export const FOOTER_LINKS = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', to: '/#how' },
      { label: 'Features', to: '/#features' },
      { label: 'For students', to: '/#audiences' },
      { label: 'For faculty', to: '/#audiences' },
      { label: 'Sign in', to: '/login' },
    ],
  },
  {
    title: 'University',
    links: [
      { label: 'About us', to: '/about' },
      { label: 'Our history', to: '/about#history' },
      { label: 'Faculties', to: '/about#faculties' },
      { label: 'Accreditation', to: '/about#recognition' },
      { label: 'Contact', to: '/about#contact' },
    ],
  },
  {
    title: 'More',
    links: [
      { label: 'Student resources', to: '/#features' },
      { label: 'Staff portal', to: '/staff' },
      { label: 'Documentation', href: 'https://www.glsuniversity.ac.in', external: true },
      { label: 'GLS University', href: 'https://www.glsuniversity.ac.in', external: true },
      { label: 'Gujarat Law Society', href: 'https://www.gujaratlawsociety.org', external: true },
    ],
  },
];

export const FOOTER_LEGAL = [
  { label: 'Privacy', to: '/about#contact' },
  { label: 'Terms of service', to: '/about#contact' },
  { label: 'Accessibility', to: '/about#contact' },
];

export const SOCIALS = [
  { icon: 'globe', label: 'Website', href: 'https://www.glsuniversity.ac.in' },
  { icon: 'linkedin', label: 'LinkedIn', href: 'https://www.glsuniversity.ac.in' },
  { icon: 'instagram', label: 'Instagram', href: 'https://www.glsuniversity.ac.in' },
  { icon: 'youtube', label: 'YouTube', href: 'https://www.glsuniversity.ac.in' },
];

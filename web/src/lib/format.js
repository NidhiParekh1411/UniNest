export const BRANCH_NAMES = { CE: 'Computer Engineering', IT: 'Information Technology', ME: 'Mechanical Engineering', ALL: 'All branches' };
export const BRANCHES = ['CE', 'IT', 'ME'];
export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const todayName = () => DAYS[(new Date().getDay() + 6) % 7] ?? null;

export function initials(name = '') {
  return name.replace(/^(Dr|Prof)\.\s*/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export function formatDate(value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', opts);
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

// "3 days ago", "in 5 days" — relative phrasing reads faster than a date when
// the whole point is how soon something is.
export function relative(value) {
  if (!value) return '—';
  const diff = new Date(value).getTime() - Date.now();
  const abs = Math.abs(diff);
  const day = 86400000;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 3600000) return rtf.format(Math.round(diff / 60000), 'minute');
  if (abs < day) return rtf.format(Math.round(diff / 3600000), 'hour');
  if (abs < day * 30) return rtf.format(Math.round(diff / day), 'day');
  return formatDate(value);
}

export function fileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Attendance below 75% is a hard eligibility line in the regulations, so the
// tone thresholds mirror the policy rather than being arbitrary.
export function attendanceTone(percent) {
  if (percent < 65) return 'bad';
  if (percent < 75) return 'warn';
  return 'ok';
}

export function marksTone(percent) {
  if (percent < 40) return 'bad';
  if (percent < 55) return 'warn';
  return 'ok';
}

export const FILE_LABELS = { pdf: 'PDF', word: 'Word', excel: 'Excel', slides: 'Slides', image: 'Image', text: 'Text' };

// The single network seam. Every request in the app goes through here, so
// auth headers, error shape and JSON handling exist in exactly one place.

const TOKEN_KEY = 'cra.token';

export const token = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (v) => { try { v ? localStorage.setItem(TOKEN_KEY, v) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ } },
};

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function request(path, { method = 'GET', body, formData, signal } = {}) {
  const headers = {};
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (body && !formData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: formData ?? (body ? JSON.stringify(body) : undefined),
    signal,
  });

  if (res.status === 204) return null;

  let payload = null;
  try { payload = await res.json(); } catch { /* non-JSON response */ }

  if (!res.ok) {
    // A 401 anywhere means the session is gone; clear it so the app returns to
    // sign-in rather than looping on failed requests.
    if (res.status === 401) token.set(null);
    throw new ApiError(payload?.error ?? `Request failed (${res.status})`, res.status);
  }
  return payload;
}

const qs = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
};

export const api = {
  login: (email, password, portal) => request('/auth/login', { method: 'POST', body: { email, password, portal } }),
  me: () => request('/auth/me'),
  demoAccounts: () => request('/auth/demo-accounts'),

  overview: () => request('/overview'),

  ask: (body, signal) => request('/chat/ask', { method: 'POST', body, signal }),
  suggest: (q, signal) => request(`/chat/suggest${qs({ q })}`, { signal }),
  conversations: () => request('/chat/conversations'),
  conversation: (id) => request(`/chat/conversations/${id}`),
  deleteConversation: (id) => request(`/chat/conversations/${id}`, { method: 'DELETE' }),
  engineStatus: () => request('/chat/status'),

  subjects: (params) => request(`/academics/subjects${qs(params)}`),
  timetable: (params) => request(`/academics/timetable${qs(params)}`),
  attendance: (params) => request(`/academics/attendance${qs(params)}`),
  results: (params) => request(`/academics/results${qs(params)}`),
  markAttendance: (body) => request('/academics/attendance/mark', { method: 'POST', body }),
  publishResults: (body) => request('/academics/results/publish', { method: 'POST', body }),

  documents: (params) => request(`/documents${qs(params)}`),
  document: (id) => request(`/documents/${id}`),
  uploadDocument: (formData) => request('/documents', { method: 'POST', formData }),
  deleteDocument: (id) => request(`/documents/${id}`, { method: 'DELETE' }),
  analyseDocument: (id) => request(`/documents/${id}/analyse`, { method: 'POST' }),

  assignments: () => request('/assignments'),
  createAssignment: (body) => request('/assignments', { method: 'POST', body }),
  submissions: (id) => request(`/assignments/${id}/submissions`),
  submitAssignment: (id, formData) => request(`/assignments/${id}/submit`, { method: 'POST', formData }),
  gradeSubmission: (id, body) => request(`/assignments/submissions/${id}/grade`, { method: 'POST', body }),

  announcements: () => request('/announcements'),
  createAnnouncement: (body) => request('/announcements', { method: 'POST', body }),
  publishNow: (id) => request(`/announcements/${id}/publish-now`, { method: 'POST' }),
  deleteAnnouncement: (id) => request(`/announcements/${id}`, { method: 'DELETE' }),

  questionBanks: () => request('/question-banks'),
  questionBank: (id) => request(`/question-banks/${id}`),
  generateQuestionBank: (body) => request('/question-banks/generate', { method: 'POST', body }),
  updateQuestionBank: (id, body) => request(`/question-banks/${id}`, { method: 'PATCH', body }),
  deleteQuestionBank: (id) => request(`/question-banks/${id}`, { method: 'DELETE' }),

  users: (params) => request(`/users${qs(params)}`),
  createUser: (body) => request('/users', { method: 'POST', body }),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PATCH', body }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  assignSubject: (subjectId, facultyId) => request(`/users/subjects/${subjectId}/assign`, { method: 'POST', body: { facultyId } }),

  // Files cannot be linked to directly: every route is behind a bearer token,
  // and neither <a download> nor <iframe src> can carry an Authorization
  // header. So the bytes are fetched like any other request and handed to the
  // browser as a blob URL, which an <iframe>, an <img> and a download link all
  // accept. Callers own the URL and must revoke it.
  fileUrl: (kind, id) => `/api/${kind}/${id}/file`,

  async fileBlob(kind, id, { signal } = {}) {
    const headers = {};
    const t = token.get();
    if (t) headers.Authorization = `Bearer ${t}`;
    const res = await fetch(`/api/${kind}/${id}/file`, { headers, signal });
    if (!res.ok) {
      if (res.status === 401) token.set(null);
      let payload = null;
      try { payload = await res.json(); } catch { /* not JSON */ }
      throw new ApiError(payload?.error ?? `Could not load the file (${res.status})`, res.status);
    }
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), type: blob.type, size: blob.size };
  },

  async downloadFile(kind, id, filename) {
    const { url } = await this.fileBlob(kind, id);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking immediately can cancel the download in some browsers; a tick is
    // enough for the navigation to have taken the bytes.
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  },
};

export default api;

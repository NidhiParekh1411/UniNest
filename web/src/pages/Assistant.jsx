import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Icon from '../components/Icon.jsx';
import Logo, { Mascot } from '../components/Logo.jsx';
import { Badge, Button, Field, Note } from '../components/ui.jsx';
import { Ring } from '../components/Charts.jsx';
import { attendanceTone, formatDate, relative } from '../lib/format.js';

// Suggestion icons come from the API as names; anything unrecognised falls back
// to a document icon rather than rendering nothing.
const SUGGEST_ICONS = new Set(['calendar', 'chart', 'doc', 'sparkle', 'megaphone', 'clipboard', 'upload', 'user', 'book', 'clock', 'alert']);
const suggestIcon = (name) => (SUGGEST_ICONS.has(name) ? name : 'doc');

const KIND_LABEL = {
  action: ['sparkle', 'Ready when you confirm'],
  structured: ['grid', 'From your records'],
  document: ['doc', 'From official documents'],
  clarify: ['alert', 'Needs one detail'],
  abstain: ['shield', 'Not found'],
};

/* ------------------------------------------------------- structured payloads
   A record answer is a sentence plus the actual data. Rendering the table or
   the chart inline is the difference between being told your attendance is low
   and being shown which subjects are dragging it down. */

/* ------------------------------------------------------------------- actions
   The assistant proposes; the user commits. Every card below is pre-filled from
   the question and does nothing until Confirm is pressed, and each one posts to
   the same endpoint its screen uses — so the server-side role checks are the
   ones that already exist, and chat never becomes a second way in. */

const ACTION_SUBMIT = {
  createAssignment: (v) => api.createAssignment({
    subjectId: v.subjectId, title: v.title, description: v.description,
    dueDate: v.dueDate, maxMarks: Number(v.maxMarks) || 10,
  }).then((r) => `Created “${r.assignment.title}”, due ${formatDate(r.assignment.dueDate)}.`),

  submitAssignment: (v) => {
    const fd = new FormData();
    fd.append('file', v.file);
    if (v.note) fd.append('note', v.note);
    // The server's own message is used rather than a local one: it is the thing
    // that knows whether this counted as late.
    return api.submitAssignment(v.assignmentId, fd).then((r) => r.message);
  },

  createAnnouncement: (v) => api.createAnnouncement({
    title: v.title, body: v.body, audience: v.audience,
    branch: v.branch, publishAt: v.publishAt || undefined,
  }).then((r) => r.message),

  generateQuestionBank: (v) => api.generateQuestionBank({
    documentId: v.documentId, subjectId: v.subjectId || null,
    count: Number(v.count) || 12, difficulty: v.difficulty,
    // Carries the offline-draft caveat when no model was available, which the
    // reader needs in order to judge how much editing the draft wants.
  }).then((r) => `${r.message} ${r.bank.questions?.length ?? 0} questions are in the draft — open Question Banks to review and publish.`),
};

function ActionField({ field, value, onChange }) {
  const id = `act-${field.name}`;
  const common = { id, className: 'input', value: value ?? '', onChange: (e) => onChange(field.name, e.target.value) };
  return (
    <Field label={field.label} hint={field.hint} id={id}>
      {field.type === 'select' ? (
        <select {...common} className="select">
          {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea {...common} className="textarea" rows={3} placeholder={field.placeholder} />
      ) : field.type === 'file' ? (
        <input id={id} className="input" type="file" accept={field.accept}
          onChange={(e) => onChange(field.name, e.target.files?.[0] ?? null)} />
      ) : (
        <input {...common} type={field.type} placeholder={field.placeholder} />
      )}
    </Field>
  );
}

function ActionCard({ action, onDone }) {
  const [values, setValues] = useState(() => Object.fromEntries((action.fields ?? []).map((f) => [f.name, f.value ?? ''])));
  const [grades, setGrades] = useState(() => Object.fromEntries((action.rows ?? []).map((r) => [r.submissionId, { marks: '', feedback: '' }])));
  const [state, setState] = useState({ busy: false, error: null, done: null });

  const set = (name, v) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async () => {
    setState({ busy: true, error: null, done: null });
    try {
      if (action.name === 'gradeSubmissions') {
        // Only the rows actually filled in are sent — a half-finished list is a
        // normal way to work through marking, not an error.
        const entries = Object.entries(grades).filter(([, g]) => g.marks !== '');
        if (!entries.length) throw new Error('Enter marks for at least one submission.');
        for (const [id, g] of entries) {
          await api.gradeSubmission(id, { marks: Number(g.marks), feedback: g.feedback || '' });
        }
        setState({ busy: false, error: null, done: `Graded ${entries.length} submission${entries.length === 1 ? '' : 's'}.` });
        onDone?.();
        return;
      }
      const missing = (action.fields ?? []).find((f) => f.required && !values[f.name]);
      if (missing) throw new Error(`${missing.label} is required.`);
      const message = await ACTION_SUBMIT[action.name](values);
      setState({ busy: false, error: null, done: message });
      onDone?.();
    } catch (err) {
      setState({ busy: false, error: err.message, done: null });
    }
  };

  if (state.done) {
    return (
      <div className="chat-data">
        <div style={{ padding: 'var(--s5)' }}>
          <Note tone="ok" icon="check">{state.done}</Note>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-data">
      <div className="chat-data-head row-between">
        <span className="eyebrow">{action.title}</span>
        {action.rows && <Badge tone="peach">{action.rows.length} waiting</Badge>}
      </div>
      <div style={{ padding: 'var(--s5)' }}>
        {action.fields?.map((f) => (
          <ActionField key={f.name} field={f} value={values[f.name]} onChange={set} />
        ))}

        {action.rows && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Student</th><th>Assignment</th><th style={{ textAlign: 'right' }}>Marks</th><th>Feedback</th></tr>
              </thead>
              <tbody>
                {action.rows.map((r) => (
                  <tr key={r.submissionId}>
                    <td className="cell-strong">{r.student}{r.late && <> <Badge tone="bad">Late</Badge></>}</td>
                    <td className="muted">{r.assignment}</td>
                    <td className="cell-num" style={{ whiteSpace: 'nowrap' }}>
                      <input className="input input-inline" type="number" min="0" max={r.maxMarks}
                        value={grades[r.submissionId].marks}
                        onChange={(e) => setGrades((p) => ({ ...p, [r.submissionId]: { ...p[r.submissionId], marks: e.target.value } }))} />
                      <span className="muted"> / {r.maxMarks}</span>
                    </td>
                    <td>
                      <input className="input input-inline" type="text" placeholder="Optional"
                        value={grades[r.submissionId].feedback}
                        onChange={(e) => setGrades((p) => ({ ...p, [r.submissionId]: { ...p[r.submissionId], feedback: e.target.value } }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {action.note && <p className="field-hint" style={{ marginTop: 'var(--s3)' }}>{action.note}</p>}
        {state.error && <div style={{ marginTop: 'var(--s3)' }}><Note tone="bad" icon="alert">{state.error}</Note></div>}

        <div className="row-end" style={{ gap: 'var(--s3)', marginTop: 'var(--s5)' }}>
          <Button variant="primary" onClick={submit} disabled={state.busy}>
            {state.busy ? 'Working…' : action.submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DataBlock({ data }) {
  if (!data) return null;

  if (data.type === 'timetable') {
    const byDay = data.rows.reduce((acc, r) => {
      (acc[r.day] ??= []).push(r);
      return acc;
    }, {});
    return (
      <div className="chat-data">
        <div className="chat-data-head">
          <span className="eyebrow">
            {data.self ? 'Your teaching week' : `${data.branch} · Semester ${data.semester}`}{data.day ? ` · ${data.day}` : ''}
          </span>
        </div>
        <div className="slots" style={{ padding: 'var(--s2) var(--s4) var(--s3)' }}>
          {Object.entries(byDay).map(([day, rows]) => (
            <div key={day} style={{ marginTop: 'var(--s3)' }}>
              {!data.day && <p className="eyebrow" style={{ marginBottom: 4 }}>{day}</p>}
              {rows.map((r, i) => (
                <div className={`slot${r.type === 'lab' ? ' slot-lab' : ''}`} key={i}>
                  <span className="slot-time">
                    <span className="slot-time-start">{r.startTime}</span>
                    <span className="slot-time-end">{r.endTime}</span>
                  </span>
                  <span className="slot-body">
                    <span className="slot-title">{r.subject}</span>
                    <span className="slot-meta">{r.room} · {r.cohort ?? r.faculty}</span>
                  </span>
                  {r.type === 'lab' && <Badge tone="lavender">Lab</Badge>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.type === 'attendance') {
    /* A ring per subject rather than a stack of bars. Five bars of near-equal
       length all read as "fine"; five rings read as five subjects, and the
       number a student came here for is in the middle of each one. */
    return (
      <div className="chat-data">
        <div className="chat-data-head row-between">
          <span className="eyebrow">By subject</span>
          <Badge tone={attendanceTone(data.overall)}>{data.overall}% overall</Badge>
        </div>
        <div className="ring-grid">
          {data.bySubject.map((s) => (
            <div className="ring-card" key={s.subjectId}>
              <Ring value={s.percent} tone={attendanceTone(s.percent)} />
              <span className="ring-title">{s.subject}</span>
              <span className="ring-meta">{s.attended} of {s.total}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.type === 'results') {
    return (
      <div className="chat-data">
        <div className="chat-data-head"><span className="eyebrow">Marks by subject</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Subject</th><th style={{ textAlign: 'right' }}>Marks</th><th style={{ textAlign: 'right' }}>%</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td className="cell-strong">{r.subject}</td>
                  <td className="cell-num">{r.marks}/{r.maxMarks}</td>
                  <td className="cell-num">{r.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  /* A cohort answer. The sentence names the count and the extreme; the table is
     where a professor actually works, so it carries the enrolment number they
     need to act on. Status lives on the badge only — painting the row by
     threshold makes a screen where most rows are fine read as one colour. */
  if (data.type === 'studentTable') {
    const marks = data.measure === 'marks';
    const tone = (p) => (marks ? (p >= 60 ? 'ok' : p >= 40 ? 'warn' : 'bad') : attendanceTone(p));
    return (
      <div className="chat-data">
        <div className="chat-data-head row-between">
          <span className="eyebrow">{marks ? 'By marks' : 'By attendance'}</span>
          <Badge tone="sky">{data.rows.length} student{data.rows.length === 1 ? '' : 's'}</Badge>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Enrolment</th>
                <th>Sem</th>
                <th style={{ textAlign: 'right' }}>{marks ? 'Marks' : 'Attended'}</th>
                <th style={{ textAlign: 'right' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.enrollment || r.name}>
                  <td className="cell-strong">{r.name}</td>
                  <td className="mono">{r.enrollment}</td>
                  <td className="cell-num">{r.branch} {r.semester}</td>
                  <td className="cell-num">{marks ? `${r.marks}/${r.maxMarks}` : `${r.attended}/${r.total}`}</td>
                  <td className="cell-num"><Badge tone={tone(r.percent)}>{r.percent}%</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.type === 'semesterTable') {
    return (
      <div className="chat-data">
        <div className="chat-data-head"><span className="eyebrow">By semester</span></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Semester</th><th style={{ textAlign: 'right' }}>Marks</th><th style={{ textAlign: 'right' }}>%</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.semester}>
                  <td className="cell-strong">Semester {r.semester}</td>
                  <td className="cell-num">{r.marks}/{r.maxMarks}</td>
                  <td className="cell-num">{r.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.type === 'subjects') {
    return (
      <div className="chat-data">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Code</th><th>Subject</th><th>Faculty</th></tr></thead>
            <tbody>
              {data.rows.map((s) => (
                <tr key={s.id}><td className="mono">{s.code}</td><td className="cell-strong">{s.name}</td><td className="muted">{s.faculty}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.type === 'assignments') {
    return (
      <div className="chat-data">
        <div style={{ padding: 'var(--s2) var(--s4)' }}>
          {data.rows.slice(0, 6).map((a) => (
            <div className="list-row" key={a.id}>
              <span className="grow">
                <span className="list-title">{a.title}</span>
                <span className="list-meta">{a.subject} · due {formatDate(a.dueDate)}</span>
              </span>
              {a.submitted ? <Badge tone="ok">Submitted</Badge> : a.overdue ? <Badge tone="bad">Overdue</Badge> : <Badge tone="warn">Pending</Badge>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.type === 'announcements') {
    return (
      <div className="chat-data">
        <div style={{ padding: 'var(--s2) var(--s4)' }}>
          {data.rows.map((a) => (
            <div className="list-row" key={a.id}>
              <span className="grow">
                <span className="list-title">{a.title}</span>
                <span className="list-meta">{relative(a.publishAt)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.type === 'documents') {
    return (
      <div className="chat-data">
        <div style={{ padding: 'var(--s2) var(--s4)' }}>
          {data.rows.map((d) => (
            <div className="list-row" key={d.id}>
              <Icon name="doc" size={16} className="dim" />
              <span className="grow">
                <span className="list-title">{d.title}</span>
                <span className="list-meta">{d.fileName} · {relative(d.uploadedAt)}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.type === 'faculty') {
    return (
      <div className="chat-data">
        <div style={{ padding: 'var(--s4)' }} className="row">
          <span className="avatar avatar-lg">{data.faculty.name.replace(/^(Dr|Prof)\.\s*/, '').split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
          <span>
            <span className="list-title" style={{ display: 'block' }}>{data.faculty.name}</span>
            <span className="list-meta">{data.faculty.department} · {data.faculty.email}</span>
          </span>
        </div>
      </div>
    );
  }

  return null;
}

/* ------------------------------------------------------------------ message */

function AssistantMessage({ message }) {
  const [icon, label] = KIND_LABEL[message.kind] ?? KIND_LABEL.document;
  const [openCitation, setOpenCitation] = useState(null);

  return (
    <div className="msg msg-assistant">
      <span className="msg-avatar" aria-hidden="true"><Logo size={19} /></span>
      <div className="msg-body">
        <div className="msg-kind"><Icon name={icon} size={12} />{label}</div>
        <p className={`msg-text${message.kind === 'abstain' ? ' abstain' : ''}`}>{message.text}</p>

        <DataBlock data={message.data} />

        {message.action && <ActionCard action={message.action} />}

        {message.citations?.length > 0 && (
          <div className="citations">
            {message.citations.map((c, i) => (
              <button
                key={`${c.docId}-${i}`}
                type="button"
                className="citation"
                onClick={() => setOpenCitation(openCitation === i ? null : i)}
                aria-expanded={openCitation === i}
              >
                <span className="citation-head">
                  <span className="citation-index">{i + 1}</span>
                  <span className="citation-title">{c.title}</span>
                </span>
                <span className="citation-meta">
                  {[c.section, c.page ? `page ${c.page}` : null, `updated ${formatDate(c.uploadedAt, { day: 'numeric', month: 'short' })}`].filter(Boolean).join(' · ')}
                </span>
                {openCitation === i && <span className="citation-excerpt">“{c.excerpt}…”</span>}
              </button>
            ))}
          </div>
        )}

        {message.followUp && (
          <div className="followup">
            <p className="eyebrow">{message.followUp.question}</p>
            <div className="followup-options">
              {message.followUp.options.map((o) => (
                <button
                  key={String(o.value)}
                  className="chip"
                  onClick={() => message.onFollowUp?.(message.followUp.field, o.value, o.label)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- composer */

function Composer({ onSend, busy }) {
  const [value, setValue] = useState('');
  const [groups, setGroups] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const areaRef = useRef(null);
  const wrapRef = useRef(null);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Suggestions are fetched as the user types. The request is debounced and the
  // in-flight one aborted, so a fast typist never sees a stale dropdown.
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => {
      api.suggest(value, controller.signal)
        .then((res) => {
          setGroups(res.groups);
          setHighlight(-1);
        })
        .catch(() => { /* aborted or offline */ });
    }, 130);
    return () => { clearTimeout(t); controller.abort(); };
  }, [value]);

  useEffect(() => {
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const autosize = (el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(140, el.scrollHeight)}px`;
  };

  const send = (text) => {
    const q = (text ?? value).trim();
    if (!q || busy) return;
    setValue('');
    setOpen(false);
    if (areaRef.current) areaRef.current.style.height = 'auto';
    onSend(q);
  };

  const onKeyDown = (e) => {
    if (open && flat.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => (h + 1) % flat.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => (h <= 0 ? flat.length - 1 : h - 1)); return; }
      if (e.key === 'Tab' && highlight >= 0) { e.preventDefault(); setValue(flat[highlight].text); setOpen(false); return; }
      if (e.key === 'Enter' && highlight >= 0) { e.preventDefault(); send(flat[highlight].text); return; }
      if (e.key === 'Escape') { setOpen(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="composer-wrap">
      <div className="composer-inner" ref={wrapRef}>
        {open && groups.length > 0 && (
          <div className="suggest" role="listbox" aria-label="Suggested questions">
            {groups.map((g) => (
              <div className="suggest-group" key={g.label}>
                <p className="eyebrow suggest-label">{g.label}</p>
                {g.items.map((item) => {
                  const index = flat.indexOf(item);
                  return (
                    <button
                      key={item.text}
                      type="button"
                      role="option"
                      aria-selected={highlight === index}
                      className={`suggest-item${highlight === index ? ' highlighted' : ''}`}
                      // Each row carries its position so the list arrives one
                      // after another rather than all at once. Index is taken
                      // across the flattened list, so the stagger continues
                      // through the group headings instead of restarting.
                      style={{ '--i': index }}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => send(item.text)}
                    >
                      <span className="suggest-icon"><Icon name={suggestIcon(item.icon)} size={15} /></span>
                      <span className="grow">{item.text}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        <div className="composer">
          <textarea
            ref={areaRef}
            rows={1}
            value={value}
            placeholder="Ask about attendance, results, a policy, your timetable…"
            aria-label="Ask a question"
            onChange={(e) => { setValue(e.target.value); autosize(e.target); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          <button className="composer-send" onClick={() => send()} disabled={!value.trim() || busy} aria-label="Send">
            <Icon name="send" size={16} />
          </button>
        </div>
        <p className="dim" style={{ fontSize: 'var(--fs-2xs)', marginTop: 6, textAlign: 'center' }}>
          Start typing a keyword — “exam”, “fees”, “attendance” — for suggested actions.
        </p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- page */

export default function Assistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [starters, setStarters] = useState([]);
  const [engine, setEngine] = useState(null);
  const scrollRef = useRef(null);
  const lastQuestion = useRef(null);
  // Accumulated across one question's follow-ups, reset by the next question.
  const pendingOverrides = useRef({});

  useEffect(() => {
    api.suggest('').then((res) => setStarters(res.groups?.[0]?.items ?? [])).catch(() => {});
    api.engineStatus().then(setEngine).catch(() => {});
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const send = useCallback(async (question, overrides) => {
    lastQuestion.current = question;
    // A new question starts a new set of answers. Anything carried over from the
    // previous question's follow-ups would silently narrow this one.
    pendingOverrides.current = { ...(overrides ?? {}) };
    setMessages((m) => [...m, { role: 'user', text: question, id: Math.random().toString(36).slice(2) }]);
    setBusy(true);
    try {
      const res = await api.ask({ question, conversationId, overrides });
      setConversationId(res.conversationId);
      setMessages((m) => [...m, {
        role: 'assistant',
        id: Math.random().toString(36).slice(2),
        text: res.answer,
        kind: res.kind,
        data: res.data,
        citations: res.citations,
        followUp: res.followUp,
        action: res.action ?? null,
      }]);
    } catch (err) {
      setMessages((m) => [...m, {
        role: 'assistant', id: Math.random().toString(36).slice(2),
        text: err.message, kind: 'abstain', citations: [],
      }]);
    } finally {
      setBusy(false);
    }
  }, [conversationId]);

  // A follow-up answer re-asks the original question with the missing slot
  // filled in, rather than sending the bare option as a new question.
  //
  // Every answer so far is sent, not just the newest one. Sending one field at a
  // time meant a question needing two of them could never be satisfied: filling
  // the semester dropped the branch, filling the branch dropped the semester,
  // and the assistant asked the same pair forever.
  const onFollowUp = useCallback((field, value, label) => {
    setMessages((m) => [...m, { role: 'user', text: label, id: Math.random().toString(36).slice(2) }]);
    setBusy(true);
    pendingOverrides.current = { ...pendingOverrides.current, [field]: value };
    api.ask({ question: lastQuestion.current, conversationId, overrides: { ...pendingOverrides.current } })
      .then((res) => {
        setConversationId(res.conversationId);
        setMessages((m) => [...m, {
          role: 'assistant', id: Math.random().toString(36).slice(2),
          text: res.answer, kind: res.kind, data: res.data, citations: res.citations, followUp: res.followUp, action: res.action ?? null,
        }]);
      })
      .catch((err) => setMessages((m) => [...m, { role: 'assistant', id: Math.random().toString(36).slice(2), text: err.message, kind: 'abstain', citations: [] }]))
      .finally(() => setBusy(false));
  }, [conversationId]);

  const reset = () => { setMessages([]); setConversationId(null); };

  return (
    <div className="chat">
      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-inner">
          {messages.length === 0 ? (
            <div className="chat-hero">
              <Mascot pose="owl" size={132} className="chat-hero-owl" alt="" />
              <h1 className="chat-hero-title">
                {user.role === 'student' ? `Hello, ${user.name.split(' ')[0]}.` : 'How can I help?'}
              </h1>
              <p className="chat-hero-sub">
                Ask about a policy, a deadline, your timetable or your records. Answers from documents always show the circular they came from — and if the documents don’t cover it, I’ll say so.
              </p>
              <div className="starter-grid">
                {starters.map((s, i) => (
                  <button key={s.text} className="starter" style={{ '--i': i }} onClick={() => send(s.text)}>
                    <Icon name={suggestIcon(s.icon)} size={15} className="dim" />
                    <span className="grow">{s.text}</span>
                    <Icon name="chevron" size={13} className="dim" />
                  </button>
                ))}
              </div>
              {engine && (
                <p className="dim" style={{ fontSize: 'var(--fs-2xs)', marginTop: 'var(--s6)' }}>
                  {engine.label} · {engine.index?.chunks ?? 0} passages indexed
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="row-between" style={{ marginBottom: 'var(--s5)' }}>
                <span className="eyebrow">Conversation</span>
                <Button size="sm" variant="ghost" icon="refresh" onClick={reset}>New</Button>
              </div>
              {messages.map((m) => (
                m.role === 'user'
                  ? <div className="msg msg-user" key={m.id}><div className="msg-user-bubble">{m.text}</div></div>
                  : <AssistantMessage key={m.id} message={{ ...m, onFollowUp }} />
              ))}
              {busy && (
                <div className="msg msg-assistant">
                  <span className="msg-avatar" aria-hidden="true"><Logo size={19} /></span>
                  <div className="msg-body"><span className="typing"><span /><span /><span /></span></div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Composer onSend={send} busy={busy} />
    </div>
  );
}

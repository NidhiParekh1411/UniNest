import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import Icon from '../components/Icon.jsx';
import Logo from '../components/Logo.jsx';
import { Badge, Button } from '../components/ui.jsx';
import { Progress } from '../components/Charts.jsx';
import { attendanceTone, formatDate, relative } from '../lib/format.js';

// Suggestion icons come from the API as names; anything unrecognised falls back
// to a document icon rather than rendering nothing.
const SUGGEST_ICONS = new Set(['calendar', 'chart', 'doc', 'sparkle', 'megaphone', 'clipboard', 'upload', 'user', 'book', 'clock', 'alert']);
const suggestIcon = (name) => (SUGGEST_ICONS.has(name) ? name : 'doc');

const KIND_LABEL = {
  structured: ['grid', 'From your records'],
  document: ['doc', 'From official documents'],
  clarify: ['alert', 'Needs one detail'],
  abstain: ['shield', 'Not found'],
};

/* ------------------------------------------------------- structured payloads
   A record answer is a sentence plus the actual data. Rendering the table or
   the chart inline is the difference between being told your attendance is low
   and being shown which subjects are dragging it down. */

function DataBlock({ data }) {
  if (!data) return null;

  if (data.type === 'timetable') {
    const byDay = data.rows.reduce((acc, r) => {
      (acc[r.day] ??= []).push(r);
      return acc;
    }, {});
    return (
      <div className="chat-data">
        <div className="chat-data-head"><span className="eyebrow">{data.branch} · Semester {data.semester}{data.day ? ` · ${data.day}` : ''}</span></div>
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
                    <span className="slot-meta">{r.room} · {r.faculty}</span>
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
    return (
      <div className="chat-data">
        <div className="chat-data-head row-between">
          <span className="eyebrow">By subject</span>
          <Badge tone={attendanceTone(data.overall)}>{data.overall}% overall</Badge>
        </div>
        <div style={{ padding: 'var(--s3) var(--s4) var(--s4)' }}>
          {data.bySubject.map((s) => (
            <div key={s.subjectId} style={{ marginBottom: 'var(--s3)' }}>
              <div className="row-between" style={{ marginBottom: 5 }}>
                <span style={{ fontSize: 'var(--fs-sm)' }}>{s.subject}</span>
                <span className="num" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{s.percent}%</span>
              </div>
              <Progress value={s.percent} tone={attendanceTone(s.percent)} />
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
  const onFollowUp = useCallback((field, value, label) => {
    setMessages((m) => [...m, { role: 'user', text: label, id: Math.random().toString(36).slice(2) }]);
    setBusy(true);
    api.ask({ question: lastQuestion.current, conversationId, overrides: { [field]: value } })
      .then((res) => {
        setConversationId(res.conversationId);
        setMessages((m) => [...m, {
          role: 'assistant', id: Math.random().toString(36).slice(2),
          text: res.answer, kind: res.kind, data: res.data, citations: res.citations, followUp: res.followUp,
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
              <div className="chat-hero-mark"><Logo size={38} /></div>
              <h1 className="chat-hero-title">
                {user.role === 'student' ? `Hello, ${user.name.split(' ')[0]}.` : 'How can I help?'}
              </h1>
              <p className="chat-hero-sub">
                Ask about a policy, a deadline, your timetable or your records. Answers from documents always show the circular they came from — and if the documents don’t cover it, I’ll say so.
              </p>
              <div className="starter-grid">
                {starters.map((s) => (
                  <button key={s.text} className="starter" onClick={() => send(s.text)}>
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

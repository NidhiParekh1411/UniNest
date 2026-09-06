import { useRef, useState } from 'react';
import api from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import FilePicker from '../components/FilePicker.jsx';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Modal, Note, PageHead, Refreshed, SkeletonList, Table, Tabs } from '../components/ui.jsx';
import { formatDate, relative, FILE_LABELS } from '../lib/format.js';

/* ---------------------------------------------------------------- student */

function SubmitModal({ assignment, onClose, onDone }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.submitAssignment(assignment.id, form);
      toast.success(res.message);
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const overdue = new Date(assignment.dueDate) < new Date();

  return (
    <Modal
      open
      onClose={onClose}
      title={assignment.title}
      subtitle={`${assignment.subject} · due ${formatDate(assignment.dueDate)} · ${assignment.maxMarks} marks`}
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!file || busy} icon="upload">
            {busy ? 'Uploading…' : 'Submit work'}
          </Button>
        </>
      )}
    >
      <div className="stack">
        {assignment.description && <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{assignment.description}</p>}

        {overdue && (
          <Note tone="warn" icon="alert">
            The due date has passed. Your submission will be recorded as late.
          </Note>
        )}

        <Field label="Your work" hint="PDF, Word, Excel, or a clear photograph or scan of handwritten pages. Up to 25 MB.">
          <FilePicker
            file={file}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.heic,.txt"
            hint="PDF · Word · Excel · Image of handwritten notes"
            onChange={setFile}
          />
        </Field>
      </div>
    </Modal>
  );
}

function StudentAssignments({ data, refetch }) {
  const [tab, setTab] = useState('pending');
  const [active, setActive] = useState(null);

  const pending = data.assignments.filter((a) => !a.submission);
  const submitted = data.assignments.filter((a) => a.submission && a.submission.status !== 'graded');
  const graded = data.assignments.filter((a) => a.submission?.status === 'graded');
  const rows = tab === 'pending' ? pending : tab === 'submitted' ? submitted : graded;

  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'pending', label: 'To submit', count: pending.length },
          { value: 'submitted', label: 'Submitted', count: submitted.length },
          { value: 'graded', label: 'Graded', count: graded.length },
        ]}
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={tab === 'pending' ? 'check' : 'inbox'}
            title={tab === 'pending' ? 'Nothing outstanding' : tab === 'submitted' ? 'Nothing awaiting a grade' : 'No graded work yet'}
            body={tab === 'pending' ? 'Every assignment posted for your semester has been submitted.' : 'It will appear here once your faculty acts on it.'}
          />
        </Card>
      ) : (
        <div className="stack" style={{ gap: 'var(--s3)' }}>
          {rows.map((a) => {
            const overdue = !a.submission && new Date(a.dueDate) < new Date();
            return (
              <Card key={a.id} tight>
                <div className="row-between wrap" style={{ alignItems: 'flex-start' }}>
                  <div className="grow" style={{ minWidth: 220 }}>
                    <div className="row" style={{ gap: 'var(--s2)', marginBottom: 4 }}>
                      <span className="list-title">{a.title}</span>
                      {overdue && <Badge tone="bad">Overdue</Badge>}
                      {a.submission?.late && <Badge tone="warn">Late</Badge>}
                      {a.submission?.status === 'graded' && <Badge tone="ok">{a.submission.marks}/{a.maxMarks}</Badge>}
                    </div>
                    <p className="list-meta">
                      {a.subject} · <span className="mono">{a.code}</span> · {a.maxMarks} marks · due {formatDate(a.dueDate)} ({relative(a.dueDate)})
                    </p>
                    {a.description && <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--s2)' }}>{a.description}</p>}
                    {a.submission?.feedback && (
                      <p style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--s3)', paddingLeft: 'var(--s3)', borderLeft: '2px solid var(--border)' }}>
                        <span className="eyebrow" style={{ display: 'block', marginBottom: 2 }}>Feedback</span>
                        {a.submission.feedback}
                      </p>
                    )}
                  </div>
                  <div className="row" style={{ gap: 'var(--s2)' }}>
                    {a.submission
                      ? <Button size="sm" icon="refresh" onClick={() => setActive(a)}>Replace</Button>
                      : <Button size="sm" variant="primary" icon="upload" onClick={() => setActive(a)}>Submit</Button>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {active && <SubmitModal assignment={active} onClose={() => setActive(null)} onDone={refetch} />}
    </>
  );
}

/* ---------------------------------------------------------------- faculty */

function GradeModal({ assignment, onClose, onDone }) {
  const toast = useToast();
  const { data, loading, refetch } = useApi(() => api.submissions(assignment.id), [assignment.id]);
  const [editing, setEditing] = useState(null);
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.gradeSubmission(editing.id, { marks: Number(marks), feedback });
      toast.success(`Graded ${editing.student}.`);
      setEditing(null);
      refetch();
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open wide onClose={onClose}
      title={assignment.title}
      subtitle={`${assignment.subject} · ${assignment.maxMarks} marks · due ${formatDate(assignment.dueDate)}`}
    >
      {loading ? <SkeletonList rows={5} /> : (
        <Table
          keyOf={(r) => r.id}
          columns={[
            { key: 'student', header: 'Student', render: (r) => (<span><span className="cell-strong">{r.student}</span><br /><span className="mono dim">{r.enrollment}</span></span>) },
            {
              key: 'file',
              header: 'Submission',
              render: (r) => (
                <span>
                  <span style={{ fontSize: 'var(--fs-xs)' }}>{FILE_LABELS[r.fileType] ?? 'File'}</span>
                  <br />
                  <span className="dim" style={{ fontSize: 'var(--fs-2xs)' }}>{relative(r.submittedAt)}{r.late ? ' · late' : ''}</span>
                </span>
              ),
            },
            { key: 'marks', header: 'Marks', align: 'right', render: (r) => (r.status === 'graded' ? <Badge tone="ok">{r.marks}/{assignment.maxMarks}</Badge> : <Badge tone="warn">Ungraded</Badge>) },
            {
              key: 'action',
              header: '',
              align: 'right',
              render: (r) => (
                <Button size="sm" onClick={() => { setEditing(r); setMarks(r.marks ?? ''); setFeedback(r.feedback ?? ''); }}>
                  {r.status === 'graded' ? 'Edit' : 'Grade'}
                </Button>
              ),
            },
          ]}
          rows={data?.submissions ?? []}
          empty={<EmptyState icon="inbox" title="No submissions yet" body="Nothing has been submitted for this assignment." />}
        />
      )}

      {editing && (
        <div style={{ marginTop: 'var(--s5)', paddingTop: 'var(--s5)', borderTop: '1px solid var(--border)' }} className="stack">
          <p className="eyebrow">Grading {editing.student}</p>
          <Field label={`Marks out of ${assignment.maxMarks}`}>
            <input className="input" type="number" min="0" max={assignment.maxMarks} value={marks} onChange={(e) => setMarks(e.target.value)} />
          </Field>
          <Field label="Feedback" hint="The student sees this alongside their marks.">
            <textarea className="textarea" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What was strong, and what to work on next time." />
          </Field>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy || marks === ''}>{busy ? 'Saving…' : 'Save grade'}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function CreateModal({ onClose, onDone }) {
  const toast = useToast();
  const { data: subjectData } = useApi(() => api.subjects({ mine: 'true' }), []);
  const [form, setForm] = useState({ subjectId: '', title: '', description: '', dueDate: '', maxMarks: 20 });
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = async () => {
    setBusy(true);
    try {
      await api.createAssignment(form);
      toast.success('Assignment posted to the class.');
      onDone();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open onClose={onClose}
      title="New assignment"
      subtitle="Posted immediately to every student in that subject's cohort"
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={create} disabled={busy || !form.subjectId || !form.title || !form.dueDate}>
            {busy ? 'Posting…' : 'Post assignment'}
          </Button>
        </>
      )}
    >
      <div className="stack">
        <Field label="Subject">
          <select className="select" value={form.subjectId} onChange={set('subjectId')}>
            <option value="">Choose a subject</option>
            {(subjectData?.subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.branch} sem {s.semester}</option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <input className="input" value={form.title} onChange={set('title')} placeholder="Unit 3 problem set" />
        </Field>
        <Field label="Instructions" hint="What to do, and how it should be presented.">
          <textarea className="textarea" value={form.description} onChange={set('description')} />
        </Field>
        <div className="grid-2">
          <Field label="Due date">
            <input className="input" type="date" value={form.dueDate} onChange={set('dueDate')} />
          </Field>
          <Field label="Maximum marks">
            <input className="input" type="number" min="1" value={form.maxMarks} onChange={set('maxMarks')} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function FacultyAssignments({ data, refetch }) {
  const [grading, setGrading] = useState(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="row-between" style={{ marginBottom: 'var(--s4)' }}>
        <span className="eyebrow">{data.assignments.length} assignments</span>
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>New assignment</Button>
      </div>

      {data.assignments.length === 0 ? (
        <Card><EmptyState icon="clipboard" title="No assignments yet" body="Post one and it appears immediately for that subject's cohort." action={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>New assignment</Button>} /></Card>
      ) : (
        <div className="stack" style={{ gap: 'var(--s3)' }}>
          {data.assignments.map((a) => (
            <Card key={a.id} tight>
              <div className="row-between wrap" style={{ alignItems: 'flex-start' }}>
                <div className="grow" style={{ minWidth: 220 }}>
                  <div className="row" style={{ gap: 'var(--s2)', marginBottom: 4 }}>
                    <span className="list-title">{a.title}</span>
                    {a.gradedCount < a.submissionCount && <Badge tone="warn">{a.submissionCount - a.gradedCount} to grade</Badge>}
                  </div>
                  <p className="list-meta">
                    {a.subject} · <span className="mono">{a.code}</span> · {a.branch} sem {a.semester} · due {formatDate(a.dueDate)}
                  </p>
                  <p className="list-meta" style={{ marginTop: 4 }}>
                    {a.submissionCount} of {a.cohortSize} submitted · {a.gradedCount} graded
                  </p>
                </div>
                <Button size="sm" icon="eye" onClick={() => setGrading(a)}>Submissions</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {grading && <GradeModal assignment={grading} onClose={() => setGrading(null)} onDone={refetch} />}
      {creating && <CreateModal onClose={() => setCreating(false)} onDone={refetch} />}
    </>
  );
}

/* -------------------------------------------------------------------- page */

export default function Assignments() {
  const { isStudent } = useAuth();
  const { data, error, loading, version, refetch } = useApi(() => api.assignments(), []);

  return (
    <div className="content">
      <PageHead
        title="Assignments"
        subtitle={isStudent
          ? 'Submit as a PDF, a Word or Excel file, or a photograph of handwritten pages'
          : 'Post work, review submissions and record marks'}
      />
      {loading && <Card><SkeletonList rows={5} /></Card>}
      {error && <ErrorNote onRetry={refetch}>{error}</ErrorNote>}
      {!loading && !error && data && (
        <Refreshed token={version}>
          {isStudent
            ? <StudentAssignments data={data} refetch={refetch} />
            : <FacultyAssignments data={data} refetch={refetch} />}
        </Refreshed>
      )}
    </div>
  );
}

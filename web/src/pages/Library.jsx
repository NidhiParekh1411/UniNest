import { useState } from 'react';
import api from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import Icon from '../components/Icon.jsx';
import FilePicker from '../components/FilePicker.jsx';
import DocumentViewer from '../components/DocumentViewer.jsx';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Modal, PageHead, SkeletonList, Tabs } from '../components/ui.jsx';
import { BRANCHES, BRANCH_NAMES, SEMESTERS, relative, FILE_LABELS } from '../lib/format.js';

const CATEGORIES = [
  { value: 'notes', label: 'Study material' },
  { value: 'circular', label: 'Circular' },
  { value: 'policy', label: 'Policy' },
  { value: 'timetable', label: 'Timetable' },
  { value: 'syllabus', label: 'Syllabus' },
];

const FILE_ICON = { pdf: 'doc', word: 'doc', excel: 'grid', slides: 'layers', image: 'eye', text: 'doc' };

function UploadModal({ onClose, onDone }) {
  const toast = useToast();
  const { data: subjectData } = useApi(() => api.subjects({ mine: 'true' }), []);
  const { data: docData } = useApi(() => api.documents(), []);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: '', category: 'notes', audience: 'all', branch: 'ALL', semester: 0, subjectId: '', supersedes: '' });
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const form_ = new FormData();
      form_.append('file', file);
      Object.entries({ ...form, title: form.title || file.name.replace(/\.[^.]+$/, '') })
        .forEach(([k, v]) => { if (v !== '' && v != null) form_.append(k, v); });
      const res = await api.uploadDocument(form_);
      // Enrichment runs after the response, so a file that parsed to nothing
      // locally is not necessarily a failure — say what is actually happening.
      if (res.warning) toast.error(res.warning);
      else if (res.analysing && res.indexed === 0) toast.success('Uploaded. No text could be parsed locally, so the AI is reading the file now — reopen it in a moment.');
      else if (res.analysing) toast.success(`Indexed ${res.indexed} passages. The AI is summarising it in the background.`);
      else toast.success(`Indexed ${res.indexed} passages. The assistant can answer from this now.`);
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
      title="Upload to the knowledge base"
      icon="upload"
      subtitle="Parsed on upload, chunked and indexed — the assistant answers from it immediately"
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={upload} disabled={!file || busy} icon="upload">{busy ? 'Processing…' : 'Upload & index'}</Button>
        </>
      )}
    >
      <div className="stack">
        <FilePicker
          file={file}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp"
          hint="PDF · Word · Excel · PowerPoint · images of handwritten notes"
          onChange={(f) => {
            setFile(f);
            if (f && !form.title) setForm((s) => ({ ...s, title: f.name.replace(/\.[^.]+$/, '') }));
          }}
        />

        <Field label="Title" hint="How it appears in answers and in the library.">
          <input className="input" value={form.title} onChange={set('title')} placeholder="Examination rules 2025-26" />
        </Field>

        <div className="grid-2">
          <Field label="Category">
            <select className="select" value={form.category} onChange={set('category')}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Who can see it">
            <select className="select" value={form.audience} onChange={set('audience')}>
              <option value="all">Everyone</option>
              <option value="faculty">Faculty and admin only</option>
            </select>
          </Field>
        </div>

        <div className="grid-2">
          <Field label="Branch" hint="Leave as all branches for institute-wide documents.">
            <select className="select" value={form.branch} onChange={set('branch')}>
              <option value="ALL">All branches</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_NAMES[b]}</option>)}
            </select>
          </Field>
          <Field label="Semester">
            <select className="select" value={form.semester} onChange={set('semester')}>
              <option value={0}>All semesters</option>
              {SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </Field>
        </div>

        {subjectData?.subjects?.length > 0 && (
          <Field label="Subject" hint="Optional. Links study material to a subject.">
            <select className="select" value={form.subjectId} onChange={set('subjectId')}>
              <option value="">Not subject-specific</option>
              {subjectData.subjects.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.branch} sem {s.semester}</option>)}
            </select>
          </Field>
        )}

        <Field label="Replaces an existing document" hint="The old version stays readable but is retired from answers, so nothing stale is ever quoted.">
          <select className="select" value={form.supersedes} onChange={set('supersedes')}>
            <option value="">Nothing — this is new</option>
            {(docData?.documents ?? []).filter((d) => !d.superseded).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

export default function Library() {
  const { isStudent, isStaff } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [detail, setDetail] = useState(null);
  const { data, error, loading, refetch } = useApi(() => api.documents(), []);

  const documents = data?.documents ?? [];
  const filtered = tab === 'all' ? documents : documents.filter((d) => d.category === tab);

  const remove = async (doc) => {
    if (!window.confirm(`Remove “${doc.title}” from the knowledge base? Its indexed passages are deleted too.`)) return;
    try {
      await api.deleteDocument(doc.id);
      toast.success('Removed from the knowledge base.');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="content">
      <PageHead
        title="Library"
        subtitle={isStudent
          ? 'Circulars, policies and study material available to your class'
          : 'Everything the assistant can answer from, with version history'}
        action={isStaff ? <Button variant="primary" icon="upload" onClick={() => setUploading(true)}>Upload</Button> : undefined}
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'All', count: documents.length },
          ...CATEGORIES.map((c) => ({ value: c.value, label: c.label, count: documents.filter((d) => d.category === c.value).length }))
            .filter((c) => c.count > 0),
        ]}
      />

      {loading && <Card><SkeletonList rows={6} /></Card>}
      {error && <ErrorNote onRetry={refetch}>{error}</ErrorNote>}

      {!loading && !error && (
        filtered.length === 0
          ? <Card><EmptyState icon="book" title="Nothing here yet" body={isStaff ? 'Upload a circular or a set of notes and the assistant starts answering from it.' : 'Material shared with your class will appear here.'} /></Card>
          : (
            <div className="stack" style={{ gap: 'var(--s2)' }}>
              {filtered.map((d) => (
                <Card key={d.id} tight>
                  <div className="row" style={{ alignItems: 'flex-start' }}>
                    <span style={{ width: 34, height: 34, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', color: 'var(--text-3)', flexShrink: 0 }}>
                      <Icon name={FILE_ICON[d.fileType] ?? 'doc'} size={16} />
                    </span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row wrap" style={{ gap: 'var(--s2)', marginBottom: 2 }}>
                        <span className="list-title">{d.title}</span>
                        {d.superseded && <Badge tone="warn">Superseded</Badge>}
                        {d.version > 1 && !d.superseded && <Badge tone="accent">v{d.version}</Badge>}
                        {d.isDemo && <Badge>Demo</Badge>}
                        {d.needsOcr && <Badge tone="warn">Not searchable</Badge>}
                      </div>
                      <p className="list-meta">
                        {FILE_LABELS[d.fileType] ?? d.fileType} · {d.chunkCount} passages · {d.branch === 'ALL' ? 'All branches' : d.branch}
                        {d.semester ? ` · Sem ${d.semester}` : ''} · {d.uploader} · {relative(d.uploadedAt)}
                      </p>
                    </div>
                    <div className="row" style={{ gap: 4 }}>
                      <Button size="sm" variant="ghost" className="btn-icon" onClick={() => setDetail(d.id)} aria-label="Details"><Icon name="eye" size={15} /></Button>
                      {d.storedName && (
                        <Button
                          size="sm" variant="ghost" className="btn-icon" aria-label="Download"
                          onClick={() => api.downloadFile('documents', d.id, d.fileName).catch((err) => toast.error(err.message))}
                        >
                          <Icon name="download" size={15} />
                        </Button>
                      )}
                      {isStaff && (
                        <Button size="sm" variant="ghost" className="btn-icon" onClick={() => remove(d)} aria-label="Remove"><Icon name="trash" size={15} /></Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
      )}

      {uploading && <UploadModal onClose={() => setUploading(false)} onDone={refetch} />}
      {detail && <DocumentViewer id={detail} onClose={() => { setDetail(null); refetch(); }} />}
    </div>
  );
}

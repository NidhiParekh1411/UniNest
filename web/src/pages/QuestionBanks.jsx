import { useState } from 'react';
import api from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useToast } from '../lib/toast.jsx';
import Icon from '../components/Icon.jsx';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Modal, PageHead, SkeletonList } from '../components/ui.jsx';
import { relative } from '../lib/format.js';

const BLOOM_TONE = { Remember: 'neutral', Understand: 'accent', Apply: 'warn', Analyse: 'ok' };

function GenerateModal({ onClose, onDone }) {
  const toast = useToast();
  const { data: docData, loading: docsLoading } = useApi(() => api.documents(), []);
  const { data: subjectData } = useApi(() => api.subjects({ mine: 'true' }), []);
  const [form, setForm] = useState({ documentId: '', subjectId: '', count: 12, difficulty: 'mixed' });
  const [busy, setBusy] = useState(false);

  // Only documents with extractable text can seed a paper.
  const sources = (docData?.documents ?? []).filter((d) => d.chunkCount > 0 && !d.superseded);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const generate = async () => {
    setBusy(true);
    try {
      const res = await api.generateQuestionBank({ ...form, count: Number(form.count) });
      toast.success(res.message);
      onDone(res.bank.id);
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
      title="Generate a question bank"
      subtitle="Drafted from your own material — you review and edit before anything is published"
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="sparkle" onClick={generate} disabled={busy || !form.documentId}>
            {busy ? 'Drafting…' : 'Generate draft'}
          </Button>
        </>
      )}
    >
      <div className="stack">
        <Field label="Source material" hint="Slides, notes or a syllabus you have uploaded. Image-only files cannot be used until OCR is available.">
          {docsLoading ? <div className="skeleton" style={{ height: 38 }} /> : (
            <select className="select" value={form.documentId} onChange={set('documentId')}>
              <option value="">Choose a document</option>
              {sources.map((d) => <option key={d.id} value={d.id}>{d.title} ({d.chunkCount} passages)</option>)}
            </select>
          )}
        </Field>

        <Field label="Subject" hint="Optional. Tags the paper so students see it under the right subject once published.">
          <select className="select" value={form.subjectId} onChange={set('subjectId')}>
            <option value="">Not linked to a subject</option>
            {(subjectData?.subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} — {s.branch} sem {s.semester}</option>)}
          </select>
        </Field>

        <div className="grid-2">
          <Field label="Number of questions">
            <input className="input" type="number" min="4" max="30" value={form.count} onChange={set('count')} />
          </Field>
          <Field label="Weighting">
            <select className="select" value={form.difficulty} onChange={set('difficulty')}>
              <option value="easy">Easy — 2 and 4 mark questions</option>
              <option value="mixed">Mixed — 3 and 7 mark questions</option>
              <option value="hard">Hard — 4 and 10 mark questions</option>
            </select>
          </Field>
        </div>

        <p className="dim" style={{ fontSize: 'var(--fs-xs)' }}>
          Drafts are never published automatically. Nothing reaches students until you review the questions and publish the bank yourself.
        </p>
      </div>
    </Modal>
  );
}

function BankDetail({ id, onClose, onChanged }) {
  const toast = useToast();
  const { data, loading, refetch } = useApi(() => api.questionBank(id), [id]);
  const [busy, setBusy] = useState(false);
  const bank = data?.bank;

  const setStatus = async (status) => {
    setBusy(true);
    try {
      await api.updateQuestionBank(id, { status });
      toast.success(status === 'published' ? 'Published — students in this subject can now see it.' : 'Moved back to draft.');
      refetch();
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeQuestion = async (qid) => {
    const questions = bank.questions.filter((q) => q.id !== qid);
    try {
      await api.updateQuestionBank(id, { questions });
      refetch();
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Modal
      open wide onClose={onClose}
      title={bank?.title ?? 'Question bank'}
      subtitle={bank ? `${bank.questions.length} questions · ${bank.totalMarks} marks · drafted from “${bank.sourceTitle}”` : undefined}
      footer={bank ? (
        <>
          <Button onClick={onClose}>Close</Button>
          {bank.status === 'draft'
            ? <Button variant="primary" icon="check" onClick={() => setStatus('published')} disabled={busy}>Publish to students</Button>
            : <Button onClick={() => setStatus('draft')} disabled={busy}>Unpublish</Button>}
        </>
      ) : undefined}
    >
      {loading ? <SkeletonList rows={5} /> : bank && (
        <div>
          <div className="row wrap" style={{ gap: 'var(--s2)', marginBottom: 'var(--s5)' }}>
            <Badge tone={bank.status === 'published' ? 'ok' : 'warn'}>{bank.status === 'published' ? 'Published' : 'Draft — not visible to students'}</Badge>
            <Badge>{bank.engine === 'gemini' ? 'Generated with Gemini' : 'Generated offline from the document'}</Badge>
            <Badge tone="accent">{bank.difficulty}</Badge>
          </div>

          {bank.engine !== 'gemini' && (
            <div className="note" style={{ marginBottom: 'var(--s5)' }}>
              Drafted offline by mining definitions, key concepts and section headings out of the source. Phrasing will need more editing than a language-model draft — set <span className="mono">GEMINI_API_KEY</span> to enable that path.
            </div>
          )}

          {bank.questions.map((q, i) => (
            <div className="qb-item" key={q.id}>
              <div className="row-between wrap">
                <div className="row" style={{ gap: 'var(--s2)' }}>
                  <span className="mono dim">Q{i + 1}</span>
                  <Badge>{q.type === 'mcq' ? 'Multiple choice' : q.type === 'short' ? 'Short answer' : 'Long answer'}</Badge>
                  <Badge tone={BLOOM_TONE[q.bloom] ?? 'neutral'}>{q.bloom}</Badge>
                  <Badge tone="accent">{q.marks} {q.marks === 1 ? 'mark' : 'marks'}</Badge>
                </div>
                <Button size="sm" variant="ghost" className="btn-icon" onClick={() => removeQuestion(q.id)} aria-label="Remove question">
                  <Icon name="trash" size={14} />
                </Button>
              </div>

              <p className="qb-q">{q.question}</p>

              {q.options && (
                <div className="qb-options">
                  {q.options.map((o, oi) => (
                    <span className={`qb-option${o === q.answer ? ' correct' : ''}`} key={oi}>
                      <span className="mono">{String.fromCharCode(65 + oi)}.</span>
                      <span>{o}</span>
                      {o === q.answer && <Icon name="check" size={13} />}
                    </span>
                  ))}
                </div>
              )}

              {q.answer && q.type !== 'mcq' && (
                <p className="qb-answer"><span className="eyebrow" style={{ display: 'block', marginBottom: 3 }}>Model answer</span>{q.answer}</p>
              )}
              {q.sourceSection && <p className="dim" style={{ fontSize: 'var(--fs-2xs)', marginTop: 'var(--s2)' }}>Source section: {q.sourceSection}</p>}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default function QuestionBanks() {
  const toast = useToast();
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(null);
  const { data, error, loading, refetch } = useApi(() => api.questionBanks(), []);

  const banks = data?.banks ?? [];

  const remove = async (b) => {
    if (!window.confirm(`Delete “${b.title}”?`)) return;
    try { await api.deleteQuestionBank(b.id); toast.success('Deleted.'); refetch(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div className="content">
      <PageHead
        title="Question banks"
        subtitle="Turn your own slides or notes into a draft paper — reviewed by you before students see it"
        action={<Button variant="primary" icon="sparkle" onClick={() => setGenerating(true)}>Generate</Button>}
      />

      {loading && <Card><SkeletonList rows={4} /></Card>}
      {error && <ErrorNote onRetry={refetch}>{error}</ErrorNote>}

      {!loading && !error && (
        banks.length === 0
          ? (
            <Card>
              <EmptyState
                icon="layers"
                title="No question banks yet"
                body="Pick a document you have uploaded and the agent drafts a paper from it — multiple choice, short answers and long answers across Bloom levels."
                action={<Button variant="primary" icon="sparkle" onClick={() => setGenerating(true)}>Generate one</Button>}
              />
            </Card>
          )
          : (
            <div className="stack" style={{ gap: 'var(--s2)' }}>
              {banks.map((b) => (
                <Card key={b.id} tight>
                  <div className="row-between wrap" style={{ alignItems: 'flex-start' }}>
                    <div className="grow" style={{ minWidth: 220 }}>
                      <div className="row wrap" style={{ gap: 'var(--s2)', marginBottom: 4 }}>
                        <span className="list-title">{b.title}</span>
                        <Badge tone={b.status === 'published' ? 'ok' : 'warn'}>{b.status === 'published' ? 'Published' : 'Draft'}</Badge>
                      </div>
                      <p className="list-meta">
                        {b.questionCount} questions · {b.totalMarks} marks
                        {b.subject ? ` · ${b.subject}` : ''} · {b.author} · {relative(b.createdAt)}
                      </p>
                    </div>
                    <div className="row" style={{ gap: 4 }}>
                      <Button size="sm" icon="eye" onClick={() => setOpen(b.id)}>Review</Button>
                      <Button size="sm" variant="ghost" className="btn-icon" onClick={() => remove(b)} aria-label="Delete"><Icon name="trash" size={15} /></Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )
      )}

      {generating && <GenerateModal onClose={() => setGenerating(false)} onDone={(id) => { refetch(); setOpen(id); }} />}
      {open && <BankDetail id={open} onClose={() => setOpen(null)} onChanged={refetch} />}
    </div>
  );
}

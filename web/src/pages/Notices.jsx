import { useState } from 'react';
import api from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import Icon from '../components/Icon.jsx';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Modal, PageHead, SkeletonList, Tabs } from '../components/ui.jsx';
import { BRANCHES, BRANCH_NAMES, SEMESTERS, formatDateTime, relative } from '../lib/format.js';

// Scheduling in local time: the input is a datetime-local value, converted to
// an ISO instant on submit. A blank value means publish now.
function localNowPlus(hours) {
  const d = new Date(Date.now() + hours * 3600000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function ComposeModal({ onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: '', body: '', audience: 'all', branch: 'ALL', semester: 0 });
  const [when, setWhen] = useState('now');
  const [publishAt, setPublishAt] = useState(localNowPlus(24));
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    try {
      const res = await api.createAnnouncement({
        ...form,
        publishAt: when === 'now' ? undefined : new Date(publishAt).toISOString(),
      });
      toast.success(res.message);
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
      title="New announcement"
      subtitle="Publish now, or write it today and let it appear at the time you choose"
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={busy || !form.title.trim() || !form.body.trim()} icon={when === 'now' ? 'megaphone' : 'clock'}>
            {busy ? 'Saving…' : when === 'now' ? 'Publish now' : 'Schedule'}
          </Button>
        </>
      )}
    >
      <div className="stack">
        <Field label="Title">
          <input className="input" value={form.title} onChange={set('title')} placeholder="Mid-semester examination timetable published" />
        </Field>
        <Field label="Message">
          <textarea className="textarea" value={form.body} onChange={set('body')} placeholder="Write it the way it should appear on the notice board." />
        </Field>

        <div className="grid-2">
          <Field label="Audience">
            <select className="select" value={form.audience} onChange={set('audience')}>
              <option value="all">Students and staff</option>
              <option value="faculty">Faculty and admin only</option>
            </select>
          </Field>
          <Field label="Branch">
            <select className="select" value={form.branch} onChange={set('branch')}>
              <option value="ALL">All branches</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_NAMES[b]}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Semester" hint="Leave as all semesters for an institute-wide notice.">
          <select className="select" value={form.semester} onChange={set('semester')}>
            <option value={0}>All semesters</option>
            {SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
          </select>
        </Field>

        <Field label="When it goes out">
          <div className="row" style={{ gap: 'var(--s2)' }}>
            <button type="button" className={`chip${when === 'now' ? ' active' : ''}`} onClick={() => setWhen('now')}>Publish now</button>
            <button type="button" className={`chip${when === 'later' ? ' active' : ''}`} onClick={() => setWhen('later')}>Schedule</button>
          </div>
        </Field>

        {when === 'later' && (
          <Field label="Publish at" hint="Until then it is visible only to you and to administrators.">
            <input className="input" type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

function NoticeCard({ a, actions }) {
  return (
    <Card tight>
      <div className="row-between wrap" style={{ alignItems: 'flex-start' }}>
        <div className="grow" style={{ minWidth: 220 }}>
          <div className="row wrap" style={{ gap: 'var(--s2)', marginBottom: 4 }}>
            <span className="list-title">{a.title}</span>
            {a.status === 'scheduled' && <Badge tone="warn" dot>Scheduled</Badge>}
            {a.audience === 'faculty' && <Badge>Staff only</Badge>}
            {a.branch !== 'ALL' && <Badge tone="accent">{a.branch}</Badge>}
            {a.semester > 0 && <Badge tone="accent">Sem {a.semester}</Badge>}
          </div>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.65 }}>{a.body}</p>
          <p className="list-meta" style={{ marginTop: 'var(--s2)' }}>
            {a.status === 'scheduled'
              ? <><Icon name="clock" size={12} style={{ verticalAlign: -2 }} /> Publishes {relative(a.publishAt)} — {formatDateTime(a.publishAt)}</>
              : <>{a.author} · {relative(a.publishAt)}</>}
          </p>
        </div>
        {actions}
      </div>
    </Card>
  );
}

export default function Notices() {
  const { isStaff } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('published');
  const [composing, setComposing] = useState(false);
  const { data, error, loading, refetch } = useApi(() => api.announcements(), []);

  const published = data?.announcements ?? [];
  const scheduled = data?.scheduled ?? [];
  const rows = tab === 'published' ? published : scheduled;

  const publishNow = async (a) => {
    try { await api.publishNow(a.id); toast.success('Published — it is visible to its audience now.'); refetch(); }
    catch (err) { toast.error(err.message); }
  };
  const remove = async (a) => {
    if (!window.confirm(`Delete “${a.title}”?`)) return;
    try { await api.deleteAnnouncement(a.id); toast.success('Deleted.'); refetch(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div className="content">
      <PageHead
        title="Notices"
        subtitle={isStaff ? 'Publish immediately or schedule for later' : 'Announcements for your branch and semester'}
        action={isStaff ? <Button variant="primary" icon="plus" onClick={() => setComposing(true)}>New notice</Button> : undefined}
      />

      {isStaff && (
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'published', label: 'Published', count: published.length },
            { value: 'scheduled', label: 'Scheduled', count: scheduled.length },
          ]}
        />
      )}

      {loading && <Card><SkeletonList rows={4} /></Card>}
      {error && <ErrorNote onRetry={refetch}>{error}</ErrorNote>}

      {!loading && !error && (
        rows.length === 0
          ? (
            <Card>
              <EmptyState
                icon={tab === 'scheduled' ? 'clock' : 'megaphone'}
                title={tab === 'scheduled' ? 'Nothing scheduled' : 'No notices right now'}
                body={tab === 'scheduled'
                  ? 'Write an announcement and set a publish time — it stays hidden from students until then.'
                  : isStaff ? 'Publish one and it appears for its audience immediately.' : 'Announcements for your class will appear here.'}
                action={isStaff ? <Button variant="primary" icon="plus" onClick={() => setComposing(true)}>New notice</Button> : undefined}
              />
            </Card>
          )
          : (
            <div className="stack" style={{ gap: 'var(--s2)' }}>
              {rows.map((a) => (
                <NoticeCard
                  key={a.id}
                  a={a}
                  actions={isStaff ? (
                    <div className="row" style={{ gap: 4 }}>
                      {a.status === 'scheduled' && (
                        <Button size="sm" onClick={() => publishNow(a)}>Publish now</Button>
                      )}
                      <Button size="sm" variant="ghost" className="btn-icon" onClick={() => remove(a)} aria-label="Delete"><Icon name="trash" size={15} /></Button>
                    </div>
                  ) : undefined}
                />
              ))}
            </div>
          )
      )}

      {composing && <ComposeModal onClose={() => setComposing(false)} onDone={refetch} />}
    </div>
  );
}

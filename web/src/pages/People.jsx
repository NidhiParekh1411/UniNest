import { useState } from 'react';
import api from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useToast } from '../lib/toast.jsx';
import Icon from '../components/Icon.jsx';
import { Badge, Button, Card, EmptyState, ErrorNote, Field, Modal, PageHead, SkeletonList, Table, Tabs } from '../components/ui.jsx';
import { BRANCHES, BRANCH_NAMES, SEMESTERS, formatDate, initials } from '../lib/format.js';

function CreateModal({ onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', role: 'student', branch: 'CE', semester: 1, department: 'Computer Engineering', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = async () => {
    setBusy(true);
    try {
      await api.createUser(form);
      toast.success(`${form.name} can now sign in.`);
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
      title="Add an account"
      subtitle="Students sign in on the student portal; faculty and admin share the staff portal"
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={create} disabled={busy || !form.name.trim() || !form.email.trim()}>
            {busy ? 'Creating…' : 'Create account'}
          </Button>
        </>
      )}
    >
      <div className="stack">
        <Field label="Role">
          <select className="select" value={form.role} onChange={set('role')}>
            <option value="student">Student</option>
            <option value="faculty">Faculty</option>
            <option value="admin">Administrator</option>
          </select>
        </Field>
        <Field label="Full name">
          <input className="input" value={form.name} onChange={set('name')} placeholder={form.role === 'student' ? 'Aarav Patel' : 'Dr. Anjali Mehta'} />
        </Field>
        <Field label="Email address">
          <input className="input" type="email" value={form.email} onChange={set('email')} placeholder={form.role === 'student' ? 'name@student.college.edu' : 'name@college.edu'} />
        </Field>

        {form.role === 'student' ? (
          <div className="grid-2">
            <Field label="Branch">
              <select className="select" value={form.branch} onChange={set('branch')}>
                {BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_NAMES[b]}</option>)}
              </select>
            </Field>
            <Field label="Semester">
              <select className="select" value={form.semester} onChange={set('semester')}>
                {SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </Field>
          </div>
        ) : (
          <Field label="Department">
            <input className="input" value={form.department} onChange={set('department')} />
          </Field>
        )}

        <Field label="Initial password" hint="Leave blank to use the shared demo password.">
          <input className="input" type="text" value={form.password} onChange={set('password')} placeholder="demo1234" />
        </Field>
      </div>
    </Modal>
  );
}

export default function People() {
  const toast = useToast();
  const [role, setRole] = useState('student');
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const { data, error, loading, refetch } = useApi(
    () => api.users({ role, branch, semester, q }),
    [role, branch, semester, q],
  );

  const remove = async (u) => {
    if (!window.confirm(`Remove ${u.name}'s account?`)) return;
    try { await api.deleteUser(u.id); toast.success('Account removed.'); refetch(); }
    catch (err) { toast.error(err.message); }
  };

  const users = data?.users ?? [];

  return (
    <div className="content">
      <PageHead
        title="People"
        subtitle="Accounts, and the branch and semester that scope what each student can see"
        action={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Add account</Button>}
      />

      <Tabs
        value={role}
        onChange={setRole}
        tabs={[
          { value: 'student', label: 'Students' },
          { value: 'faculty', label: 'Faculty' },
          { value: 'admin', label: 'Administrators' },
        ]}
      />

      <div className="filters" style={{ marginBottom: 'var(--s4)' }}>
        <input className="input" placeholder="Search name, email or enrollment" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
        {role === 'student' && (
          <>
            <select className="select" value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch">
              <option value="">All branches</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_NAMES[b]}</option>)}
            </select>
            <select className="select" value={semester} onChange={(e) => setSemester(e.target.value)} aria-label="Semester">
              <option value="">All semesters</option>
              {SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </>
        )}
      </div>

      {loading && <Card><SkeletonList rows={7} /></Card>}
      {error && <ErrorNote onRetry={refetch}>{error}</ErrorNote>}

      {!loading && !error && (
        <Card flush>
          <Table
            keyOf={(r) => r.id}
            columns={[
              {
                key: 'name',
                header: 'Name',
                render: (u) => (
                  <span className="row" style={{ gap: 'var(--s3)' }}>
                    <span className="avatar">{initials(u.name)}</span>
                    <span>
                      <span className="cell-strong">{u.name}</span><br />
                      <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>{u.email}</span>
                    </span>
                  </span>
                ),
              },
              {
                key: 'detail',
                header: role === 'student' ? 'Class' : 'Department',
                render: (u) => (role === 'student'
                  ? <span>{u.branch} · Sem {u.semester}{u.division ? ` · ${u.division}` : ''}<br /><span className="mono dim">{u.enrollment}</span></span>
                  : <span>{u.department}<br /><span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>{u.designation ?? '—'}</span></span>),
              },
              ...(role === 'faculty' ? [{ key: 'subjectCount', header: 'Subjects', align: 'right', render: (u) => <Badge tone="accent">{u.subjectCount}</Badge> }] : []),
              { key: 'joinedAt', header: 'Since', align: 'right', render: (u) => <span className="dim">{formatDate(u.joinedAt, { month: 'short', year: 'numeric' })}</span> },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (u) => (
                  <Button size="sm" variant="ghost" className="btn-icon" onClick={() => remove(u)} aria-label={`Remove ${u.name}`}>
                    <Icon name="trash" size={15} />
                  </Button>
                ),
              },
            ]}
            rows={users}
            empty={<EmptyState icon="users" title="No accounts match" body="Try a different filter or search term." />}
          />
        </Card>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onDone={refetch} />}
    </div>
  );
}

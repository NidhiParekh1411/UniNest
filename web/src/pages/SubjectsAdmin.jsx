import { useState } from 'react';
import api from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useToast } from '../lib/toast.jsx';
import { Badge, Card, EmptyState, ErrorNote, PageHead, SkeletonList, Table } from '../components/ui.jsx';
import { BRANCHES, BRANCH_NAMES, SEMESTERS } from '../lib/format.js';

// The deck's "subject-faculty assignments tracked per semester, so 'who teaches
// X' has one correct answer". Reassignment happens inline in the table.
export default function SubjectsAdmin() {
  const toast = useToast();
  const [branch, setBranch] = useState('CE');
  const [semester, setSemester] = useState(5);

  const { data, error, loading, refetch } = useApi(() => api.subjects({ branch, semester }), [branch, semester]);
  const { data: facultyData } = useApi(() => api.users({ role: 'faculty' }), []);

  const assign = async (subjectId, facultyId) => {
    if (!facultyId) return;
    try {
      await api.assignSubject(subjectId, facultyId);
      toast.success('Subject reassigned.');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const subjects = data?.subjects ?? [];
  const faculty = facultyData?.users ?? [];

  return (
    <div className="content">
      <PageHead
        title="Subjects & faculty"
        subtitle="One subject, one faculty member, per branch and semester"
      />

      <div className="filters" style={{ marginBottom: 'var(--s5)' }}>
        <select className="select" value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch">
          {BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_NAMES[b]}</option>)}
        </select>
        <select className="select" value={semester} onChange={(e) => setSemester(Number(e.target.value))} aria-label="Semester">
          {SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
        </select>
      </div>

      {loading && <Card><SkeletonList rows={6} /></Card>}
      {error && <ErrorNote onRetry={refetch}>{error}</ErrorNote>}

      {!loading && !error && (
        <Card flush>
          <Table
            keyOf={(r) => r.id}
            columns={[
              { key: 'code', header: 'Code', render: (s) => <span className="mono">{s.code}</span> },
              { key: 'name', header: 'Subject', render: (s) => <span className="cell-strong">{s.name}</span> },
              { key: 'credits', header: 'Credits', align: 'right', render: (s) => <Badge>{s.credits}</Badge> },
              {
                key: 'faculty',
                header: 'Assigned faculty',
                render: (s) => (
                  <select
                    className="select"
                    style={{ minWidth: 190, fontSize: 'var(--fs-sm)' }}
                    value={s.facultyId ?? ''}
                    onChange={(e) => assign(s.id, e.target.value)}
                    aria-label={`Faculty for ${s.name}`}
                  >
                    <option value="">Not assigned</option>
                    {faculty.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                ),
              },
            ]}
            rows={subjects}
            empty={<EmptyState icon="grid" title="No subjects registered" body="This branch and semester has no subjects in the catalogue." />}
          />
        </Card>
      )}
    </div>
  );
}

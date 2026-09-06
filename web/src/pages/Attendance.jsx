import { useState } from 'react';
import api from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { SubjectCard } from '../components/SubjectRail.jsx';
import { Badge, Card, EmptyState, ErrorNote, PageHead, SkeletonList, Table } from '../components/ui.jsx';
import { BarChart, DonutChart, Progress } from '../components/Charts.jsx';
import { attendanceTone, BRANCHES, BRANCH_NAMES, SEMESTERS, formatDate } from '../lib/format.js';

/* The last ten marked sessions, as a row of squares.
 *
 * Two colour systems are at work on this screen and they mean different
 * things. A subject's pastel is its *identity* — the same subject is the same
 * colour here, on the dashboard rail and on its detail card — which is what
 * stops a page of eight subjects reading as one undifferentiated block. The
 * ok/warn/bad colours are its *status* against the 75% line, and they stay
 * reserved for the number and the meter, where a reader is actually asking
 * "am I short?". Mixing the two is what made everything look the same. */
function RecentSessions({ sessions }) {
  if (!sessions?.length) return null;
  return (
    <div className="recent">
      <span className="eyebrow">Last {sessions.length}</span>
      <span className="recent-dots">
        {sessions.map((sess, i) => (
          <span
            key={i}
            className={`recent-dot recent-${sess.status === 'present' ? 'present' : 'absent'}`}
            title={`${formatDate(sess.date)} — ${sess.status}`}
          />
        ))}
      </span>
    </div>
  );
}

function AttendanceCard({ subject, index }) {
  const tone = attendanceTone(subject.percent);
  return (
    <SubjectCard
      index={index}
      title={subject.subject}
      meta={<><span className="mono">{subject.code}</span>{subject.faculty ? ` · ${subject.faculty}` : ''}</>}
      badge={<Badge tone={tone}>{subject.percent}%</Badge>}
    >
      <div className="subject-card-meter">
        <Progress value={subject.percent} tone={tone} />
        <span className="subject-card-count num">{subject.attended} of {subject.total}</span>
      </div>
      <RecentSessions sessions={subject.sessions} />
    </SubjectCard>
  );
}

function StudentView({ data }) {
  const chart = data.subjects.map((s) => ({ label: s.code.slice(-4), fullLabel: s.subject, value: s.percent }));
  const tone = attendanceTone(data.overall.percent);

  return (
    <div className="stack" style={{ gap: 'var(--s4)' }}>
      <div className="grid-2 grid-2-aside">
        <Card title="By subject" subtitle="The dashed line is the 75% eligibility requirement">
          <BarChart data={chart} threshold={75} />
        </Card>

        <Card title="Overall" subtitle="Across every subject this semester">
          <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--s3) 0' }}>
            <DonutChart
              value={data.overall.percent}
              label={`${data.overall.percent}%`}
              sublabel={`${data.overall.attended} of ${data.overall.total}`}
              tone={tone}
            />
          </div>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--s4)', textAlign: 'center' }}>
            {data.overall.belowThreshold === 0
              ? 'Every subject is above the requirement.'
              : `${data.overall.belowThreshold} ${data.overall.belowThreshold === 1 ? 'subject is' : 'subjects are'} below 75%. A shortage of up to 10% may be condoned on documented grounds.`}
          </p>
        </Card>
      </div>

      <div>
        <div className="section-bar">
          <h2 className="section-bar-title">Subject detail</h2>
          <p className="section-bar-sub">Sessions attended, and the last ten marked</p>
        </div>
        <div className="subject-grid">
          {data.subjects.map((s, i) => <AttendanceCard key={s.id} subject={s} index={i} />)}
        </div>
      </div>
    </div>
  );
}

function CohortView({ data }) {
  const short = data.cohort.filter((r) => r.percent < 75);
  return (
    <div className="stack" style={{ gap: 'var(--s4)' }}>
      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Students</div><div className="stat-value">{data.cohort.length}</div></div>
        <div className="stat"><div className="stat-label">Below 75%</div><div className={`stat-value${short.length ? ' tone-bad' : ' tone-ok'}`}>{short.length}</div></div>
        <div className="stat">
          <div className="stat-label">Class average</div>
          <div className="stat-value">{data.cohort.length ? Math.round(data.cohort.reduce((n, r) => n + r.percent, 0) / data.cohort.length) : 0}%</div>
        </div>
        <div className="stat">
          <div className="stat-label">Lowest</div>
          <div className="stat-value tone-warn">{data.cohort.length ? data.cohort[0].percent : 0}%</div>
        </div>
      </div>

      <Card title="Students" subtitle="Sorted lowest first, so shortages surface immediately" flush>
        <Table
          keyOf={(r) => r.studentId}
          columns={[
            { key: 'name', header: 'Student', render: (r) => (<span><span className="cell-strong">{r.name}</span><br /><span className="mono dim">{r.enrollment}</span></span>) },
            { key: 'cohort', header: 'Class', render: (r) => `${r.branch} · Sem ${r.semester}${r.division ? ` · ${r.division}` : ''}` },
            { key: 'sessions', header: 'Sessions', align: 'right', render: (r) => `${r.attended}/${r.total}` },
            {
              key: 'percent',
              header: 'Attendance',
              align: 'right',
              render: (r) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--s3)', minWidth: 130, justifyContent: 'flex-end' }}>
                  <span style={{ width: 64 }}><Progress value={r.percent} tone={attendanceTone(r.percent)} /></span>
                  <span style={{ width: 44, textAlign: 'right', fontWeight: 600 }}>{r.percent}%</span>
                </span>
              ),
            },
          ]}
          rows={data.cohort}
          empty={<EmptyState icon="chart" title="No attendance recorded" body="Nothing has been marked for this selection." />}
        />
      </Card>
    </div>
  );
}

export default function Attendance() {
  const { user, isStudent } = useAuth();
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState('');

  const { data, error, loading, refetch } = useApi(
    () => api.attendance(isStudent ? {} : { branch, semester }),
    [branch, semester],
  );

  return (
    <div className="content">
      <PageHead
        title="Attendance"
        subtitle={isStudent
          ? 'Your record against the 75% requirement for examination eligibility'
          : 'Cohort attendance across the classes you can see'}
      />

      {!isStudent && (
        <div className="filters" style={{ marginBottom: 'var(--s5)' }}>
          <select className="select" value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch">
            <option value="">All branches</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_NAMES[b]}</option>)}
          </select>
          <select className="select" value={semester} onChange={(e) => setSemester(e.target.value)} aria-label="Semester">
            <option value="">All semesters</option>
            {SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
          </select>
        </div>
      )}

      {loading && <Card><SkeletonList rows={6} /></Card>}
      {error && <ErrorNote onRetry={refetch}>{error}</ErrorNote>}
      {!loading && !error && data && (data.scope === 'student' ? <StudentView data={data} /> : <CohortView data={data} />)}
    </div>
  );
}

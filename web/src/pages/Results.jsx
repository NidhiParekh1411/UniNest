import { useState } from 'react';
import api from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { SubjectCard } from '../components/SubjectRail.jsx';
import { Badge, Card, EmptyState, ErrorNote, PageHead, SkeletonList, Table, Tabs } from '../components/ui.jsx';
import { BarChart, DonutChart, LineChart, ThresholdMeter } from '../components/Charts.jsx';
import { BRANCHES, BRANCH_NAMES, SEMESTERS, marksTone } from '../lib/format.js';

function StudentView({ data }) {
  const [tab, setTab] = useState(data.bySemester.at(-1)?.semester ?? 1);
  const current = data.bySemester.find((s) => s.semester === tab) ?? data.bySemester.at(-1);

  const trend = data.bySemester.map((s) => ({ label: `S${s.semester}`, value: s.spi }));
  const subjectChart = (current?.rows ?? []).map((r) => ({ label: r.code.slice(-4), fullLabel: r.subject, value: r.percent }));

  return (
    <div className="stack" style={{ gap: 'var(--s4)' }}>
      <div className="grid-2 grid-2-aside">
        <Card title="Performance across semesters" subtitle="Semester Performance Index on the ten-point scale">
          {trend.length > 1
            ? <LineChart data={trend} maxValue={10} />
            : <EmptyState icon="chart" title="One semester so far" body="A trend appears once a second semester's results are published." />}
        </Card>

        <Card title="Cumulative" subtitle="Across every published result">
          <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--s3) 0' }}>
            <DonutChart
              value={data.overall.cpi} max={10}
              label={data.overall.cpi.toFixed(2)}
              sublabel={`CPI · ${data.overall.subjects} subjects`}
              tone={marksTone(data.overall.percent)}
            />
          </div>
        </Card>
      </div>

      <Card
        title="Semester detail"
        subtitle={current
          ? `${current.examType === 'midsem' ? 'Mid-semester' : 'End-semester'} results · SPI ${current.spi.toFixed(2)} · the dashed line is the 40% pass mark`
          : undefined}
      >
        <Tabs
          tabs={data.bySemester.map((s) => ({ value: s.semester, label: `Sem ${s.semester}` }))}
          value={tab}
          onChange={setTab}
        />
        {current && <BarChart data={subjectChart} threshold={40} />}
      </Card>

      {current && (
        <div>
          <div className="section-bar">
            <h2 className="section-bar-title">Subject marks</h2>
            <p className="section-bar-sub">Each subject against the 40% pass line</p>
          </div>
          {/* Cards rather than a table: the subject's pastel is the same one it
              carries on the dashboard and on attendance, which is what ties the
              three screens together. The precise numbers are still all here. */}
          <div className="subject-grid">
            {current.rows.map((r, i) => (
              <SubjectCard
                key={r.id}
                index={i}
                title={r.subject}
                code={r.code}
                badge={<Badge tone={marksTone(r.percent)}>{r.percent}%</Badge>}
              >
                <div className="subject-card-meter">
                  <ThresholdMeter value={r.percent} tone={marksTone(r.percent)} threshold={40} thresholdLabel="40% to pass" />
                  <span className="subject-card-count num">{r.marks} / {r.maxMarks}</span>
                </div>
              </SubjectCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CohortView({ data }) {
  const failing = data.cohort.filter((r) => r.percent < 40);
  const average = data.cohort.length ? Math.round(data.cohort.reduce((n, r) => n + r.percent, 0) / data.cohort.length) : 0;

  return (
    <div className="stack" style={{ gap: 'var(--s4)' }}>
      <div className="stat-grid">
        <div className="stat"><div className="stat-label">Students</div><div className="stat-value">{data.cohort.length}</div></div>
        <div className="stat"><div className="stat-label">Class average</div><div className="stat-value">{average}%</div></div>
        <div className="stat"><div className="stat-label">Below 40%</div><div className={`stat-value${failing.length ? ' tone-bad' : ' tone-ok'}`}>{failing.length}</div></div>
        <div className="stat"><div className="stat-label">Highest</div><div className="stat-value tone-ok">{data.cohort[0]?.percent ?? 0}%</div></div>
      </div>

      <Card title="Ranked" subtitle="Highest first" flush>
        <Table
          keyOf={(r) => r.studentId}
          columns={[
            { key: 'rank', header: '#', render: (_r, i) => <span className="mono dim">{i + 1}</span> },
            { key: 'name', header: 'Student', render: (r) => (<span><span className="cell-strong">{r.name}</span><br /><span className="mono dim">{r.enrollment}</span></span>) },
            { key: 'cohort', header: 'Class', render: (r) => `${r.branch} · Sem ${r.semester}` },
            { key: 'marks', header: 'Marks', align: 'right', render: (r) => `${r.marks}/${r.maxMarks}` },
            { key: 'percent', header: 'Result', align: 'right', render: (r) => <Badge tone={marksTone(r.percent)}>{r.percent}%</Badge> },
          ]}
          rows={data.cohort}
          empty={<EmptyState icon="bolt" title="No results published" body="Nothing has been published for this selection." />}
        />
      </Card>
    </div>
  );
}

export default function Results() {
  const { isStudent } = useAuth();
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState('');
  const [examType, setExamType] = useState('');

  const { data, error, loading, refetch } = useApi(
    () => api.results(isStudent ? {} : { branch, semester, examType }),
    [branch, semester, examType],
  );

  return (
    <div className="content">
      <PageHead
        title="Results"
        subtitle={isStudent
          ? 'Mid-semester and end-semester marks, with your performance index'
          : 'Cohort results, filtered before any number is shown'}
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
          <select className="select" value={examType} onChange={(e) => setExamType(e.target.value)} aria-label="Exam type">
            <option value="">Both exams</option>
            <option value="midsem">Mid-semester</option>
            <option value="final">End-semester</option>
          </select>
        </div>
      )}

      {loading && <Card><SkeletonList rows={6} /></Card>}
      {error && <ErrorNote onRetry={refetch}>{error}</ErrorNote>}
      {!loading && !error && data && (data.scope === 'student' ? <StudentView data={data} /> : <CohortView data={data} />)}
    </div>
  );
}

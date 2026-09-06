import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import Icon from '../components/Icon.jsx';
import SubjectRail, { CourseMeter } from '../components/SubjectRail.jsx';
import { WeekStrip, weekdayIndex } from '../components/Calendar.jsx';
import { Badge, Button, Card, EmptyState, ErrorNote, PageHead, Skeleton, SkeletonList, Stat } from '../components/ui.jsx';
import { BarChart, Progress } from '../components/Charts.jsx';
import { DAYS, attendanceTone, formatDate, relative } from '../lib/format.js';

function StatRow({ stats }) {
  return (
    <div className="stat-grid">
      {stats.map((s) => <Stat key={s.label} {...s} />)}
    </div>
  );
}

function SessionList({ classes }) {
  return (
    <div className="slots">
      {classes.map((c, i) => (
        <div className={`slot${c.type === 'lab' ? ' slot-lab' : ''}`} key={i}>
          <span className="slot-time">
            <span className="slot-time-start">{c.startTime}</span>
            <span className="slot-time-end">{c.endTime}</span>
          </span>
          <span className="slot-body">
            <span className="slot-title">{c.subject}</span>
            <span className="slot-meta">{c.room}{c.faculty ? ` · ${c.faculty}` : ''}</span>
          </span>
          {c.type === 'lab' && <Badge tone="lavender">Lab</Badge>}
        </div>
      ))}
    </div>
  );
}

function TodaySchedule({ today, emptyBody }) {
  if (!today?.day) {
    return <EmptyState icon="calendar" title="No classes today" body="It’s a holiday or a non-instructional day." />;
  }
  if (!today.classes.length) {
    return <EmptyState icon="calendar" title={`Nothing scheduled for ${today.day}`} body={emptyBody} />;
  }
  return <SessionList classes={today.classes} />;
}

/* The reference's "Next Lessons" panel: pick a day on the strip, see that
   day's sessions under it. The timetable repeats weekly, so a date maps to a
   schedule through its weekday — DAYS runs Monday to Saturday, so Sunday
   (index 6) correctly finds nothing. */
function NextLessons() {
  const [date, setDate] = useState(() => new Date());
  const { data, loading } = useApi(() => api.timetable(), []);
  const rows = data?.rows ?? [];

  const dayName = DAYS[weekdayIndex(date)] ?? null;
  const classes = dayName
    ? rows.filter((r) => r.day === dayName).sort((a, b) => a.startTime.localeCompare(b.startTime))
    : [];
  const countFor = (d) => {
    const name = DAYS[weekdayIndex(d)];
    return name ? rows.filter((r) => r.day === name).length : 0;
  };

  const isToday = date.toDateString() === new Date().toDateString();

  return (
    <Card
      title="Next lessons"
      subtitle={isToday ? 'Today' : date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
      action={<Link to="/app/timetable"><Button size="sm" variant="ghost">Full timetable</Button></Link>}
    >
      <WeekStrip value={date} onChange={setDate} countFor={countFor} />
      <div style={{ marginTop: 'var(--s4)' }}>
        {loading
          ? <SkeletonList rows={3} />
          : classes.length
            ? <SessionList classes={classes} />
            : <EmptyState icon="calendar" title={dayName ? `Nothing on ${dayName}` : 'No classes on Sunday'} body="Pick another day on the strip above." />}
      </div>
    </Card>
  );
}

/* ----------------------------------------------------------------- student */

function StudentHome({ data, user }) {
  const { data: attendance } = useApi(() => api.attendance(), []);
  const subjects = attendance?.subjects ?? [];

  return (
    <>
      <PageHead
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${user.name.split(' ')[0]}`}
        subtitle={`${user.branch} · Semester ${user.semester} · Division ${user.division ?? 'A'}`}
        action={<Link to="/app/assistant"><Button variant="primary" icon="sparkle">Ask the assistant</Button></Link>}
      />

      <div className="stack" style={{ gap: 'var(--s4)' }}>
        <StatRow stats={data.stats} />

        <Card
          title="My subjects"
          subtitle="This semester, with where your attendance stands"
          action={<Link to="/app/attendance"><Button size="sm" variant="ghost">Attendance</Button></Link>}
        >
          <SubjectRail
            subjects={subjects}
            meta={(sub) => `${sub.attended}/${sub.total} classes · ${sub.faculty ?? '—'}`}
            footer={(sub) => <CourseMeter value={sub.percent} />}
            emptyLabel="No subjects are mapped to your semester yet."
          />
        </Card>

        <div className="grid-2 grid-2-aside">
          <NextLessons />

          <Card title="Pending work" subtitle={data.pending.length ? `${data.pending.length} to submit` : 'Nothing outstanding'}>
            {data.pending.length === 0
              ? <EmptyState icon="check" title="All caught up" body="Every assignment posted for your semester has been submitted." />
              : data.pending.map((a) => (
                <div className="list-row" key={a.id}>
                  <span className="grow">
                    <span className="list-title">{a.title}</span>
                    <span className="list-meta">{a.subject} · due {formatDate(a.dueDate)}</span>
                  </span>
                  {a.overdue ? <Badge tone="bad">Overdue</Badge> : <Badge tone="warn">{relative(a.dueDate)}</Badge>}
                </div>
              ))}
          </Card>
        </div>

        {data.shortAttendance.length > 0 && (
          <Card
            title="Attendance needs attention"
            subtitle="Below the 75% required to sit the end-semester examination"
            action={<Link to="/app/attendance"><Button size="sm" variant="ghost">View all</Button></Link>}
          >
            {data.shortAttendance.map((s) => (
              <div key={s.subject} style={{ marginBottom: 'var(--s3)' }}>
                <div className="row-between" style={{ marginBottom: 5 }}>
                  <span style={{ fontSize: 'var(--fs-sm)' }}>{s.subject}</span>
                  <span className="num" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--bad)' }}>{s.percent}%</span>
                </div>
                <Progress value={s.percent} tone={attendanceTone(s.percent)} />
              </div>
            ))}
          </Card>
        )}

        <Card
          title="Notices"
          subtitle="Published for your branch and semester"
          action={<Link to="/app/notices"><Button size="sm" variant="ghost">All notices</Button></Link>}
        >
          {data.announcements.length === 0
            ? <EmptyState icon="megaphone" title="No notices right now" body="Announcements for your class will appear here." />
            : data.announcements.map((a) => (
              <div className="list-row" key={a.id}>
                <span className="grow">
                  <span className="list-title">{a.title}</span>
                  <span className="list-meta">{relative(a.publishAt)}</span>
                </span>
                <Icon name="chevron" size={14} className="dim" />
              </div>
            ))}
        </Card>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- faculty */

function FacultyHome({ data, user }) {
  const chart = data.subjects.slice(0, 8).map((s) => ({
    label: s.code.slice(-4),
    fullLabel: s.name,
    value: s.attendance,
  }));

  return (
    <>
      <PageHead
        title={`Welcome, ${user.name.replace(/^(Dr|Prof)\.\s*/, '').split(' ')[0]}`}
        subtitle={`${user.department} · ${data.subjects.length} subjects across ${new Set(data.subjects.map((s) => s.semester)).size} semesters`}
      />

      <div className="stack" style={{ gap: 'var(--s4)' }}>
        <StatRow stats={data.stats} />

        <div className="grid-2 grid-2-aside">
          <Card title="Attendance by subject" subtitle="Average across each class you teach">
            {chart.length
              ? <BarChart data={chart} threshold={75} />
              : <EmptyState icon="chart" title="No attendance recorded" body="Once sessions are marked, the picture appears here." />}
          </Card>

          <Card title={`Today — ${data.today?.day ?? '—'}`} subtitle="Your sessions">
            <TodaySchedule today={data.today} emptyBody="No sessions of yours are scheduled today." />
          </Card>
        </div>

        <div className="grid-2">
          <Card
            title="Waiting to be graded"
            subtitle={data.ungraded.length ? `${data.ungraded.length} shown` : 'Nothing pending'}
            action={<Link to="/app/assignments"><Button size="sm" variant="ghost">Open</Button></Link>}
          >
            {data.ungraded.length === 0
              ? <EmptyState icon="check" title="Everything is graded" body="No submissions are waiting on you." />
              : data.ungraded.map((s) => (
                <div className="list-row" key={s.id}>
                  <span className="grow">
                    <span className="list-title">{s.student}</span>
                    <span className="list-meta">{s.assignment} · {relative(s.submittedAt)}</span>
                  </span>
                  {s.late && <Badge tone="warn">Late</Badge>}
                </div>
              ))}
          </Card>

          <Card title="Your subjects" subtitle="Across every semester you teach">
            {data.subjects.map((s) => (
              <div className="list-row" key={s.id}>
                <span className="grow">
                  <span className="list-title">{s.name}</span>
                  <span className="list-meta"><span className="mono">{s.code}</span> · {s.branch} sem {s.semester} · {s.students} students</span>
                </span>
                <Badge tone={attendanceTone(s.attendance)}>{s.attendance}%</Badge>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- admin */

function AdminHome({ data }) {
  return (
    <>
      <PageHead title="Institute overview" subtitle="Records, knowledge base and scheduled communications" />

      <div className="stack" style={{ gap: 'var(--s4)' }}>
        <StatRow stats={data.stats} />

        <div className="grid-2 grid-2-aside">
          <Card title="Attendance by branch" subtitle="Average across all recorded sessions">
            <BarChart
              data={data.byBranch.map((b) => ({ label: b.branch, fullLabel: b.branch, value: b.attendance }))}
              threshold={75}
            />
            <div className="chart-legend">
              {data.byBranch.map((b) => (
                <span className="chart-legend-item" key={b.branch}>
                  <span className="legend-swatch" style={{ background: 'var(--accent-strong)' }} />
                  {b.branch} — {b.students} students
                </span>
              ))}
            </div>
          </Card>

          <Card title="Students by semester" subtitle="Current enrolment">
            {data.bySemester.map((s) => {
              const max = Math.max(...data.bySemester.map((x) => x.students));
              return (
                <div key={s.semester} style={{ marginBottom: 'var(--s3)' }}>
                  <div className="row-between" style={{ marginBottom: 5 }}>
                    <span style={{ fontSize: 'var(--fs-sm)' }}>Semester {s.semester}</span>
                    <span className="num" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{s.students}</span>
                  </div>
                  <Progress value={s.students} max={max} />
                </div>
              );
            })}
          </Card>
        </div>

        <div className="grid-2">
          <Card
            title="Scheduled to publish"
            subtitle={data.scheduled.length ? `${data.scheduled.length} queued` : 'Nothing queued'}
            action={<Link to="/app/notices"><Button size="sm" variant="ghost">Manage</Button></Link>}
          >
            {data.scheduled.length === 0
              ? <EmptyState icon="clock" title="Nothing scheduled" body="Announcements set to publish later will queue here." />
              : data.scheduled.map((a) => (
                <div className="list-row" key={a.id}>
                  <Icon name="clock" size={16} className="dim" />
                  <span className="grow">
                    <span className="list-title">{a.title}</span>
                    <span className="list-meta">Publishes {relative(a.publishAt)}</span>
                  </span>
                </div>
              ))}
          </Card>

          <Card
            title="Recent uploads"
            subtitle="Newest material in the knowledge base"
            action={<Link to="/app/library"><Button size="sm" variant="ghost">Library</Button></Link>}
          >
            {data.recentUploads.map((d) => (
              <div className="list-row" key={d.id}>
                <Icon name="doc" size={16} className="dim" />
                <span className="grow">
                  <span className="list-title">{d.title}</span>
                  <span className="list-meta">{d.uploader} · {relative(d.uploadedAt)} · {d.chunkCount} passages</span>
                </span>
                {d.superseded && <Badge tone="warn">Superseded</Badge>}
              </div>
            ))}
          </Card>
        </div>

        <Card title="Answer engine" subtitle="How questions are being answered right now">
          <div className="row wrap" style={{ gap: 'var(--s5)' }}>
            <div>
              <p className="eyebrow">Provider</p>
              <p style={{ fontWeight: 700 }}>{data.engine.label}</p>
            </div>
            <div>
              <p className="eyebrow">Indexed passages</p>
              <p className="num" style={{ fontWeight: 600 }}>{data.engine.index.chunks}</p>
            </div>
            <div>
              <p className="eyebrow">Vocabulary</p>
              <p className="num" style={{ fontWeight: 600 }}>{data.engine.index.terms} terms</p>
            </div>
            <div>
              <p className="eyebrow">Unassigned subjects</p>
              <p className="num" style={{ fontWeight: 600, color: data.unassignedSubjects ? 'var(--warn)' : undefined }}>{data.unassignedSubjects}</p>
            </div>
          </div>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--s4)' }}>{data.engine.description}</p>
        </Card>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------- page */

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, refetch } = useApi(() => api.overview(), []);

  if (loading) {
    return (
      <div className="content">
        <Skeleton height={26} width={220} />
        <div style={{ height: 'var(--s5)' }} />
        <div className="stat-grid">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={100} style={{ borderRadius: 'var(--r-lg)' }} />)}</div>
        <div style={{ height: 'var(--s4)' }} />
        <div className="card"><SkeletonList rows={4} /></div>
      </div>
    );
  }

  if (error) return <div className="content"><ErrorNote onRetry={refetch}>{error}</ErrorNote></div>;

  return (
    <div className="content">
      {data.role === 'student' && <StudentHome data={data} user={user} />}
      {data.role === 'faculty' && <FacultyHome data={data} user={user} />}
      {data.role === 'admin' && <AdminHome data={data} />}
    </div>
  );
}

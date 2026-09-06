import { useMemo, useState } from 'react';
import api from '../lib/api.js';
import { useApi } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import Calendar, { sameDay, weekdayIndex } from '../components/Calendar.jsx';
import { Badge, Card, EmptyState, ErrorNote, PageHead, SkeletonList, Tabs } from '../components/ui.jsx';
import { BRANCHES, BRANCH_NAMES, DAYS, SEMESTERS } from '../lib/format.js';

// DAYS runs Monday–Saturday. weekdayIndex() is Monday-first, so index 6 is
// Sunday and correctly maps to no teaching day at all.
const dayNameOf = (date) => DAYS[weekdayIndex(date)] ?? null;

function SlotRow({ slot, showCohort }) {
  return (
    <div className={`slot${slot.type === 'lab' ? ' slot-lab' : ''}`}>
      <span className="slot-time">
        <span className="slot-time-start">{slot.startTime}</span>
        <span className="slot-time-end">{slot.endTime}</span>
      </span>
      <span className="slot-body">
        <span className="slot-title">{slot.subject}</span>
        <span className="slot-meta">
          <span className="mono">{slot.code}</span> · {slot.room}
          {slot.faculty ? ` · ${slot.faculty}` : ''}
          {showCohort ? ` · ${slot.branch} sem ${slot.semester}` : ''}
        </span>
      </span>
      {slot.type === 'lab' && <Badge tone="lavender">Lab</Badge>}
    </div>
  );
}

export default function Timetable() {
  const { user, isStudent, isFaculty } = useAuth();
  const [branch, setBranch] = useState(user.branch ?? 'CE');
  const [semester, setSemester] = useState(user.semester ?? 5);
  const [mine, setMine] = useState(isFaculty);
  const [view, setView] = useState('day');
  const [date, setDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  const { data, error, loading, refetch } = useApi(
    () => api.timetable(mine && isFaculty ? { mine: 'true' } : { branch, semester }),
    [branch, semester, mine],
  );

  const rows = useMemo(() => data?.rows ?? [], [data]);

  // How many sessions fall on a given date — drives the calendar's dots and the
  // selected day's list. The timetable repeats weekly, so the date only ever
  // matters through its weekday.
  const perWeekday = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => { map.set(r.day, (map.get(r.day) ?? 0) + 1); });
    return map;
  }, [rows]);

  const countFor = (d) => perWeekday.get(dayNameOf(d)) ?? 0;

  const selectedDayName = dayNameOf(date);
  const selectedSlots = rows
    .filter((r) => r.day === selectedDayName)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const byDay = DAYS
    .map((day) => ({ day, slots: rows.filter((r) => r.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime)) }))
    .filter((d) => d.slots.length);

  const isToday = sameDay(date, new Date());

  return (
    <div className="content">
      <PageHead
        title={isStudent ? 'Timetable' : mine ? 'My schedule' : 'Timetables'}
        subtitle={isStudent
          ? `${BRANCH_NAMES[user.branch]} · Semester ${user.semester}`
          : mine ? 'Every session across the semesters you teach' : 'Select a cohort to view its week'}
        action={<Tabs value={view} onChange={setView} tabs={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} />}
      />

      {!isStudent && (
        <div className="filters">
          {isFaculty && (
            <Tabs
              value={mine ? 'mine' : 'cohort'}
              onChange={(v) => setMine(v === 'mine')}
              tabs={[{ value: 'mine', label: 'My schedule' }, { value: 'cohort', label: 'By cohort' }]}
            />
          )}
          {!mine && (
            <>
              <select className="select" value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch">
                {BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_NAMES[b]}</option>)}
              </select>
              <select className="select" value={semester} onChange={(e) => setSemester(Number(e.target.value))} aria-label="Semester">
                {SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
              </select>
            </>
          )}
        </div>
      )}

      {loading && <Card><SkeletonList rows={5} /></Card>}
      {error && <ErrorNote onRetry={refetch}>{error}</ErrorNote>}

      {!loading && !error && view === 'day' && (
        <div className="split">
          <div className="split-aside">
            <Card tight><Calendar value={date} onChange={setDate} countFor={countFor} /></Card>
          </div>

          <Card
            className="split-main"
            title={date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            subtitle={isToday ? 'Today' : selectedSlots.length
              ? `${selectedSlots.length} ${selectedSlots.length === 1 ? 'session' : 'sessions'}`
              : 'Nothing scheduled'}
            action={isToday ? <Badge tone="lime">Today</Badge> : undefined}
          >
            {selectedSlots.length === 0
              ? (
                <EmptyState
                  icon="calendar"
                  title={selectedDayName ? `No sessions on ${selectedDayName}` : 'Sunday — no classes'}
                  body={selectedDayName
                    ? 'Nothing is scheduled for this selection on that day.'
                    : 'Pick a weekday to see the schedule for it.'}
                />
              )
              : <div className="slots">{selectedSlots.map((s, i) => <SlotRow key={i} slot={s} showCohort={mine} />)}</div>}
          </Card>
        </div>
      )}

      {!loading && !error && view === 'week' && (
        byDay.length === 0
          ? <Card><EmptyState icon="calendar" title="No timetable published" body="Nothing has been scheduled for this selection yet." /></Card>
          : (
            <div className="week-grid">
              {byDay.map(({ day, slots }) => (
                <Card key={day} flush className={day === dayNameOf(new Date()) ? 'day-card today' : 'day-card'}>
                  <div className="day-card-head">
                    <span className="day-card-name">{day}</span>
                    <span className="day-card-count">{slots.length}</span>
                  </div>
                  <div className="slots slots-flush">
                    {slots.map((s, i) => <SlotRow key={i} slot={s} showCohort={mine} />)}
                  </div>
                </Card>
              ))}
            </div>
          )
      )}
    </div>
  );
}

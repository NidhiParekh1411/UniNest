import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';

// A month calendar you can actually navigate: previous/next month, jump back to
// today, and pick any date to see that day's schedule.
//
// Weeks start on Monday because the academic week does — DAYS in lib/format.js
// runs Monday to Saturday, and a Sunday-first grid would put the empty column
// in the middle of the teaching week.

const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const sameDay = (a, b) => a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Monday-first index: Monday 0 … Sunday 6. */
export const weekdayIndex = (date) => (date.getDay() + 6) % 7;

/** The six-week grid covering `month`, padded with the neighbouring months. */
function monthGrid(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - weekdayIndex(first));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

/**
 * @param value      the selected Date
 * @param onChange   called with the newly selected Date
 * @param countFor   (date) => number of sessions that day; drives the dot
 */
export default function Calendar({ value, onChange, countFor }) {
  const [cursor, setCursor] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const today = useMemo(() => startOfDay(new Date()), []);

  // Selecting a date in a neighbouring month should bring the grid with it.
  useEffect(() => {
    setCursor((c) => (c.getFullYear() === value.getFullYear() && c.getMonth() === value.getMonth()
      ? c
      : new Date(value.getFullYear(), value.getMonth(), 1)));
  }, [value]);

  const days = useMemo(() => monthGrid(cursor), [cursor]);
  const shift = (n) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));

  return (
    <div className="cal">
      <div className="cal-head">
        <div className="cal-month">
          <span className="cal-month-name">{cursor.toLocaleDateString('en-IN', { month: 'long' })}</span>
          <span className="cal-month-year">{cursor.getFullYear()}</span>
        </div>
        <div className="cal-nav">
          <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
            <Icon name="chevronLeft" size={16} />
          </button>
          <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </div>

      <div className="cal-weekdays" aria-hidden="true">
        {WEEKDAY_INITIALS.map((w, i) => <span key={WEEKDAY_LABELS[i]}>{w}</span>)}
      </div>

      <div className="cal-grid" role="grid">
        {days.map((d) => {
          const outside = d.getMonth() !== cursor.getMonth();
          const count = countFor?.(d) ?? 0;
          const classes = [
            'cal-day',
            outside && 'outside',
            sameDay(d, today) && 'today',
            sameDay(d, value) && 'selected',
          ].filter(Boolean).join(' ');
          return (
            <button
              key={d.toISOString()}
              type="button"
              className={classes}
              aria-current={sameDay(d, value) ? 'date' : undefined}
              aria-label={`${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}${count ? `, ${count} sessions` : ', no sessions'}`}
              onClick={() => onChange(startOfDay(d))}
            >
              <span className="cal-day-num">{d.getDate()}</span>
              {count > 0 && <span className="cal-day-dot" />}
            </button>
          );
        })}
      </div>

      <div className="cal-foot">
        <button type="button" className="btn btn-sm" onClick={() => onChange(new Date(today))}>
          <Icon name="target" size={14} />Today
        </button>
        <span className="cal-legend"><span className="cal-day-dot" />has sessions</span>
      </div>
    </div>
  );
}

/**
 * The compact seven-day strip from the reference's "Next Lessons" panel.
 * Used where a full month grid would be more chrome than the content deserves.
 */
export function WeekStrip({ value, onChange, countFor }) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const start = useMemo(() => {
    const s = new Date(value);
    s.setDate(value.getDate() - weekdayIndex(value));
    return startOfDay(s);
  }, [value]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const shiftWeek = (n) => {
    const d = new Date(value);
    d.setDate(value.getDate() + n * 7);
    onChange(startOfDay(d));
  };

  return (
    <div className="week-strip">
      <button type="button" className="icon-btn" onClick={() => shiftWeek(-1)} aria-label="Previous week">
        <Icon name="chevronLeft" size={16} />
      </button>
      <div className="week-strip-days">
        {days.map((d, i) => (
          <button
            key={d.toISOString()}
            type="button"
            className={`week-day${sameDay(d, value) ? ' selected' : ''}${sameDay(d, today) ? ' today' : ''}`}
            onClick={() => onChange(startOfDay(d))}
            aria-current={sameDay(d, value) ? 'date' : undefined}
          >
            <span className="week-day-name">{WEEKDAY_INITIALS[i]}</span>
            <span className="week-day-num">{d.getDate()}</span>
            {(countFor?.(d) ?? 0) > 0 && <span className="cal-day-dot" />}
          </button>
        ))}
      </div>
      <button type="button" className="icon-btn" onClick={() => shiftWeek(1)} aria-label="Next week">
        <Icon name="chevronRight" size={16} />
      </button>
    </div>
  );
}

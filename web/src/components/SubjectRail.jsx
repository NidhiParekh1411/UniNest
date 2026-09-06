import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

/* The subject cards from college_ref(2)'s "My Courses" row.
 *
 * A horizontal rail rather than a grid, for one reason: a student's subject
 * list is five to seven items, and five to seven full-width rows push
 * everything else below the fold. A rail keeps them one glance wide and lets
 * the rest of the dashboard start above it.
 *
 * The pastel is not decoration — it cycles through the four families in a
 * stable order so the same subject keeps the same colour everywhere it
 * appears, which is what makes the row scannable rather than merely colourful.
 *
 * It is a rail down the edge of a white card rather than a fill, though. Five
 * pastel-filled cards on a warm-grey page turn every screen into the same
 * screen; the colour has to be enough to tell two subjects apart and no more.
 */

const TONES = ['peach', 'lavender', 'lime', 'sky'];

/** Stable per-subject tone: the same subject is the same colour on every
 *  screen, because the index comes from the subject's position in the list the
 *  server returns, which is itself stable. */
export const toneFor = (index) => TONES[index % TONES.length];

export default function SubjectRail({ subjects, meta, footer, onSelect, emptyLabel = 'No subjects yet' }) {
  const scroller = useRef(null);
  const [reach, setReach] = useState({ prev: false, next: false });

  /* Which ends still have cards behind them.
   *
   * Measured off the element rather than tracked as a page index, because the
   * rail is also moved by touch, by a trackpad and by scroll-snap settling,
   * and none of those go through the buttons. The pixel of slack matters:
   * fractional layout widths mean scrollLeft almost never lands exactly on 0
   * or on the maximum, and an arrow that is lit but cannot move is worse than
   * no arrow at all. */
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setReach({ prev: el.scrollLeft > 1, next: el.scrollLeft < max - 1 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, subjects]);

  /* One card per press. The step is read from the gap between the first two
   * cards rather than written as a number, so it cannot drift out of sync with
   * the rail's own `gap` token. */
  const page = (direction) => {
    const el = scroller.current;
    if (!el) return;
    const cards = el.querySelectorAll('.course');
    const step = cards.length > 1
      ? cards[1].offsetLeft - cards[0].offsetLeft
      : (cards[0]?.offsetWidth ?? el.clientWidth * 0.8);
    el.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  if (!subjects?.length) {
    return <p className="dim" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>{emptyLabel}</p>;
  }

  return (
    <div className="rail-wrap">
      <div className="rail" ref={scroller} onScroll={measure}>
        <div className="rail-track">
          {subjects.map((s, i) => {
            const Tag = onSelect ? 'button' : 'div';
            return (
              <Tag
                key={s.id ?? s.subjectId ?? s.subject}
                type={onSelect ? 'button' : undefined}
                className={`course tone-${toneFor(i)}`}
                onClick={onSelect ? () => onSelect(s) : undefined}
              >
                <span className="course-chip">
                  <Icon name="book" size={13} />
                  {s.code ?? `Sem ${s.semester}`}
                </span>
                <span className="course-title">{s.subject ?? s.name}</span>
                <span className="course-meta">{meta ? meta(s) : (s.faculty ?? '')}</span>
                {footer?.(s)}
              </Tag>
            );
          })}
        </div>
      </div>

      {/* Each arrow exists only while that side has something left to reach,
          so at rest a single chevron sits over the card that is genuinely cut
          off and nothing covers a card that is fully in view. */}
      {reach.prev && (
        <button type="button" className="rail-nav rail-nav-prev" onClick={() => page(-1)} aria-label="Previous subjects">
          <Icon name="chevronLeft" size={17} />
        </button>
      )}
      {reach.next && (
        <button type="button" className="rail-nav rail-nav-next" onClick={() => page(1)} aria-label="More subjects">
          <Icon name="chevronRight" size={17} />
        </button>
      )}
    </div>
  );
}

/** The bar that sits at the foot of a course card. Kept separate so a caller
 *  decides what the number means — attendance on one screen, marks on another. */
export function CourseMeter({ value, label }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span className="course-meter">
      <span className="course-meter-track">
        <span className="course-meter-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="course-meter-value">{label ?? `${pct}%`}</span>
    </span>
  );
}

/* The same subject, standing still.
 *
 * Two screens show a per-subject block — attendance and results — and both
 * want the subject's pastel for identity with its status colour reserved for
 * the badge. Only the body differs, so the body is a child.
 *
 * `code` is separate from `meta` because it is the one thing on the card that
 * carries the subject's tint, and a caller passing it inside a formatted meta
 * string could not be given that treatment.
 */
export function SubjectCard({ index, title, code, meta, badge, children }) {
  return (
    <article className={`subject-card tone-${toneFor(index)}`}>
      <header className="subject-card-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <h3 className="subject-card-title">{title}</h3>
          {(code || meta) && (
            <p className="subject-card-meta">
              {code && <span className="subject-code">{code}</span>}
              {meta && <span>{meta}</span>}
            </p>
          )}
        </div>
        {badge}
      </header>
      {children}
    </article>
  );
}

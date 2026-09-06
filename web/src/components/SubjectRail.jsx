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
 */

const TONES = ['peach', 'lavender', 'lime', 'sky'];

/** Stable per-subject tone: the same subject is the same colour on every
 *  screen, because the index comes from the subject's position in the list the
 *  server returns, which is itself stable. */
export const toneFor = (index) => TONES[index % TONES.length];

export default function SubjectRail({ subjects, meta, footer, onSelect, emptyLabel = 'No subjects yet' }) {
  if (!subjects?.length) {
    return <p className="dim" style={{ fontSize: 'var(--fs-sm)', margin: 0 }}>{emptyLabel}</p>;
  }

  return (
    <div className="rail">
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
 */
export function SubjectCard({ index, title, meta, badge, children }) {
  return (
    <article className={`subject-card tone-${toneFor(index)}`}>
      <header className="subject-card-head">
        <div className="grow" style={{ minWidth: 0 }}>
          <h3 className="subject-card-title">{title}</h3>
          {meta && <p className="subject-card-meta">{meta}</p>}
        </div>
        {badge}
      </header>
      {children}
    </article>
  );
}

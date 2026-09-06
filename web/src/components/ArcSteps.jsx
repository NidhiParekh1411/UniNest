import { useState } from 'react';

/* The six steps of "the path a question takes", laid out along an arc.
 *
 * The arc is the layout, not an object that moves: each card is nudged down by
 * a parabola of its own index, so the row rises in the middle and falls at the
 * ends. That reads as a route across the section without anything looping —
 * the ribbon this replaces scrolled itself forever, which turned a diagram of
 * a process into wallpaper, and its edge mask was inverted so the middle of it
 * was blank.
 *
 * Only the number and the title are shown at rest. The body arrives on hover,
 * on keyboard focus and on tap — three ways in, because a marketing section
 * that only answers to a mouse is a marketing section half the readers cannot
 * read. It is absolutely positioned under the card so revealing it cannot push
 * its neighbours around.
 *
 * Below 900px the arc is meaningless — six cards in a column have no curve to
 * sit on — so the offsets and the reveal are both dropped in CSS and every
 * card simply shows its text.
 */

const TONES = ['lime', 'sky', 'lavender', 'peach'];

// How far the ends of the arc hang below its middle, in pixels.
const ARC_DEPTH = 58;

export default function ArcSteps({ steps }) {
  const [open, setOpen] = useState(null);
  const last = steps.length - 1;

  return (
    <div className="arc">
      <ol className="arc-track">
        {steps.map((s, i) => {
          // -1 at the left end, 0 in the middle, +1 at the right end. Squaring
          // it gives the parabola; the ends sit lowest and the centre highest.
          const t = last > 0 ? (i / last) * 2 - 1 : 0;
          return (
            <li
              className={`arc-cell${open === i ? ' is-open' : ''}`}
              key={s.step}
              style={{ '--arc-y': `${(t * t * ARC_DEPTH).toFixed(1)}px` }}
            >
              <button
                type="button"
                className={`arc-card tone-${TONES[i % TONES.length]}`}
                aria-expanded={open === i}
                onClick={() => setOpen((v) => (v === i ? null : i))}
              >
                <span className="step-index">{s.step}</span>
                <span className="arc-title">{s.title}</span>
                <span className="arc-body">{s.body}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

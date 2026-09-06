import { Mascot } from './Logo.jsx';

/* Three photographs fanned out like prints dropped on a table.
 *
 * It started as a private piece of the landing hero and is shared now because
 * the About page wanted the same thing — which is the point at which a layout
 * stops being a page and becomes a component.
 *
 * The rotations are deliberately unequal. A fan with even spacing reads as a
 * CSS trick; an uneven one reads as a hand.
 */
export default function PhotoFan({ photos, mascot = null, mascotSize = 104, className = '' }) {
  return (
    <div className={`fan${className ? ` ${className}` : ''}`} aria-hidden="true">
      {photos.map((p, i) => (
        <figure className={`fan-card fan-${i + 1}`} key={p.src}>
          <img
            src={p.src}
            alt=""
            width="440"
            height="300"
            loading={i === photos.length - 1 ? 'eager' : 'lazy'}
            decoding="async"
          />
        </figure>
      ))}
      {mascot && <Mascot pose={mascot} size={mascotSize} className="fan-owl" />}
    </div>
  );
}

// The brand mark: an owl, drawn to match the mascot in web/public/brand/owl.webp.
//
// One path with `fill-rule: evenodd`, so the eye discs are holes punched through
// the head and the pupils are islands inside those holes. That is what lets the
// same mark sit on white, on ink and on lime without a variant for each — the
// body inherits `currentColor` and the page shows through the eyes.
//
// The raster mascot is the same character at large sizes (hero, empty states,
// sign-in). This vector is the version that survives 20px.

const OWL = 'M5.9 2.2a.9.9 0 0 1 1.25-.28L10 3.72a8.9 8.9 0 0 1 4 0l2.85-1.8a.9.9 0 0 1 1.25.28c.55.92.8 1.96.73 3A7.8 7.8 0 0 1 20 10.1v4.3c0 4.2-3.58 7.4-8 7.4s-8-3.2-8-7.4v-4.3c0-1.8.62-3.48 1.67-4.82a4.9 4.9 0 0 1 .23-3.08Z'
  + 'M8.8 7.9a3.15 3.15 0 1 0 0 6.3 3.15 3.15 0 0 0 0-6.3Z'
  + 'M15.2 7.9a3.15 3.15 0 1 0 0 6.3 3.15 3.15 0 0 0 0-6.3Z'
  + 'M8.8 9.65a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z'
  + 'M15.2 9.65a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z'
  + 'M12 13.4l1.45 1.5a1.95 1.95 0 0 1-2.9 0L12 13.4Z';

export default function Logo({ size = 28, tone = 'ink', className = '', ...rest }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      className={`logo logo-${tone}${className ? ` ${className}` : ''}`}
      role="img" aria-hidden="true" focusable="false"
      {...rest}
    >
      <path d={OWL} fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
    </svg>
  );
}

/** The mark in its lockup box — used where the logo needs a filled container
 *  (the app icon slot, the sign-in card, a message avatar). */
export function LogoBadge({ size = 40, className = '' }) {
  return (
    <span className={`logo-badge${className ? ` ${className}` : ''}`} style={{ width: size, height: size }}>
      <Logo size={Math.round(size * 0.62)} />
    </span>
  );
}

/** The illustrated mascot. Same character, drawn rather than geometric — for
 *  the places that want warmth rather than a glyph. `pose` picks the file. */
export function Mascot({ pose = 'owl', size = 120, alt = '', className = '', ...rest }) {
  return (
    <img
      src={`/brand/${pose}.webp`}
      width={size} height={size}
      alt={alt}
      aria-hidden={alt ? undefined : 'true'}
      loading="lazy" decoding="async"
      className={`mascot${className ? ` ${className}` : ''}`}
      {...rest}
    />
  );
}

// The brand mark: a ghost.
//
// One path with `fill-rule: evenodd`, so the eyes are holes punched through the
// body rather than shapes painted on top of it. That is what lets the same mark
// sit on white, on ink and on lime without a variant for each — it inherits
// `currentColor` for the body and shows whatever is behind it through the eyes.
//
// `tone` picks the two-tone treatment used in the sidebar and site header: a
// lime body with the page showing through the eyes.

export default function Logo({ size = 28, tone = 'ink', className = '', ...rest }) {
  const GHOST = 'M4 20.6V11a8 8 0 0 1 16 0v9.6l-2.67-2.1-2.66 2.1-2.67-2.1-2.67 2.1-2.66-2.1Z'
    + 'M9.4 9.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z'
    + 'M14.6 9.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z';

  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      className={`logo logo-${tone}${className ? ` ${className}` : ''}`}
      role="img" aria-hidden="true" focusable="false"
      {...rest}
    >
      <path d={GHOST} fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
    </svg>
  );
}

/** The mark in its lockup box — used where the logo needs a filled container
 *  (the chat avatar, the app icon slot, the login card). */
export function LogoBadge({ size = 40, className = '' }) {
  return (
    <span className={`logo-badge${className ? ` ${className}` : ''}`} style={{ width: size, height: size }}>
      <Logo size={Math.round(size * 0.62)} />
    </span>
  );
}

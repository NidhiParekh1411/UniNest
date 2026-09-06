import { Children, cloneElement, isValidElement } from 'react';

/* An infinite horizontal ribbon.
 *
 * The trick is that the track holds the children *twice* and animates to
 * -50%: at the moment the animation restarts, the second copy is sitting
 * exactly where the first one started, so the seam is invisible and there is
 * no measurement, no timer and no JS running per frame.
 *
 * The duplicate is `aria-hidden` and its focusable descendants are removed
 * from the tab order, so a screen reader and the keyboard both see one copy.
 *
 * It pauses on hover and on focus-within — a reader who wants to look at a
 * card can stop it just by pointing at it. Under `prefers-reduced-motion` the
 * animation is dropped entirely in CSS and the strip becomes an ordinary
 * horizontal scroller, which is why the track is scrollable in the first
 * place rather than translated by transform alone.
 */
export default function Marquee({ children, speed = 46, reverse = false, className = '' }) {
  const items = Children.toArray(children);

  const copy = (keyPrefix, hidden) => items.map((child, i) => (
    <div className="marquee-item" key={`${keyPrefix}-${i}`} {...(hidden ? { 'aria-hidden': 'true' } : {})}>
      {hidden && isValidElement(child) ? cloneElement(child, { tabIndex: -1 }) : child}
    </div>
  ));

  return (
    <div className={`marquee${className ? ` ${className}` : ''}`}>
      <div
        className={`marquee-track${reverse ? ' marquee-reverse' : ''}`}
        style={{ '--marquee-duration': `${speed}s` }}
      >
        {copy('a', false)}
        {copy('b', true)}
      </div>
    </div>
  );
}

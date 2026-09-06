// Motion primitives shared by the public site and the app.
//
// Everything here degrades to "already visible / already counted" when the
// viewer prefers reduced motion, and nothing depends on scroll position for
// content to exist — the animations are decoration over a page that is
// complete without them.
import { useEffect, useRef, useState } from 'react';

const reduced = () =>
  typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Adds `.is-visible` the first time the element scrolls into view, which is
 * what the `.reveal` transition in theme.css waits for. One observer per
 * element, disconnected as soon as it has fired — reveals never replay.
 */
export function useReveal({ threshold = 0.15, rootMargin = '0px 0px -8% 0px' } = {}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (reduced() || typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.classList.add('is-visible');
        io.disconnect();
      }
    }, { threshold, rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, rootMargin]);
  return ref;
}

/**
 * Wraps children in a scroll-revealed element.
 * `from` picks the direction; `delay` staggers siblings in a list.
 */
export function Reveal({ children, from = 'up', delay = 0, as: Tag = 'div', className = '', style, ...rest }) {
  const ref = useReveal();
  const dir = { up: '', left: ' reveal-left', right: ' reveal-right', scale: ' reveal-scale' }[from] ?? '';
  return (
    <Tag
      ref={ref}
      className={`reveal${dir}${className ? ` ${className}` : ''}`}
      style={{ '--reveal-delay': `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Counts up to `value` once the element is on screen. `suffix`/`prefix` are
 * rendered outside the number so "35k+" animates only the digits.
 */
export function Counter({ value, duration = 1500, prefix = '', suffix = '', decimals = 0 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (reduced() || typeof IntersectionObserver === 'undefined') {
      setShown(value);
      return undefined;
    }
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        // easeOutExpo — fast off the line, settles gently on the final number.
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        setShown(value * eased);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, duration]);

  const text = decimals > 0
    ? shown.toFixed(decimals)
    : Math.round(shown).toLocaleString('en-IN');

  return <span ref={ref}>{prefix}{text}{suffix}</span>;
}

/** True once the window has scrolled past `offset` — drives header/back-to-top. */
export function useScrolled(offset = 12) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset]);
  return scrolled;
}

/**
 * A photo slot. Renders the image when one exists in web/public/images, and a
 * flat pastel block naming the expected file when it does not — so the layout
 * is presentable, and honestly empty, before any photograph is downloaded.
 * See docs/IMAGES.md for the shopping list.
 */
export function Frame({ src, alt, label, shape = 'wide', className = '', children }) {
  const [failed, setFailed] = useState(false);
  const empty = !src || failed;
  return (
    <div className={`frame frame-${shape}${empty ? ' frame-empty' : ''}${className ? ` ${className}` : ''}`}>
      {!empty && <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />}
      {empty && (
        <div className="frame-empty-note">
          {alt}
          {src && <code>{src.replace(/^\//, '')}</code>}
        </div>
      )}
      {label && !empty && <div className="frame-label">{label}</div>}
      {children}
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';

export function Button({ variant = 'secondary', size, icon, children, className = '', ...rest }) {
  const classes = ['btn', variant !== 'secondary' && `btn-${variant}`, size && `btn-${size}`, className]
    .filter(Boolean).join(' ');
  return (
    <button type="button" className={classes} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  );
}

export function Card({ title, subtitle, action, children, tight, flush, tone, className = '' }) {
  // `tone` tints the whole block with one of the four pastel families —
  // see the .card-lime / -lavender / -peach / -sky rules in app.css.
  const classes = ['card', tight && 'card-tight', flush && 'card-flush',
    tone && `card-${tone}`, className].filter(Boolean).join(' ');
  return (
    <section className={classes}>
      {(title || action) && (
        <header className="card-head">
          <div className="card-head-text">
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone = 'neutral', dot, children }) {
  return (
    <span className={`badge${tone !== 'neutral' ? ` badge-${tone}` : ''}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function Field({ label, hint, error, children, id }) {
  return (
    <div className="field">
      {label && <label className="label" htmlFor={id}>{label}</label>}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function Stat({ label, value, hint, tone = 'neutral' }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${tone !== 'neutral' ? ` tone-${tone}` : ''}`}>{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, body, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={20} /></div>
      <div className="empty-title">{title}</div>
      {body && <p className="empty-body">{body}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

/* Replays a soft entrance whenever `token` changes, without remounting the
 * children.
 *
 * This is the other half of the refresh behaviour in `useApi`: the data is
 * swapped in place rather than blanked back to a skeleton, and a change with
 * no transition at all is indistinguishable from nothing having happened. A
 * remount would animate too, but it would also throw away any state the
 * subtree holds — an open tab, a scroll position, a half-typed field. Removing
 * the class, forcing a reflow and adding it back is what restarts a CSS
 * animation on an element that is staying exactly where it is.
 */
export function Refreshed({ token, className = '', children }) {
  const ref = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    // Not on the first render: that content is arriving, not being replaced,
    // and the page has its own entrance already.
    if (first.current) { first.current = false; return; }
    const node = ref.current;
    if (!node) return;
    node.classList.remove('swapped');
    void node.offsetWidth;
    node.classList.add('swapped');
  }, [token]);

  return <div ref={ref} className={`refreshed${className ? ` ${className}` : ''}`}>{children}</div>;
}

export function Skeleton({ height = 16, width = '100%', style }) {
  return <div className="skeleton" style={{ height, width, ...style }} />;
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="row" style={{ gap: 'var(--s3)' }}>
          <Skeleton height={34} width={34} style={{ borderRadius: 'var(--r-sm)', flexShrink: 0 }} />
          <div className="grow stack" style={{ gap: 6 }}>
            <Skeleton height={11} width={`${55 + (i % 3) * 12}%`} />
            <Skeleton height={9} width="34%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorNote({ children, onRetry }) {
  return (
    <div className="note note-bad">
      <Icon name="alert" size={16} />
      <span className="grow">{children}</span>
      {onRetry && <Button size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

/** An inline message block. `tone`: neutral | ok | warn | bad. */
export function Note({ tone = 'neutral', icon, children }) {
  return (
    <div className={`note${tone !== 'neutral' ? ` note-${tone}` : ''}`}>
      {icon && <Icon name={icon} size={16} />}
      <span className="grow">{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------- modal */

/**
 * A dialog.
 *
 * Rendered through a portal into <body>. That is not a stylistic choice: a
 * `position: fixed` backdrop is positioned against the nearest ancestor that
 * has a transform, filter or animation rather than against the viewport, and
 * every app screen sits inside an animated `.content` wrapper. Rendered in
 * place, the scrim covered the content box instead of the window — which is
 * exactly the bug this replaces. A portal has no such ancestor, so `inset: 0`
 * means the viewport, always.
 */
export function Modal({ open, onClose, title, subtitle, children, footer, wide, icon }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);

    // Lock the page behind the dialog without letting it jump sideways as the
    // scrollbar disappears.
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    const previouslyFocused = document.activeElement;
    panelRef.current?.focus({ preventScroll: true });

    return () => {
      document.removeEventListener('keydown', onKey);
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`modal${wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-head">
          {icon && <span className="modal-icon"><Icon name={icon} size={18} /></span>}
          <div className="grow">
            <h2 className="modal-title">{title}</h2>
            {subtitle && <p className="modal-sub">{subtitle}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ tabs */

/**
 * Segmented pill filters — the reference's All / Mandatory / Completed row.
 * The selected pill is ink-filled; the rest are quiet on the page ground.
 */
export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`segmented${className ? ` ${className}` : ''}`} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          className={`segment${value === t.value ? ' active' : ''}`}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.count != null && <span className="segment-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function PageHead({ title, subtitle, action }) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {action && <div className="page-head-action">{action}</div>}
    </header>
  );
}

export function Table({ columns, rows, empty, keyOf = (_, i) => i }) {
  if (!rows?.length) return empty ?? <EmptyState title="Nothing here yet" />;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} style={c.align === 'right' ? { textAlign: 'right' } : undefined}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={keyOf(row, i)}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'right' ? 'cell-num' : undefined}>
                  {c.render ? c.render(row, i) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

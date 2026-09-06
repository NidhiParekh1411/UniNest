import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import { Button } from './ui.jsx';
import { useScrolled } from './Reveal.jsx';
import { useAuth } from '../lib/auth.jsx';
import { NAV, PRODUCT } from '../lib/site.js';

// A plain sticky header: white once the page scrolls, transparent at the top.
// The nav is a row of quiet links with an ink pill on the current one — no
// cursor-following indicator, because the pointer is not information.
export default function SiteHeader() {
  const scrolled = useScrolled(8);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [drawer, setDrawer] = useState(false);

  const isActive = (item) => (item.end
    ? location.pathname === '/' && !location.hash
    : item.to.startsWith('/#')
      ? location.pathname === '/' && location.hash === item.to.slice(1)
      : location.pathname.startsWith(item.to));

  // Close the drawer on navigation, on Escape and once the desktop nav takes
  // over, and lock the page behind it while it is open.
  useEffect(() => { setDrawer(false); }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(false); };
    const mq = window.matchMedia('(min-width: 900px)');
    const onChange = () => { if (mq.matches) setDrawer(false); };
    document.addEventListener('keydown', onKey);
    mq.addEventListener('change', onChange);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onChange);
      document.body.style.overflow = prev;
    };
  }, [drawer]);

  // In-page anchors need manual handling: react-router owns the URL, so a bare
  // <a href="/#how"> would reload rather than scroll.
  const go = (to) => (e) => {
    if (!to.startsWith('/#')) return;
    e.preventDefault();
    const id = to.slice(2);
    if (location.pathname !== '/') { navigate(to); return; }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', to);
  };

  const brand = (
    <Link to="/" className="brand" aria-label={`${PRODUCT.name} — home`}>
      <Logo size={28} />
      <span className="brand-text">
        <span className="brand-name">{PRODUCT.name}</span>
      </span>
    </Link>
  );

  return (
    <>
      <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
        <div className="wrapper site-header-inner">
          {brand}

          <nav className="site-nav" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`site-nav-link${isActive(item) ? ' active' : ''}`}
                onClick={go(item.to)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="site-header-actions">
            {user ? (
              <Link to="/app"><Button variant="primary">Open the app</Button></Link>
            ) : (
              <>
                <Link to="/login" className="hide-sm"><Button variant="ghost">Sign in</Button></Link>
                <Link to="/login"><Button variant="primary">Get started</Button></Link>
              </>
            )}
            <button
              type="button"
              className="burger"
              aria-expanded={drawer}
              aria-controls="site-drawer"
              aria-label={drawer ? 'Close menu' : 'Open menu'}
              onClick={() => setDrawer((v) => !v)}
            >
              <Icon name={drawer ? 'close' : 'menu'} size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Portalled to <body>: the header is sticky and inside a stacking context
          of its own, so a drawer rendered as its child cannot reliably cover the
          viewport. */}
      {drawer && createPortal(
        <>
          <div className="drawer-scrim" onClick={() => setDrawer(false)} />
          <aside className="drawer drawer-right" id="site-drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="drawer-head">
              {brand}
              <button type="button" className="icon-btn" onClick={() => setDrawer(false)} aria-label="Close menu">
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="drawer-body">
              <nav className="nav" aria-label="Main">
                {NAV.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`nav-item${isActive(item) ? ' active' : ''}`}
                    onClick={(e) => { go(item.to)(e); setDrawer(false); }}
                  >
                    <span>{item.label}</span>
                    <Icon name="arrowUpRight" size={16} />
                  </Link>
                ))}
              </nav>
            </div>
            <div className="drawer-foot">
              <div className="stack" style={{ gap: 'var(--s2)' }}>
                <Link to={user ? '/app' : '/login'} onClick={() => setDrawer(false)}>
                  <Button variant="primary" size="lg" className="btn-block">
                    {user ? 'Open the app' : 'Sign in as a student'}
                  </Button>
                </Link>
                {!user && (
                  <Link to="/staff" onClick={() => setDrawer(false)}>
                    <Button size="lg" className="btn-block">Faculty &amp; administration</Button>
                  </Link>
                )}
              </div>
            </div>
          </aside>
        </>,
        document.body,
      )}
    </>
  );
}

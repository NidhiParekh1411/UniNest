import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import { useAuth } from '../lib/auth.jsx';
import { initials } from '../lib/format.js';
import { PRODUCT } from '../lib/site.js';

// Navigation is defined per role in one place, and it is the *same* list on
// every screen size — the desktop rail and the mobile drawer render it
// identically. There is no "More" bucket and no collapsed state: one nav, one
// order, always the whole thing.
const NAV = {
  student: [
    { to: '/app', label: 'Home', icon: 'grid', end: true },
    { to: '/app/assistant', label: 'Assistant', icon: 'ghost' },
    { to: '/app/timetable', label: 'Timetable', icon: 'calendar' },
    { to: '/app/attendance', label: 'Attendance', icon: 'chart' },
    { to: '/app/results', label: 'Results', icon: 'graduation' },
    { to: '/app/assignments', label: 'Assignments', icon: 'clipboard' },
    { to: '/app/library', label: 'Library', icon: 'books' },
    { to: '/app/notices', label: 'Notices', icon: 'megaphone' },
  ],
  faculty: [
    { to: '/app', label: 'Home', icon: 'grid', end: true },
    { to: '/app/assistant', label: 'Assistant', icon: 'ghost' },
    { to: '/app/timetable', label: 'My schedule', icon: 'calendar' },
    { to: '/app/assignments', label: 'Assignments', icon: 'clipboard' },
    { to: '/app/attendance', label: 'Attendance', icon: 'chart' },
    { to: '/app/results', label: 'Results', icon: 'graduation' },
    { to: '/app/library', label: 'Library', icon: 'books' },
    { to: '/app/question-banks', label: 'Question banks', icon: 'papers' },
    { to: '/app/notices', label: 'Notices', icon: 'megaphone' },
  ],
  admin: [
    { to: '/app', label: 'Home', icon: 'grid', end: true },
    { to: '/app/assistant', label: 'Assistant', icon: 'ghost' },
    { to: '/app/people', label: 'People', icon: 'users' },
    { to: '/app/subjects', label: 'Subjects & faculty', icon: 'layers' },
    { to: '/app/timetable', label: 'Timetables', icon: 'calendar' },
    { to: '/app/attendance', label: 'Attendance', icon: 'chart' },
    { to: '/app/results', label: 'Results', icon: 'graduation' },
    { to: '/app/library', label: 'Library', icon: 'books' },
    { to: '/app/question-banks', label: 'Question banks', icon: 'papers' },
    { to: '/app/notices', label: 'Notices', icon: 'megaphone' },
  ],
};

const ROLE_LABEL = { student: 'Student', faculty: 'Faculty', admin: 'Administration' };

function BrandBlock() {
  return (
    <Link to="/" className="brand" title="Back to the site">
      <Logo size={26} />
      <span className="brand-text">
        <span className="brand-name">{PRODUCT.name}</span>
      </span>
    </Link>
  );
}

function NavList({ items, onNavigate }) {
  return (
    <nav className="nav" aria-label="Main">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <Icon name={item.icon} size={18} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function AccountBlock({ user, onSignOut }) {
  return (
    <div className="account">
      <span className="avatar">{initials(user.name)}</span>
      <span className="account-text">
        <span className="account-name">{user.name}</span>
        <span className="account-meta">
          {user.role === 'student'
            ? `${user.branch} · Semester ${user.semester}`
            : (user.department ?? ROLE_LABEL[user.role])}
        </span>
      </span>
      <button type="button" className="icon-btn" onClick={onSignOut} aria-label="Sign out" title="Sign out">
        <Icon name="logout" size={16} />
      </button>
    </div>
  );
}

export default function Shell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);

  const items = NAV[user.role] ?? NAV.student;

  // Close on navigation, on Escape, and whenever the viewport grows past the
  // breakpoint where the permanent rail takes over — otherwise the drawer stays
  // mounted and invisible, holding the body scroll lock. That combination is
  // what made the old mobile menu feel broken.
  useEffect(() => { setDrawer(false); }, [location.pathname]);

  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(false); };
    const mq = window.matchMedia('(min-width: 960px)');
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

  const signOut = () => { logout(); navigate('/', { replace: true }); };

  return (
    <div className="shell">
      {/* Permanent rail — visible at every desktop width, with no way to hide it. */}
      <aside className="sidebar">
        <div className="sidebar-head"><BrandBlock /></div>
        <div className="sidebar-body"><NavList items={items} /></div>
        <div className="sidebar-foot"><AccountBlock user={user} onSignOut={signOut} /></div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="burger"
            aria-label={drawer ? 'Close menu' : 'Open menu'}
            aria-expanded={drawer}
            aria-controls="app-drawer"
            onClick={() => setDrawer((v) => !v)}
          >
            <Icon name={drawer ? 'close' : 'menu'} size={20} />
          </button>
          <BrandBlock />
          <span className="avatar">{initials(user.name)}</span>
        </header>

        {children}
      </div>

      {/* The mobile drawer is portalled to <body> for the same reason the modal
          is: `.main` is an animated, transformed ancestor, and a fixed element
          inside one is positioned against it rather than against the viewport. */}
      {drawer && createPortal(
        <>
          <div className="drawer-scrim" onClick={() => setDrawer(false)} />
          <aside className="drawer" id="app-drawer" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="drawer-head">
              <BrandBlock />
              <button type="button" className="icon-btn" onClick={() => setDrawer(false)} aria-label="Close menu">
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="drawer-body">
              <NavList items={items} onNavigate={() => setDrawer(false)} />
              <Link to="/about" className="nav-item nav-item-secondary" onClick={() => setDrawer(false)}>
                <Icon name="globe" size={18} />
                <span>About us</span>
              </Link>
            </div>
            <div className="drawer-foot">
              <AccountBlock user={user} onSignOut={signOut} />
            </div>
          </aside>
        </>,
        document.body,
      )}
    </div>
  );
}

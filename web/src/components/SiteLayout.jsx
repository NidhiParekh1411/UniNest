import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import SiteHeader from './SiteHeader.jsx';
import SiteFooter from './SiteFooter.jsx';
import { useScrolled } from './Reveal.jsx';

// Chrome shared by every public page. Also owns two behaviours that belong to
// the frame rather than to any one page: restoring scroll on navigation, and
// honouring a #hash that arrives with the URL (a footer link into /about#history
// lands before the section exists, so the scroll is deferred a frame).
export default function SiteLayout({ children }) {
  const { pathname, hash } = useLocation();
  const scrolled = useScrolled(400);

  useEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [pathname, hash]);

  return (
    <div className="site">
      <SiteHeader />
      <main className="site-main">{children}</main>
      <SiteFooter />
      <button
        className={`to-top${scrolled ? ' visible' : ''}`}
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      >
        <Icon name="arrowUp" size={18} />
      </button>
    </div>
  );
}

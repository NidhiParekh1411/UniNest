import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';
import { COLLEGE, FOOTER_LEGAL, FOOTER_LINKS, PRODUCT, SOCIALS } from '../lib/site.js';

function FooterLink({ link }) {
  if (link.external || link.href) {
    return (
      <a className="footer-link" href={link.href} target="_blank" rel="noreferrer noopener">
        {link.label}
      </a>
    );
  }
  return <Link className="footer-link" to={link.to}>{link.label}</Link>;
}

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrapper">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="brand brand-inv">
              <Logo size={30} />
              <span className="brand-text">
                <span className="brand-name">{PRODUCT.name}</span>
                <span className="brand-sub">{PRODUCT.tagline}</span>
              </span>
            </div>

            <p className="footer-about">
              Built for {COLLEGE.name}, {COLLEGE.city} — the assistant answers from the
              college’s own documents and never guesses when they are silent.
            </p>

            <div className="footer-contact">
              <span className="footer-contact-row">
                <Icon name="pin" size={16} />
                <span>{COLLEGE.address}</span>
              </span>
              <a className="footer-contact-row" href={`mailto:${COLLEGE.email}`}>
                <Icon name="mail" size={16} />
                <span>{COLLEGE.email}</span>
              </a>
              <a className="footer-contact-row" href={COLLEGE.website} target="_blank" rel="noreferrer noopener">
                <Icon name="globe" size={16} />
                <span>glsuniversity.ac.in</span>
              </a>
            </div>

            <div className="footer-socials">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  className="footer-social"
                  href={s.href}
                  aria-label={s.label}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Icon name={s.icon} size={16} />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_LINKS.map((col) => (
            <div key={col.title}>
              <h4 className="footer-col-title">{col.title}</h4>
              <div className="footer-links">
                {col.links.map((link) => <FooterLink key={link.label} link={link} />)}
              </div>
            </div>
          ))}
        </div>

        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {PRODUCT.name} · A student project for {COLLEGE.name}.
            Records shown are generated sample data.
          </span>
          <div className="footer-bottom-links">
            {FOOTER_LEGAL.map((l) => <Link key={l.label} className="footer-link" to={l.to}>{l.label}</Link>)}
          </div>
        </div>
      </div>
    </footer>
  );
}

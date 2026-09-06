import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import api from '../lib/api.js';
import Icon from '../components/Icon.jsx';
import Logo, { Mascot } from '../components/Logo.jsx';
import { Button, Field } from '../components/ui.jsx';
import { initials } from '../lib/format.js';
import { PRODUCT } from '../lib/site.js';

// Two sign-in surfaces, per the brief: students on one, faculty and admin
// merged on the other. Both render the same split panel — brand and promise on
// the left, the form on the right — and the segmented switch at the top of the
// form is the only chrome that distinguishes them, so arriving at the wrong
// door costs one tap rather than a wasted password attempt.
//
// The left panel is the one place in the app that carries a full-bleed
// gradient. It is a sign-in screen: there is nothing to read there, so an
// atmospheric wash is doing a job rather than decorating one.
const COPY = {
  student: {
    title: 'Sign in to your semester',
    lede: 'Your branch and semester come from your account, so answers are already scoped to you.',
    placeholder: 'you@student.college.edu',
    switchText: 'Faculty or administration?',
    switchTo: '/staff',
    switchLabel: 'Use the staff sign-in',
    asideTitle: 'Your whole semester, in one place.',
    points: [
      ['sparkle', 'Answers with a source', 'Every reply names the document it came from.'],
      ['calendar', 'Your timetable, not a generic one', 'Scoped to your branch, semester and lab batch.'],
    ],
  },
  staff: {
    title: 'Sign in to manage',
    lede: 'One sign-in for faculty and administration. What you can reach is decided by your role.',
    placeholder: 'you@college.edu',
    switchText: 'Are you a student?',
    switchTo: '/login',
    switchLabel: 'Use the student sign-in',
    asideTitle: 'Publish once. Answer a hundred times.',
    points: [
      ['upload', 'Format-aware ingestion', 'PDF, Word, Excel and slides, each parsed the right way.'],
      ['clock', 'Schedule an announcement', 'Write it now, let it appear at the time you choose.'],
    ],
  },
};

export default function Login({ portal }) {
  const copy = COPY[portal];
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState([]);

  useEffect(() => {
    api.demoAccounts()
      .then((res) => setAccounts(res.accounts.filter((a) => (portal === 'student' ? a.role === 'student' : a.role !== 'student'))))
      .catch(() => setAccounts([]));
  }, [portal]);

  const signIn = async (mail, pass) => {
    setError(null);
    setBusy(true);
    try {
      await login(mail, pass, portal);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const submit = (e) => {
    e?.preventDefault();
    signIn(email.trim(), password);
  };

  const useAccount = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    signIn(account.email, account.password);
  };

  return (
    <div className="auth">
      <div className="auth-split">
        {/* The brand panel. Below 900px it collapses to a banner above the
            form rather than disappearing — the gradient and the mascot are
            what make this screen feel like a front door on a phone too.

            The brand sits in the corner and everything else is centred in the
            half, so the owl lines up with the form across the fold rather than
            sinking to the bottom of a full-height column. */}
        <aside className="auth-aside">
          <Link to="/" className="brand brand-inv brand-lg auth-brand">
            <Logo size={30} />
            <span className="brand-text">
              <span className="brand-name">{PRODUCT.name}</span>
              <span className="brand-sub">{PRODUCT.tagline}</span>
            </span>
          </Link>

          <div className="auth-aside-mid">
            <Mascot pose="owl-board" size={420} className="auth-aside-art" alt="" />

            <div className="auth-aside-foot">
              <h2 className="auth-aside-title">{copy.asideTitle}</h2>
              <ul className="auth-points">
                {copy.points.map(([icon, title, body]) => (
                  <li className="auth-point" key={title}>
                    <span className="auth-point-icon"><Icon name={icon} size={16} /></span>
                    <span>
                      <span className="auth-point-title">{title}</span>
                      <span className="auth-point-body">{body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <main className="auth-main">
          <div className="auth-card">
            <div className="auth-card-head">
              <h1 className="auth-title">{copy.title}</h1>
              <p className="auth-lede">{copy.lede}</p>
            </div>

            <div className="portal-switch" data-portal={portal}>
              <span className="portal-switch-thumb" />
              <Link to="/login" className={portal === 'student' ? 'active' : ''}>Student</Link>
              <Link to="/staff" className={portal === 'staff' ? 'active' : ''}>Faculty &amp; admin</Link>
            </div>

            <form className="auth-form" onSubmit={submit}>
              {error && <div className="auth-alert" role="alert">{error}</div>}

              <Field label="Email address" id="email">
                <input
                  id="email" className="input" type="email" autoComplete="username"
                  placeholder={copy.placeholder}
                  value={email} onChange={(e) => setEmail(e.target.value)} required
                />
              </Field>

              <Field label="Password" id="password">
                <input
                  id="password" className="input" type="password" autoComplete="current-password"
                  placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} required
                />
              </Field>

              <Button type="submit" variant="primary" size="lg" className="btn-block" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
                {!busy && <Icon name="arrowRight" size={16} />}
              </Button>
            </form>

            {accounts.length > 0 && (
              <>
                <div className="auth-divider">Or use a demo account</div>
                <div className="demo-accounts">
                  {accounts.map((a) => (
                    <button key={a.email} type="button" className="demo-account" onClick={() => useAccount(a)} disabled={busy}>
                      <span className="avatar">{initials(a.name)}</span>
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className="demo-account-name">{a.name}</span>
                        <span className="demo-account-note">{a.note}</span>
                      </span>
                      <Icon name="arrowRight" size={15} className="demo-account-go" />
                    </button>
                  ))}
                </div>
              </>
            )}

            <p className="auth-switch">
              {copy.switchText} <Link to={copy.switchTo}>{copy.switchLabel}</Link>
            </p>

            <p className="auth-fineprint">
              Demonstration build. Student records in this environment are generated sample
              data, not a real cohort. <Link to="/" className="link">Back to the site</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Logo from '../components/Logo.jsx';
import { Button } from '../components/ui.jsx';
import { Reveal } from '../components/Reveal.jsx';
import { AUDIENCES, COLLEGE, FEATURES, JOURNEY, PRODUCT } from '../lib/site.js';

/* --------------------------------------------------------------------- hero
   One column of type, one worked example. The example is a real render of the
   product's core promise — question, answer, citation — laid flat on the page
   rather than tilted and floating, because a floating card is decoration and
   this is evidence. */

function Hero() {
  return (
    <section className="hero">
      <div className="wrapper hero-grid">
        <div className="hero-copy">
          <Reveal>
            <span className="pill">
              <span className="pill-dot" />
              Grounded answers with citations
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="hero-title">
              Everything about your semester,{' '}
              <span className="mark">answered from the source</span>.
            </h1>
          </Reveal>

          <Reveal delay={150}>
            <p className="hero-lede">{PRODUCT.description}</p>
          </Reveal>

          <Reveal delay={220}>
            <div className="hero-actions">
              <Link to="/login">
                <Button variant="primary" size="lg">
                  Sign in as a student<Icon name="arrowRight" size={16} />
                </Button>
              </Link>
              <Link to="/staff">
                <Button size="lg">Faculty &amp; administration</Button>
              </Link>
            </div>
          </Reveal>

          <Reveal delay={280}>
            <p className="hero-note">
              Built for {COLLEGE.name}, {COLLEGE.city} · {COLLEGE.accreditation}
            </p>
          </Reveal>
        </div>

        <Reveal from="right" delay={180} className="hero-demo">
          <div className="demo">
            <div className="demo-head">
              <Logo size={22} />
              <span className="demo-head-text">
                <b>Assistant</b>
                <span>Answering as a semester 5 student</span>
              </span>
            </div>

            <p className="demo-q">How many lectures can I miss and still sit the exam?</p>

            <p className="demo-a">
              You must maintain <b>75% attendance</b> in each subject to be eligible for the
              end-semester examination. Below that, the Head of Department must approve a
              condonation request before the exam form is accepted.
            </p>

            <div className="demo-cite">
              <Icon name="doc" size={14} />
              <span>Academic Regulations 2025 · §4.2 Attendance</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- how it works */

function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="wrapper">
        <Reveal className="section-head">
          <span className="eyebrow">How it works</span>
          <h2 className="section-title">The path a question takes</h2>
          <p className="section-lede">
            Six steps from a document somebody uploaded to an answer you can check.
            Nothing in between is a guess.
          </p>
        </Reveal>

        <div className="step-grid">
          {JOURNEY.map((s, i) => (
            <Reveal key={s.title} delay={i * 60}>
              <article className="step">
                <span className="step-index">{s.step}</span>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-body">{s.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ features
   Colour-coded blocks, in the manner of the reference's course cards: the
   pastel is the category, not decoration, and it repeats consistently. */

function Features() {
  return (
    <section className="section section-surface" id="features">
      <div className="wrapper">
        <Reveal className="section-head">
          <span className="eyebrow">What it does</span>
          <h2 className="section-title">Built around one promise: never guess</h2>
          <p className="section-lede">
            A college assistant that invents a deadline is worse than no assistant at all.
            Every feature exists to keep the answer traceable to a document.
          </p>
        </Reveal>

        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <article className={`feature tone-${f.tone}`}>
                <span className="feature-icon"><Icon name={f.icon} size={20} /></span>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-body">{f.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- audiences */

function Audiences() {
  return (
    <section className="section" id="audiences">
      <div className="wrapper">
        <Reveal className="section-head">
          <span className="eyebrow">Three roles, one system</span>
          <h2 className="section-title">Everyone sees exactly what they should</h2>
          <p className="section-lede">
            Scoping is enforced on the server, before anything is ranked or returned —
            hiding a button in the interface is not security.
          </p>
        </Reveal>

        <div className="aud-grid">
          {AUDIENCES.map((a, i) => (
            <Reveal key={a.role} delay={i * 90}>
              <article className={`aud tone-${a.tone}`}>
                <span className="aud-icon"><Icon name={a.icon} size={20} /></span>
                <h3 className="aud-role">{a.role}</h3>
                <p className="aud-body">{a.body}</p>
                <ul className="aud-points">
                  {a.points.map((p) => (
                    <li className="aud-point" key={p}>
                      <Icon name="check" size={14} />{p}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------------- CTA */

function CallToAction() {
  return (
    <section className="section section-tight">
      <div className="wrapper">
        <Reveal from="scale">
          <div className="cta">
            <h2 className="cta-title">Stop asking three people the same question</h2>
            <p className="cta-lede">
              Sign in with a demo account and ask it anything about the semester —
              no setup, no credentials to type.
            </p>
            <div className="cta-actions">
              <Link to="/login">
                <Button variant="accent" size="lg">
                  Open the student portal<Icon name="arrowRight" size={16} />
                </Button>
              </Link>
              <Link to="/about"><Button variant="outline-inv" size="lg">About {COLLEGE.name}</Button></Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Audiences />
      <CallToAction />
    </>
  );
}

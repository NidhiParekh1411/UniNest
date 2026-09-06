import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ArcSteps from '../components/ArcSteps.jsx';
import PhotoFan from '../components/PhotoFan.jsx';
import { Button } from '../components/ui.jsx';
import { Reveal } from '../components/Reveal.jsx';
import {
  AUDIENCES, COLLEGE, CTA_PHOTO, FEATURES, HERO_PHOTOS, JOURNEY, PRODUCT,
} from '../lib/site.js';

/* --------------------------------------------------------------------- hero
   Copy on the left, a fanned stack of photographs on the right — see
   components/PhotoFan.jsx, which the About hero shares. */

function Hero() {
  return (
    <section className="hero">
      <div className="wrapper hero-grid">
        <div className="hero-copy">
          <Reveal>
            <h1 className="hero-title">
              Everything about your semester,{' '}
              <span className="mark">answered from the source</span>.
            </h1>
          </Reveal>

          <Reveal delay={90}>
            <p className="hero-lede">{PRODUCT.description}</p>
          </Reveal>

          <Reveal delay={160}>
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

          <Reveal delay={220}>
            <p className="hero-note">
              Built for {COLLEGE.name}, {COLLEGE.city} · {COLLEGE.accreditation}
            </p>
          </Reveal>
        </div>

        <Reveal from="right" delay={140} className="hero-art">
          <PhotoFan photos={HERO_PHOTOS} mascot="owl" />
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- proof
   The product's core promise, rendered rather than described: a question, the
   answer, and the document the answer came from. */

function Proof() {
  return (
    <section className="section section-tight">
      <div className="wrapper">
        <Reveal>
          <div className="proof">
            <div className="proof-side">
              <span className="eyebrow">A real exchange</span>
              <h2 className="proof-title">Ask in plain English. Get the circular that says so.</h2>
              <p className="proof-body">
                Every document-grounded reply names the source it quoted, and every
                citation opens the passage it came from. When the corpus is silent,
                the assistant says so rather than filling the gap.
              </p>
            </div>

            <div className="demo">
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
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- how it works
   Six steps arranged along an arc. See components/ArcSteps.jsx — the curve is
   the layout rather than something that moves, and the detail arrives on
   hover, focus or tap. */

function HowItWorks() {
  return (
    <section className="section section-surface" id="how">
      <div className="wrapper">
        <Reveal className="section-head section-head-center">
          <span className="eyebrow">How it works</span>
          <h2 className="section-title">The path a question takes</h2>
          <p className="section-lede">
            Six steps from a document somebody uploaded to an answer you can check.
            Nothing in between is a guess.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <ArcSteps steps={JOURNEY} />
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- features
   Photo tiles rather than pastel boxes. Each tile is a photograph with a veil
   that darkens towards its foot, the title sitting on the dark, and the
   explanation arriving on hover. Heights vary so the grid has a rhythm; the
   columns are `column-count`, because a masonry of variable-height blocks is
   the one layout CSS grid still cannot do without fixed row tracks. */

function Features() {
  return (
    <section className="section" id="features">
      <div className="wrapper">
        <Reveal className="section-head">
          <span className="eyebrow">What it does</span>
          <h2 className="section-title">Built around one promise: never guess</h2>
          <p className="section-lede">
            A college assistant that invents a deadline is worse than no assistant at all.
            Every feature exists to keep the answer traceable to a document.
          </p>
        </Reveal>

        <div className="mason">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 50} className="mason-cell">
              <article className={`tile tile-${f.shape}`} tabIndex={0}>
                <img className="tile-photo" src={f.image} alt={f.imageAlt} loading="lazy" decoding="async" />
                <div className="tile-text">
                  <span className={`tile-icon tone-${f.tone}`}><Icon name={f.icon} size={16} /></span>
                  <h3 className="tile-title">{f.title}</h3>
                  <p className="tile-body">{f.body}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- audiences */

function Audiences() {
  return (
    <section className="section section-surface" id="audiences">
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
                <img className="aud-photo" src={a.image} alt={a.imageAlt} loading="lazy" decoding="async" />
                <div className="aud-text">
                  <h3 className="aud-role">{a.role}</h3>
                  <p className="aud-body">{a.body}</p>
                  <ul className="aud-points">
                    {a.points.map((p) => (
                      <li className="aud-point" key={p}>
                        <Icon name="check" size={14} />{p}
                      </li>
                    ))}
                  </ul>
                </div>
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
    <section className="section">
      <div className="wrapper">
        <Reveal from="scale">
          <div className="cta">
            <img className="cta-photo" src={CTA_PHOTO.src} alt={CTA_PHOTO.alt} loading="lazy" decoding="async" />
            <div className="cta-body">
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
      <Proof />
      <HowItWorks />
      <Features />
      <Audiences />
      <CallToAction />
    </>
  );
}

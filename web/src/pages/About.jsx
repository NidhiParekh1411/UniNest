import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Button } from '../components/ui.jsx';
import { Counter, Frame, Reveal } from '../components/Reveal.jsx';
import JourneyPath from '../components/JourneyPath.jsx';
import PhotoFan from '../components/PhotoFan.jsx';
import { Mascot } from '../components/Logo.jsx';
import {
  ABOUT_PHOTOS, COLLEGE, COLLEGE_FACULTIES, COLLEGE_MILESTONES, COLLEGE_STATS,
  COLLEGE_VALUES, HISTORY_PHOTOS,
} from '../lib/site.js';

function AboutHero() {
  return (
    <section className="hero hero-plain">
      <div className="wrapper hero-grid">
        <div className="hero-copy">
          <Reveal>
            <span className="eyebrow">About us</span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="hero-title" style={{ maxWidth: '16ch' }}>
              A legacy that began in <span className="mark">1927</span>.
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="hero-lede">
              This assistant is built for <b>{COLLEGE.name}</b>, {COLLEGE.city} — an institution
              whose parent body, the {COLLEGE.society}, has been teaching in Gujarat for close to
              a century. Its motto is <i>{COLLEGE.motto}</i>.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="hero-actions">
              <a href={COLLEGE.website} target="_blank" rel="noreferrer noopener">
                <Button variant="primary" size="lg">
                  Visit glsuniversity.ac.in<Icon name="arrowUpRight" size={16} />
                </Button>
              </a>
              <Link to="/login"><Button size="lg">Open the assistant</Button></Link>
            </div>
          </Reveal>
        </div>

        <Reveal from="right" delay={140} className="hero-art">
          <PhotoFan photos={ABOUT_PHOTOS} mascot="owl-board" mascotSize={132} />
        </Reveal>
      </div>
    </section>
  );
}

function Numbers() {
  return (
    <section className="wrapper" style={{ marginBottom: 'var(--section-y)' }}>
      <Reveal from="scale">
        <div className="stat-strip">
          {COLLEGE_STATS.map((s) => (
            <div className="stat-strip-item" key={s.label}>
              <div className="stat-strip-value">
                {/* The founding year is a year, not a quantity — it should not
                    tick up from zero or carry a thousands separator. */}
                {s.plain ? s.value : <Counter value={s.value} suffix={s.suffix ?? ''} />}
              </div>
              <div className="stat-strip-label">{s.label}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function Story() {
  return (
    <section className="section section-surface">
      <div className="wrapper">
        <div className="grid-2" style={{ gap: 'var(--s7)', alignItems: 'center' }}>
          <Reveal from="left">
            <span className="eyebrow">The institution</span>
            <h2 className="section-title">Founded by the people who built modern Gujarat</h2>
            <p className="section-lede">
              The {COLLEGE.society} was established in {COLLEGE.societyFounded} by Sardar
              Vallabhbhai Patel, Shri Ganesh Vasudev Mavlankar — later the first Speaker of the
              Lok Sabha — and Shri I. M. Nanavati. It has since grown into one of the largest
              and oldest educational bodies in the state, running more than thirty institutions.
            </p>
            <p className="section-lede">
              {COLLEGE.name} itself was established in {COLLEGE.universityFounded} under The
              Gujarat Private Universities (Amendment) Act, bringing that legacy under a single
              university on a ten-acre campus in the heart of {COLLEGE.city}.
            </p>
          </Reveal>

          <Reveal from="right" delay={140}>
            <Frame src="/img/campus-quad.webp" alt="A college quadrangle on a clear day" shape="wide" label={`${COLLEGE.name}, ${COLLEGE.city}`} />
            <div className="grid-2" style={{ gap: 'var(--s3)', marginTop: 'var(--s3)' }}>
              <Frame src="/img/campus-autumn.webp" alt="Campus buildings under autumn trees" shape="square" />
              <Frame src="/img/library-hall.webp" alt="Library shelves under warm lamps" shape="square" />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function History() {
  return (
    <section className="section section-tint" id="history">
      <div className="wrapper">
        <Reveal className="section-head section-head-center">
          <span className="eyebrow">Our history</span>
          <h2 className="section-title">The flashback to a century of teaching</h2>
          <p className="section-lede">
            From a law society founded in 1927 to a NAAC A+ university in the centre of Ahmedabad.
          </p>
        </Reveal>

        {/* The timeline is a narrow column by nature — it was leaving half the
            section empty. The photographs fill that half and stay put while the
            milestones scroll past them. */}
        <div className="history-grid">
          <JourneyPath steps={COLLEGE_MILESTONES} labelKey="year" />

          <Reveal from="right" delay={120} className="history-art">
            <div className="stack-curve">
              {HISTORY_PHOTOS.map((p, i) => (
                <figure className={`stack-curve-card sc-${i + 1}`} key={p.src}>
                  <img src={p.src} alt={p.alt} loading="lazy" decoding="async" />
                </figure>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Mission() {
  return (
    <section className="section">
      <div className="wrapper">
        <Reveal className="section-head">
          <span className="eyebrow">Vision &amp; mission</span>
          <h2 className="section-title">Nationally rooted. Globally relevant.</h2>
          <p className="section-lede">
            The university states its aim as creating value through economic, social and
            environmental development while being a world-class education provider — with
            national rootedness, regional recognition and global relevance.
          </p>
        </Reveal>

        <div className="value-grid">
          {COLLEGE_VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 90}>
              <article className="value">
                <span className="value-icon"><Icon name={v.icon} size={20} /></span>
                <div>
                  <h3 className="value-title">{v.title}</h3>
                  <p className="value-body">{v.body}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faculties() {
  return (
    <section className="section section-ink" id="faculties">
      <div className="wrapper">
        <Reveal className="section-head">
          <span className="eyebrow">Academics</span>
          <h2 className="section-title">Nine faculties, one campus</h2>
          <p className="section-lede">
            {COLLEGE.name} teaches across law, commerce, management, computing, design,
            engineering and the performing arts.
          </p>
        </Reveal>

        <div className="prog-list">
          {COLLEGE_FACULTIES.map((f, i) => (
            <Reveal key={f.name} delay={i * 55}>
              <article className="prog">
                <span className="prog-index">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <div className="row" style={{ gap: 'var(--s3)' }}>
                    <Icon name={f.icon} size={20} style={{ color: 'var(--lime)', flexShrink: 0 }} />
                    <h3 className="prog-title">{f.name}</h3>
                  </div>
                  <div className="prog-tags">
                    {f.programmes.map((p) => <span className="prog-tag" key={p}>{p}</span>)}
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Recognition() {
  const items = [
    ['NAAC Grade A+', 'Accredited with a CGPA of 3.44 by the National Assessment and Accreditation Council — the highest in the general category.', true],
    ['UGC recognised', 'Recognised by the University Grants Commission, established under The Gujarat Private Universities (Amendment) Act, 2015.'],
    ['1000+ recruiters', 'Companies that have recruited from the campus, including offers from Fortune 500 organisations.'],
    ['30+ institutions', 'Run by the Gujarat Law Society across law, commerce, management, computing and the arts.'],
    ['Ten-acre campus', 'In the heart of Ahmedabad, opposite Law Garden, with libraries, laboratories, sports facilities and auditoria.'],
    ['Learn Love Serve', 'The university motto, carried forward from the society founded in 1927.', true],
  ];

  return (
    <section className="section" id="recognition">
      <div className="wrapper">
        <Reveal className="section-head">
          <span className="eyebrow">Recognition</span>
          <h2 className="section-title">Accreditation &amp; standing</h2>
        </Reveal>

        <div className="acc-grid">
          {items.map(([title, body, highlight], i) => (
            <Reveal key={title} delay={i * 70}>
              <article className={`acc${highlight ? ' highlight' : ''}`}>
                <span className="acc-index">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="acc-title">{title}</h3>
                <p className="acc-body">{body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section className="section section-tint" id="contact">
      <div className="wrapper">
        <Reveal className="section-head section-head-center">
          <span className="eyebrow">Find us</span>
          <h2 className="section-title">Opposite Law Garden, Ellisbridge</h2>
        </Reveal>

        <div className="contact-grid">
          <Reveal>
            <div className="contact-card">
              <span className="contact-label">Campus</span>
              <p className="contact-value">{COLLEGE.address}</p>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <div className="contact-card">
              <span className="contact-label">Online</span>
              <p className="contact-value">
                <a href={COLLEGE.website} target="_blank" rel="noreferrer noopener">glsuniversity.ac.in</a>
                <br />
                <a href={`mailto:${COLLEGE.email}`}>{COLLEGE.email}</a>
              </p>
            </div>
          </Reveal>
          <Reveal delay={180}>
            <div className="contact-card">
              <span className="contact-label">Accreditation</span>
              <p className="contact-value">{COLLEGE.accreditation}</p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <p className="dim center" style={{ fontSize: 'var(--fs-xs)', marginTop: 'var(--s6)', maxWidth: '70ch', marginInline: 'auto' }}>
            This is a student project built for {COLLEGE.name} and is not an official
            university website. Institutional facts on this page come from glsuniversity.ac.in
            and gujaratlawsociety.org; the student records shown inside the app are generated
            sample data, not a real cohort.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* The page used to end on a subscribe box that went nowhere: typing an address
   into it did nothing, which is a promise the build cannot keep. It closes on
   the two things that do work instead, with the whole cast on the left. */

function Closing() {
  return (
    <section className="section section-closing">
      <div className="wrapper">
        <Reveal from="scale">
          <div className="closing">
            <Mascot pose="owl-trio" size={280} className="closing-art" />
            <div className="closing-body">
              <span className="eyebrow">Ready when you are</span>
              <h2 className="closing-title">Three roles, one campus, one place to ask</h2>
              <p className="closing-lede">
                Students, faculty and administration each see exactly what they should — and
                every answer names the document it came from. Sign in with a demo account and
                try to catch it guessing.
              </p>
              <div className="closing-actions">
                <Link to="/login">
                  <Button variant="primary" size="lg">
                    Open the assistant<Icon name="arrowRight" size={16} />
                  </Button>
                </Link>
                <Link to="/staff"><Button size="lg">Faculty &amp; administration</Button></Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function About() {
  return (
    <>
      <AboutHero />
      <Numbers />
      <Story />
      <History />
      <Mission />
      <Faculties />
      <Recognition />
      <Contact />
      <Closing />
    </>
  );
}

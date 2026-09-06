import Icon from './Icon.jsx';
import { useReveal } from './Reveal.jsx';

// A vertical timeline: a dashed rail with a node per milestone.
//
// The rail is a single stretched line rather than the serpentine this used to
// draw. A weave between alternating columns is decoration that only survives at
// one width — this reads the same on a phone and on a desktop, and the dashes
// are the only ornament left.
//
// `steps` items: { year|step, icon, title, body }

export default function JourneyPath({ steps, labelKey = 'step' }) {
  const ref = useReveal({ threshold: 0.08 });

  return (
    <div className="path" ref={ref}>
      <svg className="path-svg path-svg-narrow" preserveAspectRatio="none" viewBox="0 0 2 600" aria-hidden="true">
        <path className="path-line path-line-draw" d="M 1 10 L 1 590" />
      </svg>

      <ol className="path-steps">
        {steps.map((s, i) => (
          <li className="path-step" key={s.title} style={{ '--reveal-delay': `${i * 80}ms` }}>
            <span className="path-node">
              <Icon name={s.icon} size={20} />
            </span>
            <div className="path-step-body">
              <span className="path-year">{s[labelKey] ?? s.step ?? s.year}</span>
              <h3 className="path-title">{s.title}</h3>
              <p className="path-body">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

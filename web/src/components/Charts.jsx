// Hand-rolled SVG charts. No charting library — the visual language here is
// specific (hairline gridlines, flat pastel series, tabular numerals) and a
// library would fight it. See docs/UI_GUIDE.md § Charts.
//
// Each chart measures its container rather than scaling a fixed viewBox, so
// labels stay at their intended pixel size on a phone and on a desktop alike.
import { useEffect, useId, useRef, useState } from 'react';

function useMeasure() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

// Series colours come from the pastel palette, flat — no gradients anywhere.
// A bar is lime when it clears its threshold and peach when it does not, so the
// chart carries the same meaning as the badges beside it.
const SERIES = {
  ok: 'var(--lime-2)',
  warn: 'var(--peach-2)',
  bad: '#e79b91',
  line: 'var(--ink)',
  track: 'var(--surface-3)',
};

const AXIS = { fontSize: 11, fill: 'var(--text-3)', fontFamily: 'var(--font)', fontWeight: 600 };

/* -------------------------------------------------------------- bar chart */

export function BarChart({ data, height = 200, valueSuffix = '%', threshold, maxValue }) {
  const [ref, width] = useMeasure();

  const pad = { top: 14, right: 4, bottom: 34, left: 30 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const max = maxValue ?? Math.max(100, ...data.map((d) => d.value));
  const ticks = [0, max / 2, max];

  const count = data.length || 1;
  const step = innerW / count;
  const barW = Math.max(6, Math.min(38, step * 0.56));

  return (
    <div className="chart-wrap" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`Bar chart of ${data.length} values`}>
          {ticks.map((t) => {
            const y = pad.top + innerH - (t / max) * innerH;
            return (
              <g key={t}>
                <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="var(--border)" strokeWidth="1" />
                <text x={pad.left - 7} y={y + 3.5} textAnchor="end" {...AXIS}>{Math.round(t)}</text>
              </g>
            );
          })}
          {threshold != null && threshold <= max && (
            <g>
              <line
                x1={pad.left} x2={width - pad.right}
                y1={pad.top + innerH - (threshold / max) * innerH}
                y2={pad.top + innerH - (threshold / max) * innerH}
                stroke="var(--border-strong)" strokeWidth="1.5" strokeDasharray="4 4"
              />
              <text
                x={width - pad.right} y={pad.top + innerH - (threshold / max) * innerH - 5}
                textAnchor="end" {...AXIS} fill="var(--text-3)"
              >
                {threshold}{valueSuffix} required
              </text>
            </g>
          )}
          {data.map((d, i) => {
            const h = Math.max(2, (Math.min(d.value, max) / max) * innerH);
            const x = pad.left + i * step + (step - barW) / 2;
            const y = pad.top + innerH - h;
            const below = threshold != null && d.value < threshold;
            return (
              <g key={d.label + i}>
                <rect
                  x={x} y={y} width={barW} height={h} rx="6"
                  fill={below ? SERIES.bad : SERIES.ok}
                >
                  <title>{`${d.fullLabel ?? d.label}: ${d.value}${valueSuffix}`}</title>
                </rect>
                <text x={x + barW / 2} y={height - 18} textAnchor="middle" {...AXIS}>{d.label}</text>
                <text x={x + barW / 2} y={y - 5} textAnchor="middle" {...AXIS} fill="var(--text-2)" fontWeight="600">
                  {Math.round(d.value)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- line chart */

export function LineChart({ data, height = 200, valueSuffix = '', maxValue }) {
  const [ref, width] = useMeasure();
  const fillId = `${useId()}-fill`;

  const pad = { top: 16, right: 12, bottom: 30, left: 32 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const max = maxValue ?? Math.max(10, ...data.map((d) => d.value)) * 1.1;
  const ticks = [0, max / 2, max];

  const points = data.map((d, i) => ({
    x: pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
    y: pad.top + innerH - (d.value / max) * innerH,
    ...d,
  }));

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${points.at(-1)?.x.toFixed(1)} ${pad.top + innerH} L${points[0]?.x.toFixed(1)} ${pad.top + innerH} Z`;

  return (
    <div className="chart-wrap" ref={ref}>
      {width > 0 && data.length > 0 && (
        <svg width={width} height={height} role="img" aria-label="Line chart">
          {/* The one place a gradient survives: a chart area fade, which is a
              legibility device rather than decoration. */}
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c4ea77" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#c4ea77" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => {
            const y = pad.top + innerH - (t / max) * innerH;
            return (
              <g key={t}>
                <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="var(--border)" strokeWidth="1" />
                <text x={pad.left - 7} y={y + 3.5} textAnchor="end" {...AXIS}>{Math.round(t)}</text>
              </g>
            );
          })}
          <path d={area} fill={`url(#${fillId})`} />
          <path d={line} fill="none" stroke={SERIES.line} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="3.6" fill="var(--surface)" stroke={SERIES.line} strokeWidth="2">
                <title>{`${p.label}: ${p.value}${valueSuffix}`}</title>
              </circle>
              <text x={p.x} y={height - 12} textAnchor="middle" {...AXIS}>{p.label}</text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ donut chart */

export function DonutChart({ value, max = 100, size = 136, label, sublabel, tone }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pctValue = Math.max(0, Math.min(1, value / max));
  const toneColor = tone === 'bad' ? SERIES.bad : tone === 'warn' ? SERIES.warn : SERIES.ok;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s5)', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} role="img" aria-label={`${value} of ${max}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={SERIES.track} strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={toneColor} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${circumference * pctValue} ${circumference}`}
            style={{ transition: 'stroke-dasharray 520ms cubic-bezier(.2,.8,.2,1)' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div className="donut-center">
            <div className="num" style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {label}
            </div>
            {sublabel && <div className="dim" style={{ fontSize: 'var(--fs-2xs)', marginTop: 4 }}>{sublabel}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* A small percentage ring, for a grid of them.
 *
 * Not DonutChart with a smaller `size`: that one hard-codes an --fs-2xl centre
 * label, which is the right weight for the single hero number on the
 * attendance screen and far too big for a 76px ring in a card. The geometry is
 * the same; only the type scale differs.
 */
export function Ring({ value, max = 100, size = 76, tone, label }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pctValue = Math.max(0, Math.min(1, value / max));
  const toneColor = tone === 'bad' ? SERIES.bad : tone === 'warn' ? SERIES.warn : SERIES.ok;

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} role="img" aria-label={`${value} of ${max}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={SERIES.track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={toneColor} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${circumference * pctValue} ${circumference}`}
          style={{ transition: 'stroke-dasharray 520ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <span className="ring-value num">{label ?? `${Math.round(value)}%`}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- progress */

export function Progress({ value, max = 100, tone }) {
  const pctValue = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(pctValue)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-fill${tone && tone !== 'ok' ? ` ${tone}` : ''}`} style={{ width: `${pctValue}%` }} />
    </div>
  );
}

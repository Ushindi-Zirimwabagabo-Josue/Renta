import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, formatCompact, formatRWF, periodLabel } from '../logic';
import type { Category, Period } from '../types';

interface Month {
  period: Period;
  byCategory: Record<Category, number>;
  total: number;
}

const PAD = { top: 12, right: 8, bottom: 26, left: 44 };

function niceMax(v: number): number {
  if (v <= 0) return 10000;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/** Stacked monthly spending by category, with hover tooltip and a table view. */
export function SpendingChart({ months, current }: { months: Month[]; current: Period }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const hasData = months.some((m) => m.total > 0);
  // Draw at the real pixel width so text and bars keep their size on every screen.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [asTable, hasData]);
  const H = W < 480 ? 200 : 240;
  const used = CATEGORIES.filter((c) => months.some((m) => m.byCategory[c.id] > 0));
  const max = niceMax(Math.max(...months.map((m) => m.total)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const slot = iw / months.length;
  const bw = Math.min(28, slot * 0.6);
  const y = (v: number) => PAD.top + ih - (v / max) * ih;

  return (
    <section className="card viz-root">
      <div className="card-head">
        <div>
          <h3>Spending, last 12 months</h3>
          <p className="muted small">All payments, by the month they were for</p>
        </div>
        <button className="btn ghost small" onClick={() => setAsTable((t) => !t)}>{asTable ? 'Show chart' : 'Show table'}</button>
      </div>
      {!hasData ? (
        <p className="empty">No payments yet. Record one and it will show up here.</p>
      ) : asTable ? (
        <div className="table-wrap">
          <table className="table num">
            <thead>
              <tr>
                <th>Month</th>
                {used.map((c) => <th key={c.id}>{c.label}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.period}>
                  <td>{periodLabel(m.period, true)}</td>
                  {used.map((c) => <td key={c.id}>{m.byCategory[c.id] ? m.byCategory[c.id].toLocaleString('en-US') : '–'}</td>)}
                  <td><strong>{m.total.toLocaleString('en-US')}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="legend">
            {used.map((c) => (
              <span key={c.id}><i style={{ background: `var(--cat-${c.id})` }} />{c.label}</span>
            ))}
          </div>
          <div className="chart-wrap" ref={wrapRef}>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly spending by category" onMouseLeave={() => setHover(null)}>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'axis' : 'grid'} />
                  <text x={PAD.left - 6} y={y(t)} className="tick" textAnchor="end" dominantBaseline="middle">{formatCompact(t)}</text>
                </g>
              ))}
              {months.map((m, i) => {
                const cx = PAD.left + slot * i + slot / 2;
                let acc = 0;
                const segs = used.filter((c) => m.byCategory[c.id] > 0);
                return (
                  <g key={m.period} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${periodLabel(m.period)}: ${formatRWF(m.total)}`}>
                    <rect x={cx - slot / 2} y={PAD.top} width={slot} height={ih} fill="transparent" />
                    {hover === i && <rect x={cx - slot / 2 + 2} y={PAD.top} width={slot - 4} height={ih} className="hover-band" rx={4} />}
                    {segs.map((c, si) => {
                      const v = m.byCategory[c.id];
                      const y0 = y(acc);
                      acc += v;
                      const y1 = y(acc);
                      const top = si === segs.length - 1;
                      const h = Math.max(1, y0 - y1 - (top ? 0 : 2));
                      return top ? (
                        <path key={c.id} d={roundTop(cx - bw / 2, y1, bw, h, Math.min(4, h))} fill={`var(--cat-${c.id})`} />
                      ) : (
                        <rect key={c.id} x={cx - bw / 2} y={y1 + 2} width={bw} height={Math.max(0.5, y0 - y1 - 2)} fill={`var(--cat-${c.id})`} />
                      );
                    })}
                    <text x={cx} y={H - 8} className={`tick${m.period === current ? ' strong' : ''}`} textAnchor="middle">
                      {W < 480 ? periodLabel(m.period, true).charAt(0) : periodLabel(m.period, true).split(' ')[0]}
                    </text>
                  </g>
                );
              })}
            </svg>
            {hover !== null && (
              <div
                className="tooltip"
                style={{
                  left: PAD.left + slot * hover + slot / 2,
                  transform: hover > months.length * 0.6 ? 'translateX(calc(-100% - 16px))' : hover < months.length * 0.3 ? 'translateX(16px)' : 'translateX(-50%)',
                }}
              >
                <strong>{periodLabel(months[hover].period)}</strong>
                {used.filter((c) => months[hover].byCategory[c.id] > 0).reverse().map((c) => (
                  <div key={c.id} className="tt-row"><i style={{ background: `var(--cat-${c.id})` }} />{c.label}<span>{formatRWF(months[hover].byCategory[c.id])}</span></div>
                ))}
                <div className="tt-row total">Total<span>{formatRWF(months[hover].total)}</span></div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function roundTop(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

import { useEffect, useRef, useState } from 'react';
import { formatCompact } from '../logic';

export function useWidth<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [ref, w] as const;
}

export interface BarItem {
  key: string;
  label: string;
  value: number;
  /** Tooltip text */
  tip: string;
  /** Highlight as a warning (shown with a ! marker, not colour alone) */
  flag?: boolean;
}

/** Single-series bar chart with hover tooltips. */
export function SimpleBars({ items, height = 180, ariaLabel }: { items: BarItem[]; height?: number; ariaLabel: string }) {
  const [ref, W] = useWidth<HTMLDivElement>([items.length]);
  const [hover, setHover] = useState<number | null>(null);
  const PAD = { top: 16, right: 8, bottom: 24, left: 40 };
  const H = height;
  const max = Math.max(1, ...items.map((i) => i.value));
  const nice = (() => {
    const exp = Math.pow(10, Math.floor(Math.log10(max)));
    const f = max / exp;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
  })();
  const ih = H - PAD.top - PAD.bottom;
  const iw = W - PAD.left - PAD.right;
  const slot = iw / Math.max(1, items.length);
  const bw = Math.min(28, slot * 0.6);
  const y = (v: number) => PAD.top + ih - (v / nice) * ih;
  const every = Math.ceil(items.length / Math.max(1, Math.floor(iw / 44)));
  return (
    <div className="chart-wrap" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(f * nice)} y2={y(f * nice)} className={f === 0 ? 'axis' : 'grid'} />
            <text x={PAD.left - 6} y={y(f * nice)} className="tick" textAnchor="end" dominantBaseline="middle">{formatCompact(f * nice)}</text>
          </g>
        ))}
        {items.map((it, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          const h = Math.max(it.value > 0 ? 2 : 0, y(0) - y(it.value));
          const r = Math.min(4, h);
          return (
            <g key={it.key} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={it.tip}>
              <rect x={cx - slot / 2} y={PAD.top} width={slot} height={ih} fill="transparent" />
              {hover === i && <rect x={cx - slot / 2 + 2} y={PAD.top} width={slot - 4} height={ih} className="hover-band" rx={4} />}
              {h > 0 && (
                <path
                  d={`M${cx - bw / 2},${y(0)}V${y(0) - h + r}Q${cx - bw / 2},${y(0) - h} ${cx - bw / 2 + r},${y(0) - h}H${cx + bw / 2 - r}Q${cx + bw / 2},${y(0) - h} ${cx + bw / 2},${y(0) - h + r}V${y(0)}Z`}
                  className={it.flag ? 'bar flag' : 'bar'}
                />
              )}
              {it.flag && <text x={cx} y={y(0) - h - 4} textAnchor="middle" className="flag-mark">!</text>}
              {i % every === 0 && <text x={cx} y={H - 6} className="tick" textAnchor="middle">{it.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="tooltip"
          style={{
            left: PAD.left + slot * hover + slot / 2,
            transform: hover > items.length * 0.6 ? 'translateX(calc(-100% - 16px))' : hover < items.length * 0.3 ? 'translateX(16px)' : 'translateX(-50%)',
          }}
        >
          {items[hover].tip}
        </div>
      )}
    </div>
  );
}

// People present over time: one series, a 2px line over a 10% wash, solid
// hairline grid, a crosshair and readout on hover, focus or touch, and a
// table view for anyone who would rather read the numbers.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TrafficBucket } from '../../supabase/functions/_shared/contract.ts';
import { monotonePath } from '../domain/curve.ts';
import { formatCount, formatHour, formatTime } from '../domain/format.ts';

const H = 220;
const PAD = { top: 16, right: 12, bottom: 28, left: 44 };

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export function TrafficChart({ buckets, label }: { buckets: TrafficBucket[]; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Measured, never assumed: a guessed width wider than a phone held the grid
  // column open at that width and pushed the whole page sideways.
  const [w, setW] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.floor(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = niceMax(Math.max(0, ...buckets.map(b => b.count)));
  const innerW = w - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (buckets.length <= 1 ? innerW / 2 : (i / (buckets.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const { line, area } = useMemo(() => {
    if (buckets.length === 0) return { line: '', area: '' };
    // Smooth, as the prototype drew it, but never above a peak or below zero.
    const curve = monotonePath(buckets.map((b, i) => ({ x: x(i), y: y(b.count) })));
    return {
      line: curve,
      area: `${curve}L${x(buckets.length - 1)},${y(0)}L${x(0)},${y(0)}Z`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets, w, max]);

  const ticks = [0, max / 2, max];
  // Quarter-hour buckets (the Hour view) label with minutes; hourly ones don't need them.
  const subHour = buckets.length > 1 && Date.parse(buckets[1]!.start) - Date.parse(buckets[0]!.start) < 3_600_000;
  const every = Math.max(1, Math.ceil(buckets.length / Math.max(2, Math.floor(innerW / 64))));
  const a = active != null ? buckets[active] : null;

  const pick = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const rel = (clientX - rect.left - PAD.left) / innerW;
    setActive(Math.max(0, Math.min(buckets.length - 1, Math.round(rel * (buckets.length - 1)))));
  };

  if (buckets.length === 0) return <p className="text-sm text-fg-muted">No time window to draw.</p>;

  return (
    <div className="min-w-0">
      <div
        ref={ref}
        className="relative w-full min-w-0 select-none outline-none focus-visible:ring-2 focus-visible:ring-purple"
        tabIndex={0}
        role="img"
        aria-label={`${label}. Peak ${formatCount(Math.max(...buckets.map(b => b.count)))}. Use the arrow keys to read each point.`}
        onMouseMove={e => pick(e.clientX)}
        onMouseLeave={() => setActive(null)}
        onTouchMove={e => pick(e.touches[0]!.clientX)}
        onKeyDown={e => {
          if (e.key === 'ArrowRight') setActive(i => Math.min(buckets.length - 1, (i ?? -1) + 1));
          else if (e.key === 'ArrowLeft') setActive(i => Math.max(0, (i ?? buckets.length) - 1));
          else return;
          e.preventDefault();
        }}
        onBlur={() => setActive(null)}
      >
        {w > 0 && <svg width={w} height={H} className="block">
          {ticks.map(t => (
            <g key={t}>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--neutral-border)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--neutral-fg-subtle)">
                {formatCount(t)}
              </text>
            </g>
          ))}
          <path d={area} fill="var(--brand-purple)" fillOpacity={0.1} />
          <path d={line} fill="none" stroke="var(--brand-purple)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {buckets.map((b, i) => (i % every === 0 ? (
            <text key={b.start} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--neutral-fg-subtle)">
              {subHour ? formatTime(b.start) : formatHour(b.start)}
            </text>
          ) : null))}
          {a && active != null && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--neutral-border-strong)" strokeWidth={1} />
              <circle cx={x(active)} cy={y(a.count)} r={5} fill="var(--brand-purple)" stroke="var(--neutral-surface)" strokeWidth={2} />
            </g>
          )}
        </svg>}
        {a && active != null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-chip bg-ink px-3 py-2 text-xs text-on-fill shadow-medium"
            style={{ left: Math.min(Math.max(x(active), 70), w - 70), top: Math.max(0, y(a.count) - 58) }}
          >
            <div className="font-semibold tabular-nums">{formatCount(a.count)} people</div>
            <div className="text-loop-on-dark">
              {formatTime(a.start)}
              {buckets[active + 1] ? ` – ${formatTime(buckets[active + 1]!.start)}` : ''}
            </div>
          </div>
        )}
      </div>
      <button type="button" className="mt-2 text-xs font-semibold text-purple-text hover:underline" onClick={() => setTable(t => !t)} aria-expanded={table}>
        {table ? 'Hide the table' : 'Show as a table'}
      </button>
      {table && (
        <div className="mt-2 max-h-64 overflow-auto rounded-panel border border-line">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs text-fg-muted">
              <tr><th className="px-3 py-2 font-semibold">From</th><th className="px-3 py-2 text-right font-semibold">People there</th></tr>
            </thead>
            <tbody>
              {buckets.map(b => (
                <tr key={b.start} className="border-t border-line">
                  <td className="px-3 py-1.5 text-fg-muted">{formatTime(b.start)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink">{formatCount(b.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

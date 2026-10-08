// The funnel: one row per step, bars on one scale, the top step as 100%.
// One series, one hue (the Mole purple, 4.6:1 on white), no legend — the
// heading says what is plotted. Values and labels wear text colours.

import { Info } from 'lucide-react';
import { useState } from 'react';
import { formatCount, formatPercent } from '../domain/format.ts';
import type { Stage } from '../domain/funnel.ts';
import { Pill } from './kit.tsx';

export function FunnelChart({ stages }: { stages: Stage[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const top = Math.max(1, ...stages.map(s => s.value ?? 0));

  return (
    <ol className="space-y-5" aria-label="Funnel">
      {stages.map((s, i) => {
        const pct = s.value == null ? 0 : (s.value / top) * 100;
        const rate = s.value != null && s.of != null ? formatPercent(s.value, s.of) : null;
        const prev = stages[i - 1];
        return (
          <li key={s.key}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">{s.label}</span>
                {s.source === 'mole' && <Pill tone="events">From Mole</Pill>}
                <button
                  type="button"
                  aria-expanded={open === s.key}
                  aria-label={`How "${s.label}" is counted`}
                  onClick={() => setOpen(open === s.key ? null : s.key)}
                  className="rounded-full p-1 text-fg-subtle hover:bg-surface-3 hover:text-ink"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              <div className="flex items-baseline gap-2">
                {rate && prev && (
                  <span className="text-xs text-fg-muted">{rate} of “{prev.label.toLowerCase()}”</span>
                )}
                <span className="text-xl font-extrabold tabular-nums tracking-tight text-ink">
                  {s.value == null ? '—' : formatCount(s.value)}
                </span>
              </div>
            </div>

            {s.value == null ? (
              <div className="rounded-r border border-dashed border-line-strong px-3 py-1.5 text-xs text-fg-muted">
                Not measured. {s.missing}
              </div>
            ) : (
              <div className="h-5 w-full" aria-hidden>
                <div
                  className="h-full rounded-r bg-purple transition-[width] duration-300 ease-enter"
                  style={{ width: `${Math.max(pct, s.value > 0 ? 0.6 : 0)}%`, borderTopRightRadius: 4, borderBottomRightRadius: 4 }}
                />
              </div>
            )}

            {open === s.key && <p className="mt-2 text-xs text-fg-muted">{s.how}</p>}
          </li>
        );
      })}
    </ol>
  );
}

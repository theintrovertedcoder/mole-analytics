// Booths and rooms ranked by the people who stayed: the organiser's answer to
// "which sponsor got their money's worth". A list with the number you rank by
// and a bar to see it, and the other numbers underneath, because names are long
// and a phone is narrow.

import type { Zone, ZoneStats } from '../../supabase/functions/_shared/contract.ts';
import { formatCount, formatDuration, formatMinutes, formatPercent } from '../domain/format.ts';

export function ZoneList({ stats, zones, thresholdMinutes, title, onFocus }: {
  stats: ZoneStats[];
  zones: Zone[];
  thresholdMinutes: number;
  title: string;
  onFocus: (zoneId: string) => void;
}) {
  const top = Math.max(1, ...stats.map(s => s.stayed));
  const name = (id: string) => zones.find(z => z.id === id)?.name ?? 'A zone that was removed';

  return (
    <section aria-labelledby="zone-list-title" className="flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-subtle sm:p-6">
      <h2 id="zone-list-title" className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
      <p className="mb-3 mt-1 text-sm text-fg-muted">
        Ranked by people who stayed {formatMinutes(thresholdMinutes)} or more. Pick one to see its own funnel.
      </p>
      <ol className="divide-y divide-line">
        {stats.map((s, i) => (
          <li key={s.zoneId} className="flex items-center gap-3 py-2">
            <span aria-hidden className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-fg-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="min-h-11 w-full truncate text-left text-sm font-semibold text-ink hover:text-purple-text hover:underline"
                onClick={() => onFocus(s.zoneId)}
              >
                {name(s.zoneId)}
              </button>
              <div aria-hidden className="-mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-purple" style={{ width: `${(s.stayed / top) * 100}%` }} />
              </div>
              <p className="mt-1 text-xs text-fg-muted">
                {formatCount(s.visitors)} came · {formatPercent(s.stayed, s.visitors) ?? '—'} stayed · typical visit {formatDuration(s.medianDwellSeconds)}
              </p>
            </div>
            <span className="w-12 shrink-0 text-right text-xl font-extrabold tabular-nums text-ink">
              {formatCount(s.stayed)}
              <span className="sr-only"> stayed</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

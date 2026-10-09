// Booths and rooms ranked by the people who stayed: the organiser's answer to
// "which sponsor got their money's worth". A table, because names are long and
// people compare across columns; one inline bar for the column it is sorted by.

import type { Zone, ZoneStats } from '../../supabase/functions/_shared/contract.ts';
import { formatCount, formatDuration, formatPercent } from '../domain/format.ts';

export function ZoneTable({ stats, zones, onFocus }: { stats: ZoneStats[]; zones: Zone[]; onFocus: (zoneId: string) => void }) {
  const top = Math.max(1, ...stats.map(s => s.stayed));
  const name = (id: string) => zones.find(z => z.id === id)?.name ?? 'A zone that was removed';

  return (
    <div className="-mx-5 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-xs text-fg-muted">
          <tr className="border-b border-line">
            <th className="px-5 py-2 font-semibold sm:px-3">Zone</th>
            <th className="px-3 py-2 text-right font-semibold">Came</th>
            <th className="w-[34%] px-3 py-2 font-semibold">Stayed</th>
            <th className="px-3 py-2 text-right font-semibold">Of those who came</th>
            <th className="px-3 py-2 text-right font-semibold">Typical visit</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(s => (
            <tr key={s.zoneId} className="border-b border-line last:border-0">
              <td className="px-5 py-2.5 sm:px-3">
                <button className="min-h-11 text-left font-semibold text-ink hover:text-purple-text hover:underline" onClick={() => onFocus(s.zoneId)}>
                  {name(s.zoneId)}
                </button>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-fg-muted">{formatCount(s.visitors)}</td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-10 text-right font-semibold tabular-nums text-ink">{formatCount(s.stayed)}</span>
                  <div className="h-3 flex-1" aria-hidden>
                    <div className="h-full bg-purple" style={{ width: `${(s.stayed / top) * 100}%`, borderRadius: '0 4px 4px 0' }} />
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-fg-muted">{formatPercent(s.stayed, s.visitors) ?? '—'}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-fg-muted">{formatDuration(s.medianDwellSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

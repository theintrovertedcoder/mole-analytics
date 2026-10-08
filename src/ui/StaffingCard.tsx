// The prototype's staffing card, kept honest. It said "Surge expected: 2:00 PM.
// Recommend 2 additional staff" from nothing. This says when it was actually
// busiest, from the visits counted, and leaves the head-count to the person
// who knows their team.

import { Users } from 'lucide-react';
import type { TrafficBucket } from '../../supabase/functions/_shared/contract.ts';
import { formatCount, formatHour, formatTime } from '../domain/format.ts';
import { MIN_PEOPLE } from '../domain/insights.ts';
import { busiestSlots } from '../domain/staffing.ts';

/** "11am–12pm" for whole hours, "11:15 am – 11:30 am" for quarter-hours. */
const span = (start: string, end: string) =>
  new Date(start).getUTCMinutes() === 0 && new Date(end).getUTCMinutes() === 0
    ? `${formatHour(start)}–${formatHour(end)}`
    : `${formatTime(start)} – ${formatTime(end)}`;

export function StaffingCard({ traffic, place }: { traffic: TrafficBucket[]; place: string }) {
  const top = busiestSlots(traffic);
  const enough = traffic.filter(b => b.count > 0).length >= 3 && (top[0]?.count ?? 0) >= MIN_PEOPLE;
  const max = Math.max(1, ...top.map(b => b.count));

  return (
    <section className="flex h-full flex-col rounded-card border border-line bg-surface p-6 shadow-subtle" aria-label="Staffing">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-chip bg-events-tint p-2 text-events-text"><Users className="h-[18px] w-[18px]" aria-hidden /></div>
        <div>
          <h2 className="font-extrabold tracking-tight text-ink">Staffing</h2>
          <p className="text-xs text-fg-subtle">When to have the most people on the floor</p>
        </div>
      </div>

      {!enough ? (
        <p className="text-sm text-fg-muted">Not enough visits yet to say when {place} is busiest.</p>
      ) : (
        <>
          <div className="rounded-panel bg-surface-2 p-4">
            <p className="text-sm font-extrabold text-ink">
              Busiest: {span(top[0]!.start, top[0]!.end)}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">
              {formatCount(top[0]!.count)} people were at {place} at some point in that time. Plan your strongest
              team for it next time.
            </p>
          </div>
          <ol className="mt-4 space-y-3" aria-label="Busiest times">
            {top.map(b => (
              <li key={b.start} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 whitespace-nowrap tabular-nums text-fg-muted">{span(b.start, b.end)}</span>
                <span className="h-3 flex-1" aria-hidden>
                  <span className={`block h-full bg-purple`}
                    style={{ width: `${(b.count / max) * 100}%`, borderRadius: '0 4px 4px 0' }} />
                </span>
                <span className="w-12 text-right font-semibold tabular-nums text-ink">{formatCount(b.count)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

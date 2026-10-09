// "Zones at a glance": each booth and room as a tile, shaded by how many people
// stayed, with the numbers on the tile and the detail one click away.
//
// It is NOT a floor plan, and it says so on the card. A zone has no position
// in Mole Sense yet (floor plans are Phase 2 of docs/ROADMAP.md), so the tiles
// are laid out in order, not where the zones are. A map that looked like a
// floor plan and wasn't would be a number-shaped lie; this one is a heat board.
//
// The shade is never the only signal: each tile carries its number, and the
// legend says what the shades mean. Tiles go purple for "more stayed", the
// product's data colour; white text only where the contrast test allows it.

import { DoorOpen, Radio, Store, X } from 'lucide-react';
import type { Zone, ZoneStats } from '../../supabase/functions/_shared/contract.ts';
import { formatCount, formatDuration, formatMinutes, formatPercent } from '../domain/format.ts';
import { SHADES, shadeFor } from '../domain/shades.ts';
import { KIND_TEXT } from '../domain/zones.ts';
import { Pill } from './kit.tsx';
import { buttonClass } from './styles.ts';

const LEGEND_LABELS = ['None stayed', '', '', '', 'Most stayed'];

export function ZoneMap({ zones, stats, selectedId, focusId, thresholdMinutes, onSelect, onFocus }: {
  zones: Zone[];
  stats: ZoneStats[];
  selectedId: string | null;
  focusId: string | null;
  thresholdMinutes: number;
  onSelect: (id: string | null) => void;
  onFocus: (id: string) => void;
}) {
  const byId = new Map(stats.map(s => [s.zoneId, s]));
  const tiles = zones.filter(z => z.kind === 'booth' || z.kind === 'room');
  const counted = zones.filter(z => z.kind === 'venue' || z.kind === 'entrance');
  const top = Math.max(0, ...stats.map(s => s.stayed));
  const selected = tiles.find(z => z.id === selectedId) ?? null;
  const sel = selected ? byId.get(selected.id) : undefined;

  return (
    <section aria-labelledby="zone-map-title" className="rounded-card border border-line bg-surface p-5 shadow-subtle sm:p-6">
      <h2 id="zone-map-title" className="text-lg font-extrabold tracking-tight text-ink">Zones at a glance</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Shaded by people who stayed {formatMinutes(thresholdMinutes)} or more. Pick a zone for its detail.
      </p>

      {counted.length > 0 && (
        <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
          <Radio className="h-3.5 w-3.5 text-purple-text" aria-hidden />
          Counting everyone at the event:
          {counted.map(z => <Pill key={z.id} tone="neutral">{z.name}</Pill>)}
        </p>
      )}

      <div
        className="mt-4 rounded-panel border border-line bg-surface-2 p-3 sm:p-4"
        style={{ backgroundImage: 'linear-gradient(to right, var(--neutral-border) 1px, transparent 1px), linear-gradient(to bottom, var(--neutral-border) 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      >
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.25rem,1fr))] gap-3">
          {tiles.map(z => {
            const s = byId.get(z.id);
            const stayed = s?.stayed ?? 0;
            const isSel = z.id === selectedId;
            const isFocus = z.id === focusId;
            return (
              <li key={z.id}>
                <button
                  type="button"
                  aria-pressed={isSel}
                  onClick={() => onSelect(isSel ? null : z.id)}
                  className={`flex min-h-[6.25rem] w-full flex-col justify-between rounded-panel p-3 text-left shadow-subtle transition-shadow duration-normal hover:shadow-medium
                    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple
                    ${SHADES[shadeFor(stayed, top)]!.classes}
                    ${isSel ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface-2' : isFocus ? 'ring-2 ring-purple-border ring-offset-2 ring-offset-surface-2' : ''}`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-xs font-semibold leading-snug">{z.name}</span>
                    {z.kind === 'room' ? <DoorOpen className="h-4 w-4 shrink-0" aria-hidden /> : <Store className="h-4 w-4 shrink-0" aria-hidden />}
                  </span>
                  <span>
                    <span className="block text-[26px] font-extrabold leading-none tabular-nums tracking-tight">{formatCount(stayed)}</span>
                    <span className="mt-0.5 block text-[11px] font-semibold">stayed</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-xs text-fg-muted">
          Each tile is a zone. It is not a floor plan: the tiles aren’t where the zones are.
        </p>
        <div aria-hidden className="flex items-center gap-2 text-[11px] font-semibold text-fg-muted">
          <span>{LEGEND_LABELS[0]}</span>
          <span className="flex gap-1">
            {SHADES.map((c, i) => <span key={i} className={`h-3 w-6 rounded-sm border border-line ${c.classes.split(' ')[0]}`} />)}
          </span>
          <span>{LEGEND_LABELS[4]}</span>
        </div>
      </div>

      {selected && sel && (
        <div role="region" aria-label={`${selected.name}, detail`} className="mt-5 rounded-panel border border-line bg-surface p-4 shadow-medium">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold tracking-tight text-ink">{selected.name}</p>
              <p className="mt-1"><Pill tone="neutral">{KIND_TEXT[selected.kind].name}</Pill></p>
            </div>
            <button
              type="button"
              aria-label="Close the detail"
              onClick={() => onSelect(null)}
              className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-surface-3 hover:text-ink"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-fg-muted">Came</dt>
              <dd className="text-xl font-extrabold tabular-nums text-ink">{formatCount(sel.visitors)}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Stayed</dt>
              <dd className="text-xl font-extrabold tabular-nums text-ink">{formatCount(sel.stayed)}</dd>
              <dd className="text-xs text-fg-muted">{formatPercent(sel.stayed, sel.visitors) ?? '—'} of those who came</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">Typical visit</dt>
              <dd className="text-xl font-extrabold tabular-nums text-ink">{formatDuration(sel.medianDwellSeconds)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[10rem] flex-1" aria-hidden>
              <div className="h-2 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-purple" style={{ width: `${top > 0 ? (sel.stayed / top) * 100 : 0}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-fg-muted">Compared with the zone where most stayed</p>
            </div>
            <button type="button" className={buttonClass('primary')} onClick={() => onFocus(selected.id)}>
              Show its funnel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// src/domain/windows.ts
// The prototype's Event / Day / Hour switch, as real time windows: the whole
// event, one of its days, or one of its hours — in the event's own clock
// (format.ts DISPLAY_TIME_ZONE, Malaysia, which has no daylight saving).

import { formatDate, formatTime } from './format.ts';

export type Granularity = 'event' | 'day' | 'hour';

export interface Slot {
  label: string;
  from: string;
  to: string;
}

/** Malaysia is UTC+8 all year. Tied to DISPLAY_TIME_ZONE; change both together. */
const OFFSET_MS = 8 * 3600_000;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const MAX_HOURS = 96;

const iso = (t: number) => new Date(t).toISOString();

/** The event's days, each clipped to the event's own start and end. */
export function eventDays(from: string, to: string): Slot[] {
  const f = Date.parse(from), t = Date.parse(to);
  if (!(t > f)) return [];
  const out: Slot[] = [];
  // Local midnight at or before the start.
  let day = Math.floor((f + OFFSET_MS) / DAY) * DAY - OFFSET_MS;
  while (day < t) {
    const a = Math.max(day, f), b = Math.min(day + DAY, t);
    out.push({ label: formatDate(iso(a)), from: iso(a), to: iso(b) });
    day += DAY;
  }
  return out;
}

/** The event's hours, on the hour, clipped to its start and end. At most four days' worth. */
export function eventHours(from: string, to: string): Slot[] {
  const f = Date.parse(from), t = Date.parse(to);
  if (!(t > f)) return [];
  const out: Slot[] = [];
  for (let h = Math.floor(f / HOUR) * HOUR; h < t && out.length < MAX_HOURS; h += HOUR) {
    const a = Math.max(h, f), b = Math.min(h + HOUR, t);
    out.push({ label: `${formatDate(iso(a))}, ${formatTime(iso(a))} – ${formatTime(iso(b))}`, from: iso(a), to: iso(b) });
  }
  return out;
}

/** Traffic is drawn in hours for an event or a day, and in quarter-hours for one hour. */
export const bucketFor = (g: Granularity) => (g === 'hour' ? 900 : 3600);

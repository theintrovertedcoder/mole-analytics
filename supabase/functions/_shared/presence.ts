// supabase/functions/_shared/presence.ts
// ─────────────────────────────────────────────────────────────────────────────
// How sensor sessions become the numbers on the dashboard.
// ─────────────────────────────────────────────────────────────────────────────
// There are two copies of this arithmetic and that is deliberate: this one
// runs in the browser for sample data, and `presence_report()` in the
// migration runs in Postgres for real data. A funnel whose two halves disagree
// is worse than no funnel, because someone will believe it — so
// tests/db/run.mjs feeds both the same sessions and fails if any number
// differs. Change one, change the other, and that test tells you if you
// didn't.
//
// The rules, stated once:
//
//   • A session counts if it STARTED inside the window [from, to).
//   • Dwell is the whole session, end minus start, not clipped to the window.
//   • "At the event" is everybody seen by any of the event's sensors — but it
//     is only reported when at least one venue or entrance sensor exists.
//     Without one, the number would be "people near booths" wearing the label
//     "people at the event", and an exhibitor would quote it to their boss.
//   • "Visited" is unique people in the booth(s) in scope: one zone when the
//     view is focused on it, otherwise every booth.
//   • "Stayed" is unique people with at least ONE visit lasting at least the
//     threshold. Two five-minute visits are not a ten-minute stay.
//   • A median, never a mean: one phone left on a charger behind the stand
//     for nine hours would drag a mean into nonsense.
//   • Traffic counts unique people PRESENT at any point in a bucket, so
//     somebody who stayed from 1:50 to 2:10 counts in both hours.
//   • Booth staff are not visitors. A phone whose visits to any ONE booth add
//     up to STAFF_HOURS or more, over the whole event (not just the window, so
//     the same phone is staff whichever hour you look at), is left out of
//     every number, and the report says how many were. Booths only: a visitor
//     can sit in a stage room or the main hall all afternoon.
// ─────────────────────────────────────────────────────────────────────────────

import { STAFF_HOURS } from './contract.ts';
import type {
  PresenceReport, SensorFunnel, TrafficBucket, Zone, ZoneStats,
} from './contract.ts';

export interface PresenceSession {
  zoneId: string;
  visitorKey: string;
  startedAt: string;
  endedAt: string;
}

export interface ReportInput {
  zones: Zone[];
  sessions: PresenceSession[];
  from: string;
  to: string;
  thresholdMinutes: number;
  zoneId: string | null;
  bucketSeconds: number;
}

/** No more buckets than this, whatever the window; the caller widens the bucket. */
export const MAX_BUCKETS = 400;

const ms = (iso: string) => Date.parse(iso);

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  // percentile_cont(0.5): the mean of the middle two when the count is even.
  const m = s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
  return Math.round(m);
}

const dwellSeconds = (s: PresenceSession) => (ms(s.endedAt) - ms(s.startedAt)) / 1000;

function zonesInScope(zones: Zone[], zoneId: string | null): Zone[] {
  if (zoneId) return zones.filter(z => z.id === zoneId);
  return zones.filter(z => z.kind === 'booth');
}

export function sensorFunnel(input: ReportInput): SensorFunnel {
  const { zones, from, to, thresholdMinutes, zoneId } = input;
  const eventZoneIds = new Set(zones.map(z => z.id));
  const f = ms(from), t = ms(to);
  const inWindow = input.sessions.filter(s =>
    eventZoneIds.has(s.zoneId) && ms(s.startedAt) >= f && ms(s.startedAt) < t);

  const hasVenueSensor = zones.some(z => z.kind === 'venue' || z.kind === 'entrance');
  const venue = hasVenueSensor ? new Set(inWindow.map(s => s.visitorKey)).size : null;

  const scope = zonesInScope(zones, zoneId);
  if (scope.length === 0) {
    return { venue, visited: null, stayed: null, medianDwellSeconds: null };
  }
  const scopeIds = new Set(scope.map(z => z.id));
  const scoped = inWindow.filter(s => scopeIds.has(s.zoneId));
  const threshold = thresholdMinutes * 60;

  return {
    venue,
    visited: new Set(scoped.map(s => s.visitorKey)).size,
    stayed: new Set(scoped.filter(s => dwellSeconds(s) >= threshold).map(s => s.visitorKey)).size,
    medianDwellSeconds: median(scoped.map(dwellSeconds)),
  };
}

export function traffic(input: ReportInput): TrafficBucket[] {
  const { zones, from, to, zoneId } = input;
  const f = ms(from), t = ms(to);
  if (!(t > f)) return [];
  const step = Math.max(input.bucketSeconds, Math.ceil((t - f) / 1000 / MAX_BUCKETS)) * 1000;
  const ids = new Set((zoneId ? zones.filter(z => z.id === zoneId) : zones).map(z => z.id));
  const sessions = input.sessions.filter(s => ids.has(s.zoneId));

  const out: TrafficBucket[] = [];
  for (let b = f; b < t; b += step) {
    const e = Math.min(b + step, t);
    const present = new Set<string>();
    for (const s of sessions) {
      if (ms(s.startedAt) < e && ms(s.endedAt) > b) present.add(s.visitorKey);
    }
    out.push({ start: new Date(b).toISOString(), count: present.size });
  }
  return out;
}

export function zoneStats(input: ReportInput): ZoneStats[] {
  const { zones, from, to, thresholdMinutes } = input;
  const f = ms(from), t = ms(to);
  const threshold = thresholdMinutes * 60;
  return zones
    .filter(z => z.kind === 'booth' || z.kind === 'room')
    .map(z => {
      const ss = input.sessions.filter(s =>
        s.zoneId === z.id && ms(s.startedAt) >= f && ms(s.startedAt) < t);
      return {
        zoneId: z.id,
        visitors: new Set(ss.map(s => s.visitorKey)).size,
        stayed: new Set(ss.filter(s => dwellSeconds(s) >= threshold).map(s => s.visitorKey)).size,
        medianDwellSeconds: median(ss.map(dwellSeconds)),
      };
    })
    // Busiest first; ties by visitors, then by id so the order is stable. A plain
    // comparison, not localeCompare: Postgres sorts the same ids with COLLATE "C".
    .sort((a, b) => b.stayed - a.stayed || b.visitors - a.visitors
      || (a.zoneId < b.zoneId ? -1 : a.zoneId > b.zoneId ? 1 : 0));
}

/** Phones that spent STAFF_HOURS or more at one booth across all of the event's sessions. */
export function staffKeys(zones: Zone[], sessions: PresenceSession[]): Set<string> {
  const booths = new Set(zones.filter(z => z.kind === 'booth').map(z => z.id));
  const seconds = new Map<string, number>();
  for (const s of sessions) {
    if (!booths.has(s.zoneId)) continue;
    const k = `${s.visitorKey}\u0000${s.zoneId}`;
    seconds.set(k, (seconds.get(k) ?? 0) + dwellSeconds(s));
  }
  const staff = new Set<string>();
  for (const [k, secs] of seconds) if (secs >= STAFF_HOURS * 3600) staff.add(k.split('\u0000')[0]!);
  return staff;
}

export function presenceReport(all: ReportInput): PresenceReport {
  const staff = staffKeys(all.zones, all.sessions);
  const input = { ...all, sessions: all.sessions.filter(s => !staff.has(s.visitorKey)) };
  const ids = new Set(input.zones.map(z => z.id));
  const f = ms(input.from), t = ms(input.to);
  const inWindow = input.sessions.filter(s =>
    ids.has(s.zoneId) && ms(s.startedAt) >= f && ms(s.startedAt) < t);
  // A loop, not Math.min(...xs): spreading a day of sessions overflows the stack.
  let first = Infinity, last = -Infinity;
  for (const s of inWindow) {
    first = Math.min(first, ms(s.startedAt));
    last = Math.max(last, ms(s.endedAt));
  }
  return {
    funnel: sensorFunnel(input),
    traffic: traffic(input),
    zones: zoneStats(input),
    sessions: inWindow.length,
    firstSeenAt: inWindow.length ? new Date(first).toISOString() : null,
    lastSeenAt: inWindow.length ? new Date(last).toISOString() : null,
    staffLeftOut: staff.size,
  };
}

/** The threshold slider's range, in minutes. Shared so the server can clamp to it. */
export const THRESHOLD_MIN = 1;
export const THRESHOLD_MAX = 30;
export const THRESHOLD_DEFAULT = 3;

export function clampThreshold(n: unknown): number {
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return THRESHOLD_DEFAULT;
  return Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, Math.round(x * 2) / 2));
}

// supabase/functions/_shared/report.ts
// ─────────────────────────────────────────────────────────────────────────────
// One spelling for a report, whichever side made it.
// ─────────────────────────────────────────────────────────────────────────────
// Postgres writes a timestamp as "2026-10-10T10:00:00+00:00" and may send a
// count as a string; JavaScript writes "2026-10-10T10:00:00.000Z". Both are
// right and they are not equal, so everything that leaves the api function,
// and both sides of the parity test, pass through here first.
// ─────────────────────────────────────────────────────────────────────────────

import type { PresenceReport } from './contract.ts';

const iso = (v: unknown): string | null =>
  v == null ? null : new Date(String(v)).toISOString();
const num = (v: unknown): number | null =>
  v == null ? null : Number(v);

export function normaliseReport(raw: any): PresenceReport {
  return {
    funnel: {
      venue: num(raw?.funnel?.venue),
      visited: num(raw?.funnel?.visited),
      stayed: num(raw?.funnel?.stayed),
      medianDwellSeconds: num(raw?.funnel?.medianDwellSeconds),
    },
    traffic: (raw?.traffic ?? []).map((b: any) => ({ start: iso(b.start)!, count: Number(b.count) })),
    zones: (raw?.zones ?? []).map((z: any) => ({
      zoneId: String(z.zoneId),
      visitors: Number(z.visitors),
      stayed: Number(z.stayed),
      medianDwellSeconds: num(z.medianDwellSeconds),
    })),
    sessions: Number(raw?.sessions ?? 0),
    firstSeenAt: iso(raw?.firstSeenAt),
    lastSeenAt: iso(raw?.lastSeenAt),
    staffLeftOut: Number(raw?.staffLeftOut ?? 0),
  };
}

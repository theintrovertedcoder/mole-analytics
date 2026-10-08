// src/data/sample/generate.ts
// ─────────────────────────────────────────────────────────────────────────────
// Made-up sensor sessions with the shape of a real exhibition day.
// ─────────────────────────────────────────────────────────────────────────────
// Used for two things, and both need it to be deterministic:
//
//   • Sample mode in the app. Every number on screen comes from these sessions
//     through the same arithmetic as real data, so the demo cannot show a
//     funnel the real product could not produce. The banner says it is sample
//     data on every page.
//   • tests/db/run.mjs, which feeds the same sessions to Postgres and to
//     presence.ts and requires identical answers.
//
// The day: people arrive in a morning wave and a smaller after-lunch wave,
// stay one to five hours, and wander into a handful of booths. Most booth
// visits are a glance; a few are long. Booth popularity is uneven on purpose,
// because a ranking where every booth is equal tests nothing.
// ─────────────────────────────────────────────────────────────────────────────

import type { Zone } from '../../../supabase/functions/_shared/contract.ts';
import type { PresenceSession } from '../../../supabase/functions/_shared/presence.ts';

/** mulberry32: small, fast, and the same sequence on every machine. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenerateOptions {
  zones: Zone[];
  /** ISO start and end of the day being generated. */
  start: string;
  end: string;
  visitors: number;
  seed: number;
}

const MIN = 60_000;

export function generateSessions(o: GenerateOptions): PresenceSession[] {
  const r = rng(o.seed);
  const t0 = Date.parse(o.start);
  const span = Date.parse(o.end) - t0;
  const venue = o.zones.filter(z => z.kind === 'venue');
  const entrances = o.zones.filter(z => z.kind === 'entrance');
  const booths = o.zones.filter(z => z.kind === 'booth' || z.kind === 'room');
  // Zipf-ish popularity: the first booth gets the most, the tail the least.
  const weights = booths.map((_, i) => 1 / (i + 1.4));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const pickBooth = () => {
    let x = r() * wsum;
    for (let i = 0; i < booths.length; i++) {
      x -= weights[i]!;
      if (x <= 0) return booths[i]!;
    }
    return booths[booths.length - 1]!;
  };
  const iso = (t: number) => new Date(Math.round(t / 1000) * 1000).toISOString();
  const out: PresenceSession[] = [];

  for (let i = 0; i < o.visitors; i++) {
    const key = `s${o.seed}-v${i}`;
    // Two arrival waves: 70% around the first fifth of the day, 30% after lunch.
    const wave = r() < 0.7 ? 0.18 : 0.55;
    const jitter = (r() + r() + r() - 1.5) * 0.14;
    const arrive = t0 + Math.max(0, Math.min(0.85, wave + jitter)) * span;
    const stay = (60 + r() * 240) * MIN;
    const leave = Math.min(t0 + span, arrive + stay);

    for (const e of entrances) {
      if (r() < 0.9) out.push({ zoneId: e.id, visitorKey: key, startedAt: iso(arrive), endedAt: iso(arrive + (1 + r() * 2) * MIN) });
    }
    for (const v of venue) {
      out.push({ zoneId: v.id, visitorKey: key, startedAt: iso(arrive), endedAt: iso(leave) });
    }
    if (booths.length === 0) continue;

    const visits = Math.floor(r() * r() * 7);
    for (let k = 0; k < visits; k++) {
      const booth = pickBooth();
      const from = arrive + r() * Math.max(MIN, leave - arrive - 5 * MIN);
      // Mostly glances; one in five a real conversation.
      const dwell = r() < 0.8 ? (0.3 + r() * 2.5) * MIN : (3 + r() * r() * 22) * MIN;
      out.push({ zoneId: booth.id, visitorKey: key, startedAt: iso(from), endedAt: iso(Math.max(from, Math.min(leave, from + dwell))) });
    }
  }
  return out;
}

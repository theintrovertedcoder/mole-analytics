import { describe, expect, it } from 'vitest';
import {
  clampThreshold, median, presenceReport, sensorFunnel, staffKeys, traffic, zoneStats,
  type PresenceSession, type ReportInput,
} from '../../supabase/functions/_shared/presence.ts';
import type { Zone } from '../../supabase/functions/_shared/contract.ts';

const E = 'event-1';
const venue: Zone = { id: 'z-venue', eventId: E, name: 'Hall', kind: 'venue' };
const boothA: Zone = { id: 'z-a', eventId: E, name: 'Booth A', kind: 'booth' };
const boothB: Zone = { id: 'z-b', eventId: E, name: 'Booth B', kind: 'booth' };

const at = (hhmm: string) => `2026-10-10T${hhmm}:00.000Z`;
const s = (zoneId: string, visitorKey: string, from: string, to: string): PresenceSession =>
  ({ zoneId, visitorKey, startedAt: at(from), endedAt: at(to) });

const base = (over: Partial<ReportInput> = {}): ReportInput => ({
  zones: [venue, boothA, boothB],
  sessions: [],
  from: at('09:00'),
  to: at('18:00'),
  thresholdMinutes: 3,
  zoneId: null,
  bucketSeconds: 3600,
  ...over,
});

describe('sensorFunnel', () => {
  it('two short visits are not one long stay', () => {
    const f = sensorFunnel(base({
      sessions: [s('z-a', 'p1', '10:00', '10:02'), s('z-a', 'p1', '10:30', '10:32')],
    }));
    expect(f.visited).toBe(1);
    expect(f.stayed).toBe(0);
  });

  it('a stay of exactly the threshold counts', () => {
    const f = sensorFunnel(base({ sessions: [s('z-a', 'p1', '10:00', '10:03')] }));
    expect(f.stayed).toBe(1);
  });

  it('counts a session by when it started, and keeps its whole length', () => {
    const f = sensorFunnel(base({
      from: at('10:00'),
      to: at('11:00'),
      sessions: [
        s('z-a', 'early', '09:58', '10:30'), // started before the window: out
        s('z-a', 'late', '10:59', '11:20'),  // started inside: in, all 21 minutes of it
      ],
    }));
    expect(f.visited).toBe(1);
    expect(f.stayed).toBe(1);
    expect(f.medianDwellSeconds).toBe(21 * 60);
  });

  it('will not call booth traffic "people at the event" without a venue sensor', () => {
    const f = sensorFunnel(base({
      zones: [boothA],
      sessions: [s('z-a', 'p1', '10:00', '10:10')],
    }));
    expect(f.venue).toBeNull();
    expect(f.visited).toBe(1);
  });

  it('reports nothing for booths when there is no booth sensor', () => {
    const f = sensorFunnel(base({ zones: [venue], sessions: [s('z-venue', 'p1', '10:00', '11:00')] }));
    expect(f).toEqual({ venue: 1, visited: null, stayed: null, medianDwellSeconds: null });
  });

  it('counts people, not visits, and narrows to one booth when focused', () => {
    const input = base({
      sessions: [
        s('z-venue', 'p1', '09:30', '12:00'),
        s('z-a', 'p1', '10:00', '10:10'),
        s('z-a', 'p1', '11:00', '11:01'),
        s('z-b', 'p2', '10:00', '10:01'),
        s('z-venue', 'p3', '09:30', '09:40'),
      ],
    });
    expect(sensorFunnel(input)).toMatchObject({ venue: 3, visited: 2, stayed: 1 });
    expect(sensorFunnel({ ...input, zoneId: 'z-b' })).toMatchObject({ venue: 3, visited: 1, stayed: 0 });
  });

  it('ignores sessions from zones that are not this event', () => {
    const f = sensorFunnel(base({ sessions: [s('someone-elses-zone', 'p1', '10:00', '11:00')] }));
    expect(f.venue).toBe(0);
  });
});

describe('median', () => {
  it('matches percentile_cont: the mean of the middle two', () => {
    expect(median([60, 120, 180, 600])).toBe(150);
    expect(median([5])).toBe(5);
    expect(median([])).toBeNull();
  });
});

describe('traffic', () => {
  it('counts somebody in every hour they were present', () => {
    const t = traffic(base({
      from: at('13:00'),
      to: at('15:00'),
      sessions: [s('z-a', 'p1', '13:50', '14:10'), s('z-b', 'p2', '14:00', '14:05')],
    }));
    expect(t).toEqual([
      { start: at('13:00'), count: 1 },
      { start: at('14:00'), count: 2 },
    ]);
  });

  it('does not count a session that ended exactly as the bucket began', () => {
    const t = traffic(base({
      from: at('13:00'), to: at('15:00'),
      sessions: [s('z-a', 'p1', '13:30', '14:00')],
    }));
    expect(t.map(b => b.count)).toEqual([1, 0]);
  });

  it('widens the bucket rather than drawing thousands of bars', () => {
    const t = traffic(base({ from: '2026-01-01T00:00:00Z', to: '2027-01-01T00:00:00Z', bucketSeconds: 60 }));
    expect(t.length).toBeLessThanOrEqual(400);
  });
});

describe('zoneStats', () => {
  it('puts the booth people stayed at first, not the one they walked past', () => {
    const z = zoneStats(base({
      sessions: [
        s('z-a', 'p1', '10:00', '10:01'), s('z-a', 'p2', '10:00', '10:01'), s('z-a', 'p3', '10:00', '10:01'),
        s('z-b', 'p4', '10:00', '10:20'),
      ],
    }));
    expect(z.map(x => x.zoneId)).toEqual(['z-b', 'z-a']);
    expect(z[0]).toMatchObject({ visitors: 1, stayed: 1 });
  });
});

describe('presenceReport', () => {
  it('reports the span of what it counted', () => {
    const r = presenceReport(base({ sessions: [s('z-a', 'p1', '10:00', '10:30'), s('z-b', 'p2', '11:00', '11:05')] }));
    expect(r.sessions).toBe(2);
    expect(r.firstSeenAt).toBe(at('10:00'));
    expect(r.lastSeenAt).toBe(at('11:05'));
  });
});

describe('booth staff (W-9)', () => {
  const room: Zone = { id: 'z-room', eventId: E, name: 'Stage', kind: 'room' };
  const zones = [venue, boothA, boothB, room];

  it('a phone at one booth for 3 hours, in stretches, is staff; 2h59 is not', () => {
    const k = staffKeys(zones, [
      s('z-a', 'staff', '09:00', '10:30'), s('z-a', 'staff', '12:00', '13:30'),
      s('z-a', 'nearly', '09:00', '11:59'),
    ]);
    expect([...k]).toEqual(['staff']);
  });

  it('time is counted per booth, and rooms and the hall never make anyone staff', () => {
    const k = staffKeys(zones, [
      s('z-a', 'roamer', '09:00', '11:00'), s('z-b', 'roamer', '12:00', '14:00'),
      s('z-room', 'audience', '09:00', '15:00'), s('z-venue', 'all-day', '09:00', '18:00'),
    ]);
    expect(k.size).toBe(0);
  });

  it('staff are left out of every number, whatever the window, and counted', () => {
    const sessions = [
      s('z-venue', 'staff', '09:00', '18:00'), s('z-a', 'staff', '09:00', '13:00'), s('z-b', 'staff', '14:00', '14:20'),
      s('z-venue', 'guest', '10:00', '12:00'), s('z-b', 'guest', '10:00', '10:20'),
    ];
    // An afternoon window: the staff phone's booth time was all in the morning.
    const r = presenceReport(base({ zones, sessions, from: at('14:00'), to: at('18:00') }));
    expect(r.staffLeftOut).toBe(1);
    expect(r.funnel.visited).toBe(0);
    expect(r.zones.find(z => z.zoneId === 'z-b')!.visitors).toBe(0);
    const day = presenceReport(base({ zones, sessions }));
    expect(day.funnel).toMatchObject({ venue: 1, visited: 1, stayed: 1 });
    expect(Math.max(...day.traffic.map(b => b.count))).toBe(1);
  });
});

describe('clampThreshold', () => {
  it('keeps the slider honest whatever the URL says', () => {
    expect(clampThreshold('abc')).toBe(3);
    expect(clampThreshold(0)).toBe(1);
    expect(clampThreshold(999)).toBe(30);
    expect(clampThreshold(2.3)).toBe(2.5);
  });
});

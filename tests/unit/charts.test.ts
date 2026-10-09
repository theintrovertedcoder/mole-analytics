import { describe, expect, it } from 'vitest';
import type { EventOutcomes, PresenceReport } from '../../supabase/functions/_shared/contract.ts';
import { monotonePath } from '../../src/domain/curve.ts';
import { buildStages } from '../../src/domain/funnel.ts';
import { MAX_THICKNESS, measuredRun, MIN_THICKNESS, ribbon, thicknesses } from '../../src/domain/ribbon.ts';
import { busiestSlots } from '../../src/domain/staffing.ts';
import { eventDays, eventHours } from '../../src/domain/windows.ts';
import { event } from './fakes.ts';

describe('the funnel ribbon', () => {
  it('flows only through stages that have a number', () => {
    expect(measuredRun([null, 206, 72, 61])).toEqual([1, 3]);
    expect(measuredRun([1400, 799, 294, null])).toEqual([0, 2]);
    expect(measuredRun([null, null])).toBeNull();
    expect(ribbon([null, null, null], 'h')).toBeNull();
  });

  it('is thickest at the biggest stage, and never vanishes or touches the edge', () => {
    const t = thicknesses([1400, 799, 294, 0]);
    expect(t[0]).toBe(MAX_THICKNESS);
    expect(t[3]).toBe(MIN_THICKNESS);
    expect(t[1]!).toBeGreaterThan(t[2]!);
  });

  it('starts at the first measured stage, not at the edge of the board', () => {
    const r = ribbon([null, 206, 72, 61], 'h')!;
    expect(r.path.startsWith('M 100 ')).toBe(true); // slot 1 starts at x = 100
    expect(r.path.trim().endsWith('Z')).toBe(true);
    const v = ribbon([null, 206, 72, 61], 'v')!;
    expect(v.path).toMatch(/^M [\d.]+ 100 /); // and at y = 100 going down
  });
});

describe('the traffic curve', () => {
  // Points along each cubic segment, to check where the drawn line actually goes.
  function sample(d: string): number[] {
    const nums = d.replace(/[MC]/g, ' ').trim().split(/[\s,]+/).map(Number);
    const ys: number[] = [];
    let y0 = nums[1]!;
    for (let i = 2; i + 5 < nums.length + 1; i += 6) {
      const [, y1, , y2, , y3] = nums.slice(i, i + 6) as number[];
      for (let t = 0; t <= 1; t += 0.05) {
        const u = 1 - t;
        ys.push(u * u * u * y0 + 3 * u * u * t * y1! + 3 * u * t * t * y2! + t * t * t * y3!);
      }
      y0 = y3!;
    }
    return ys;
  }

  it('never draws above a peak or below zero', () => {
    // SVG y grows downward: 200 is the zero line, 20 is the peak.
    const pts = [200, 200, 20, 190, 200, 200, 120].map((y, i) => ({ x: i * 50, y }));
    const ys = sample(monotonePath(pts));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(20 - 1e-6);
    expect(Math.max(...ys)).toBeLessThanOrEqual(200 + 1e-6);
  });

  it('passes through every point', () => {
    const d = monotonePath([{ x: 0, y: 10 }, { x: 10, y: 30 }, { x: 20, y: 5 }]);
    expect(d).toContain('10,30');
    expect(d.endsWith('20,5')).toBe(true);
  });
});

describe('Event / Day / Hour', () => {
  it('splits a two-day event at midnight in Kuala Lumpur, not UTC', () => {
    // 10am on the 3rd to 1pm on the 4th, Malaysia time.
    const days = eventDays('2026-10-03T02:00:00.000Z', '2026-10-04T05:00:00.000Z');
    expect(days).toHaveLength(2);
    expect(days[0]!.to).toBe('2026-10-03T16:00:00.000Z'); // midnight MYT
    expect(days[1]!.from).toBe('2026-10-03T16:00:00.000Z');
    expect(days[1]!.to).toBe('2026-10-04T05:00:00.000Z');
  });

  it('lists the hours of the event, clipped to its start and end', () => {
    const hours = eventHours('2026-10-03T01:30:00.000Z', '2026-10-03T04:00:00.000Z');
    expect(hours.map(h => h.from)).toEqual(['2026-10-03T01:30:00.000Z', '2026-10-03T02:00:00.000Z', '2026-10-03T03:00:00.000Z']);
    expect(hours[0]!.label).toMatch(/9:30\s?am – 10:00\s?am/i);
  });
});

describe('staffing', () => {
  it('names the busiest times, busiest first, and never an empty one', () => {
    const t = [
      { start: '2026-10-03T01:00:00.000Z', count: 10 },
      { start: '2026-10-03T02:00:00.000Z', count: 90 },
      { start: '2026-10-03T03:00:00.000Z', count: 0 },
      { start: '2026-10-03T04:00:00.000Z', count: 40 },
    ];
    expect(busiestSlots(t).map(b => b.count)).toEqual([90, 40, 10]);
    expect(busiestSlots(t)[0]!.end).toBe('2026-10-03T03:00:00.000Z');
  });
});

describe('the goal stage', () => {
  const report: PresenceReport = {
    funnel: { venue: 1400, visited: 799, stayed: 294, medianDwellSeconds: 113 },
    traffic: [], zones: [], sessions: 1, firstSeenAt: null, lastSeenAt: null, staffLeftOut: 0,
  };
  const outcomes: EventOutcomes = { signups: 623, arrived: 411, teamContacts: 46, arrivalsByHour: [], window: null };

  it("ends an organiser's funnel with the connections their team made", () => {
    const s = buildStages({ event: event({ id: 'e', orgId: 'o' }), report, outcomes, focus: null, thresholdMinutes: 3 });
    expect(s.map(x => x.key)).toEqual(['venue', 'visited', 'stayed', 'connections']);
    expect(s[3]).toMatchObject({ value: 46, source: 'mole', of: null });
  });

  it('does not put an event-wide Mole number beside one hour of visits', () => {
    const s = buildStages({ event: event({ id: 'e', orgId: 'o' }), report, outcomes, focus: null, thresholdMinutes: 3, wholeEvent: false });
    expect(s[3]!.value).toBeNull();
    expect(s[3]!.missing).toMatch(/whole event/);
  });

  it('has a meaning and a method for every stage, for the details sheet', () => {
    const s = buildStages({ event: event({ id: 'e', orgId: 'o', package: 'EXHIBITOR' }), report, outcomes, focus: null, thresholdMinutes: 3 });
    for (const x of s) {
      expect(x.meaning.length).toBeGreaterThan(20);
      expect(x.how.length).toBeGreaterThan(20);
    }
  });
});

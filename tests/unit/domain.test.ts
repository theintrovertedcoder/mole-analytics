import { describe, expect, it } from 'vitest';
import type { EventOutcomes, PresenceReport, Zone } from '../../supabase/functions/_shared/contract.ts';
import { formatDuration, formatPercent } from '../../src/domain/format.ts';
import { buildStages, staffNote } from '../../src/domain/funnel.ts';
import { busiestHour, checkInsVsDetected, insights, stayRate, topZone } from '../../src/domain/insights.ts';
import { event } from './fakes.ts';

const report = (over: Partial<PresenceReport> = {}): PresenceReport => ({
  funnel: { venue: 1000, visited: 400, stayed: 120, medianDwellSeconds: 150 },
  traffic: [
    { start: '2026-10-10T01:00:00.000Z', count: 100 },
    { start: '2026-10-10T02:00:00.000Z', count: 300 },
    { start: '2026-10-10T03:00:00.000Z', count: 200 },
  ],
  zones: [
    { zoneId: 'a', visitors: 200, stayed: 80, medianDwellSeconds: 200 },
    { zoneId: 'b', visitors: 250, stayed: 40, medianDwellSeconds: 90 },
  ],
  sessions: 2000,
  firstSeenAt: '2026-10-10T01:00:00.000Z',
  lastSeenAt: '2026-10-10T04:00:00.000Z',
  staffLeftOut: 0,
  ...over,
});
const outcomes: EventOutcomes = { signups: 70, arrived: 300, teamContacts: 12, arrivalsByHour: [], window: null };
const zones: Zone[] = [
  { id: 'a', eventId: 'e', name: 'Booth A12', kind: 'booth' },
  { id: 'b', eventId: 'e', name: 'Booth B04', kind: 'booth' },
];
const host = event({ id: 'e', orgId: 'o' });
const stand = event({ id: 'e', orgId: 'o', package: 'EXHIBITOR' });

describe('buildStages', () => {
  it('shows a step with no sensor as not measured, never as zero, and gives the next step no rate', () => {
    const s = buildStages({ event: host, report: report({ funnel: { venue: null, visited: 400, stayed: 120, medianDwellSeconds: 1 } }), outcomes, focus: null, thresholdMinutes: 3 });
    expect(s[0]).toMatchObject({ value: null });
    expect(s[0]!.missing).toMatch(/venue or entrance sensor/);
    expect(s[1]).toMatchObject({ value: 400, of: null });
    expect(s[2]).toMatchObject({ value: 120, of: 400 });
  });

  it("puts an exhibitor's leads at the bottom, from Mole, with no rate", () => {
    const s = buildStages({ event: stand, report: report(), outcomes, focus: null, thresholdMinutes: 3 });
    expect(s.map(x => x.label)).toEqual(['At the event', 'Came to your stand', 'Stayed 3 min or more', 'Left their details']);
    expect(s[3]).toMatchObject({ value: 70, of: null, source: 'mole' });
  });

  it("does not put event-wide sign-ups under one organiser's booth", () => {
    const s = buildStages({ event: host, report: report(), outcomes, focus: zones[0]!, thresholdMinutes: 2.5 });
    expect(s.map(x => x.key)).toEqual(['venue', 'visited', 'stayed']);
    expect(s[1]!.label).toBe('Came to Booth A12');
    expect(s[2]!.label).toBe('Stayed 2.5 min or more');
  });
});

describe('insights', () => {
  it('names the busiest hour only when there is a day to compare', () => {
    expect(busiestHour(report())!.text).toMatch(/with 300 people/);
    expect(busiestHour(report({ traffic: report().traffic.slice(0, 2) }))).toBeNull();
    expect(busiestHour(report({ traffic: report().traffic.map(b => ({ ...b, count: 3 })) }))).toBeNull();
  });

  it('says nothing about a stay rate from a handful of people', () => {
    expect(stayRate(report(), 3, 'booths')!.text).toBe('30% of the people who came to booths stayed 3 min or more.');
    expect(stayRate(report({ funnel: { venue: 10, visited: 12, stayed: 6, medianDwellSeconds: 1 } }), 3, 'booths')).toBeNull();
  });

  it('ranks booths by who stayed, and compares with the next one', () => {
    expect(topZone(report(), zones)!.text).toBe('Booth A12 kept the most people: 80 stayed. That is 2.0× the next one.');
    expect(topZone(report({ zones: report().zones.slice(0, 1) }), zones)).toBeNull();
  });

  it('compares check-ins with the sensors only for an organiser', () => {
    expect(checkInsVsDetected(report(), outcomes, host)!.text).toMatch(/300 people checked in.*1,000.*30%/);
    expect(checkInsVsDetected(report(), outcomes, stand)).toBeNull();
  });

  it('a quiet event gets no insights rather than invented ones', () => {
    const quiet = report({
      funnel: { venue: 8, visited: 3, stayed: 1, medianDwellSeconds: 60 },
      traffic: [{ start: '2026-10-10T01:00:00.000Z', count: 8 }],
      zones: [{ zoneId: 'a', visitors: 3, stayed: 1, medianDwellSeconds: 60 }],
    });
    expect(insights({ report: quiet, outcomes: { ...outcomes, arrived: 0 }, event: host, zones, focus: null, thresholdMinutes: 3 })).toEqual([]);
  });
});

describe('format', () => {
  it('writes durations the way people say them', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(150)).toBe('2 min 30 s');
    expect(formatDuration(3600 + 120)).toBe('1 h 2 min');
    expect(formatDuration(null)).toBe('—');
  });
  it('never divides by zero', () => {
    expect(formatPercent(3, 0)).toBeNull();
    expect(formatPercent(1, 300)).toBe('0.3%');
  });
});

describe('the event clock', () => {
  it("shows a Kuala Lumpur event in Kuala Lumpur time, whatever the viewer's computer says", async () => {
    const { formatEventWhen, formatHour } = await import('../../src/domain/format.ts');
    expect(formatEventWhen('2026-10-03T01:00:00.000Z', '2026-10-03T10:00:00.000Z')).toMatch(/9:00\s?am – 6:00\s?pm/i);
    expect(formatHour('2026-10-03T05:00:00.000Z')).toBe('1pm');
  });
});

describe('the staff note', () => {
  it('counts in words that read right for one and for many', () => {
    expect(staffNote(1)).toBe('1 phone that spent 3 hours or more at one booth was left out as booth staff.');
    expect(staffNote(1200)).toBe('1,200 phones that spent 3 hours or more at one booth were left out as booth staff.');
  });
});

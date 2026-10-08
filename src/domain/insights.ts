// src/domain/insights.ts
// ─────────────────────────────────────────────────────────────────────────────
// Sentences the data can back up, and nothing else.
// ─────────────────────────────────────────────────────────────────────────────
// The prototype's insights were fixed text with a number dropped in: "trending
// upwards compared to yesterday (+4.2%)" whatever the data said. Each insight
// here is computed, and each returns null below the point where it would be
// noise — twelve people do not have a busiest hour. Showing two true
// sentences beats showing four with two invented.
// ─────────────────────────────────────────────────────────────────────────────

import type { EventOutcomes, MoleEvent, PresenceReport, Zone } from '../../supabase/functions/_shared/contract.ts';
import { formatCount, formatHour, formatMinutes, formatPercent } from './format.ts';

export interface Insight {
  key: string;
  text: string;
}

export const MIN_PEOPLE = 20;

export function busiestHour(report: PresenceReport): Insight | null {
  const buckets = report.traffic.filter(b => b.count > 0);
  if (buckets.length < 3) return null;
  const top = buckets.reduce((a, b) => (b.count > a.count ? b : a));
  if (top.count < MIN_PEOPLE) return null;
  const i = report.traffic.indexOf(top);
  const next = report.traffic[i + 1]?.start;
  const span = next ? `${formatHour(top.start)}–${formatHour(next)}` : `from ${formatHour(top.start)}`;
  return { key: 'busiest', text: `Busiest: ${span}, with ${formatCount(top.count)} people there at some point.` };
}

export function stayRate(report: PresenceReport, thresholdMinutes: number, place: string): Insight | null {
  const { visited, stayed } = report.funnel;
  if (visited == null || stayed == null || visited < MIN_PEOPLE) return null;
  return {
    key: 'stay',
    text: `${formatPercent(stayed, visited)} of the people who came to ${place} stayed ${formatMinutes(thresholdMinutes)} or more.`,
  };
}

export function topZone(report: PresenceReport, zones: Zone[]): Insight | null {
  const ranked = report.zones.filter(z => z.visitors > 0);
  if (ranked.length < 2 || ranked[0]!.stayed < 5) return null;
  const [a, b] = ranked;
  const name = zones.find(z => z.id === a!.zoneId)?.name;
  if (!name) return null;
  const lead = b && b.stayed > 0 ? ` That is ${(a!.stayed / b.stayed).toFixed(1)}× the next one.` : '';
  return { key: 'top', text: `${name} kept the most people: ${formatCount(a!.stayed)} stayed.${lead}` };
}

export function checkInsVsDetected(report: PresenceReport, outcomes: EventOutcomes | null, event: MoleEvent): Insight | null {
  if (event.package !== 'HOST' || !outcomes || report.funnel.venue == null) return null;
  if (report.funnel.venue < MIN_PEOPLE || outcomes.arrived < 1) return null;
  return {
    key: 'checkins',
    text: `${formatCount(outcomes.arrived)} people checked in with Mole; the sensors counted ${formatCount(report.funnel.venue)} at the event `
      + `(check-ins are ${formatPercent(outcomes.arrived, report.funnel.venue)} of that).`,
  };
}

export function insights(input: {
  report: PresenceReport;
  outcomes: EventOutcomes | null;
  event: MoleEvent;
  zones: Zone[];
  focus: Zone | null;
  thresholdMinutes: number;
}): Insight[] {
  const place = input.focus ? input.focus.name : input.event.package === 'EXHIBITOR' ? 'your stand' : 'booths';
  return [
    busiestHour(input.report),
    stayRate(input.report, input.thresholdMinutes, place),
    input.focus ? null : topZone(input.report, input.zones),
    input.focus ? null : checkInsVsDetected(input.report, input.outcomes, input.event),
  ].filter((x): x is Insight => x !== null);
}

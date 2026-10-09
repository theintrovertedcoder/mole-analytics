// src/domain/funnel.ts
// ─────────────────────────────────────────────────────────────────────────────
// The funnel as a person reads it: steps, labels, and what each step is out of.
// ─────────────────────────────────────────────────────────────────────────────
// The numbers come from the report (sensors) and from Mole (outcomes). This
// file only decides what each step is called, what it means, and what it is
// compared with. The rules are the ones the prototype could not keep:
//
//   • A step with no sensor behind it is shown as "not measured", with the one
//     thing that would measure it — never as a zero, and never left out
//     silently, because a missing step makes the next one look like the top.
//   • A rate is "of the step before", and only between two sensor steps. The
//     Mole step at the end (the goal) is a different kind of count (people
//     sign up online too), so it carries no rate rather than a rate over 100%.
//   • Mole counts its goal step for the whole event. Narrowed to one day or
//     one hour, that step says so instead of showing an event-wide number
//     beside an hour's worth of visits.
//   • The labels say whose view this is. An exhibitor's "came to your stand"
//     is the organiser's "visited a booth".
// ─────────────────────────────────────────────────────────────────────────────

import { STAFF_HOURS } from '../../supabase/functions/_shared/contract.ts';
import type { EventOutcomes, MoleEvent, PresenceReport, Zone } from '../../supabase/functions/_shared/contract.ts';
import { formatMinutes } from './format.ts';

export type StageKey = 'venue' | 'visited' | 'stayed' | 'details' | 'connections';

export interface Stage {
  key: StageKey;
  label: string;
  value: number | null;
  /** What it is out of: the previous measured sensor step. */
  of: number | null;
  /** Why there is no number, and what would give one. */
  missing: string | null;
  source: 'sensors' | 'mole';
  /** What the number means, for the details sheet. */
  meaning: string;
  /** One sentence on how it is counted. */
  how: string;
}

export interface FunnelInput {
  event: MoleEvent;
  report: PresenceReport;
  outcomes: EventOutcomes | null;
  /** The zone the view is narrowed to, or null for the whole event. */
  focus: Zone | null;
  thresholdMinutes: number;
  /** False when the view is one day or one hour rather than the whole event. */
  wholeEvent?: boolean;
}

export function buildStages({ event, report, outcomes, focus, thresholdMinutes, wholeEvent = true }: FunnelInput): Stage[] {
  const f = report.funnel;
  const exhibitor = event.package === 'EXHIBITOR';
  const place = focus ? focus.name : exhibitor ? 'your stand' : 'a booth';
  const t = formatMinutes(thresholdMinutes);

  const stages: Stage[] = [
    {
      key: 'venue',
      label: 'At the event',
      value: f.venue,
      of: null,
      missing: f.venue == null ? 'Add a venue or entrance sensor to count everyone who came.' : null,
      source: 'sensors',
      meaning: 'Everyone who was at the event in this time, whether or not they came near a booth.',
      how: `Unique phones seen by any of this event’s sensors. One phone is one person for the whole event. A phone at one booth for ${STAFF_HOURS} hours or more is that booth’s staff, and is left out of every step.`,
    },
    {
      key: 'visited',
      label: focus ? `Came to ${place}` : exhibitor ? 'Came to your stand' : 'Visited a booth',
      value: f.visited,
      of: f.venue,
      missing: f.visited == null ? (focus ? 'This zone has no sensor yet.' : 'Add a booth sensor to see who stopped by.') : null,
      source: 'sensors',
      meaning: focus || exhibitor
        ? `People who came into ${place}, even for a moment.`
        : 'People who came into at least one booth, even for a moment.',
      how: focus || exhibitor
        ? `Unique people seen by the sensor at ${place}.`
        : 'Unique people seen at any booth. Someone who visited three booths counts once.',
    },
    {
      key: 'stayed',
      label: `Stayed ${t} or more`,
      value: f.stayed,
      of: f.visited,
      missing: f.stayed == null ? 'Needs a booth sensor.' : null,
      source: 'sensors',
      meaning: `People who stopped long enough to be interested: one visit of ${t} or longer. Move the “stayed” slider to change what counts.`,
      how: `People with at least one visit of ${t} or longer. Two short visits are not one long one.`,
    },
  ];

  // The goal step, from Mole. An exhibitor's goal is leads; an organiser's is
  // the connections their own team made. Never under one booth of an
  // organiser's event: Mole cannot say which booth a contact came from.
  if (outcomes && !focus) {
    const eventOnly = 'Mole counts this for the whole event. Switch to Event to see it.';
    if (exhibitor) {
      stages.push({
        key: 'details',
        label: 'Left their details',
        value: wholeEvent ? outcomes.signups : null,
        of: null,
        missing: wholeEvent ? null : eventOnly,
        source: 'mole',
        meaning: 'Leads: people who gave you their details on your Mole stand page.',
        how: 'Sign-ups on your Mole stand page, before or during the event. Not a share of the step above: some sign up without visiting.',
      });
    } else if (outcomes.teamContacts != null) {
      stages.push({
        key: 'connections',
        label: 'Connections made',
        value: wholeEvent ? outcomes.teamContacts : null,
        of: null,
        missing: wholeEvent ? null : eventOnly,
        source: 'mole',
        meaning: 'Contacts your team saved in Mole during the event: the conversations that turned into a connection.',
        how: 'Contacts saved in Mole by your organisation’s members between the event’s start and end. Not a share of the step above.',
      });
    }
  }
  return stages.map(s => ({ ...s, of: s.value == null ? null : s.of }));
}

/** The line under the funnel that says how many phones were left out as staff (W-9). */
export function staffNote(n: number): string {
  return n === 1
    ? `1 phone that spent ${STAFF_HOURS} hours or more at one booth was left out as booth staff.`
    : `${n.toLocaleString('en-GB')} phones that spent ${STAFF_HOURS} hours or more at one booth were left out as booth staff.`;
}

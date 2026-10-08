// src/domain/funnel.ts
// ─────────────────────────────────────────────────────────────────────────────
// The funnel as a person reads it: steps, labels, and what each step is out of.
// ─────────────────────────────────────────────────────────────────────────────
// The numbers come from the report (sensors) and from Mole (outcomes). This
// file only decides what each step is called and what it is compared with,
// and the rules are the ones the prototype could not keep:
//
//   • A step with no sensor behind it is shown as "not measured", with the one
//     thing that would measure it — never as a zero, and never left out
//     silently, because a missing step makes the next one look like the top.
//   • A rate is "of the step before", and only between two sensor steps. The
//     Mole step is a different kind of count (people sign up online too), so
//     it carries no rate rather than a rate over 100%.
//   • The labels say whose view this is. An exhibitor's "came to your stand"
//     is the organiser's "visited a booth".
// ─────────────────────────────────────────────────────────────────────────────

import type { EventOutcomes, MoleEvent, PresenceReport, Zone } from '../../supabase/functions/_shared/contract.ts';
import { formatMinutes } from './format.ts';

export interface Stage {
  key: 'venue' | 'visited' | 'stayed' | 'details';
  label: string;
  value: number | null;
  /** What it is out of: the previous measured sensor step. */
  of: number | null;
  /** Why there is no number, and what would give one. */
  missing: string | null;
  source: 'sensors' | 'mole';
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
}

export function buildStages({ event, report, outcomes, focus, thresholdMinutes }: FunnelInput): Stage[] {
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
      how: 'Unique phones seen by any of this event’s sensors. One phone is one person for the whole event.',
    },
    {
      key: 'visited',
      label: focus ? `Came to ${place}` : exhibitor ? 'Came to your stand' : 'Visited a booth',
      value: f.visited,
      of: f.venue,
      missing: f.visited == null ? (focus ? 'This zone has no sensor yet.' : 'Add a booth sensor to see who stopped by.') : null,
      source: 'sensors',
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
      how: `People with at least one visit of ${t} or longer. Two short visits are not one long one.`,
    },
  ];

  // An exhibitor's own leads are the step their boss asks about. For an
  // organiser, Mole's sign-ups are about the whole event and sit beside the
  // funnel (Outcomes), not at the bottom of it.
  if (exhibitor && !focus && outcomes) {
    stages.push({
      key: 'details',
      label: 'Left their details',
      value: outcomes.signups,
      of: null,
      missing: null,
      source: 'mole',
      how: 'People who signed up on your Mole stand page, before or during the event. Not a share of the step above: some sign up without visiting.',
    });
  }
  return stages.map(s => ({ ...s, of: s.value == null ? null : s.of }));
}

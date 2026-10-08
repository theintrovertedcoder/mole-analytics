// What each kind of zone is called, and which numbers it feeds — said next to
// the choice, because the kind is what decides the funnel step.

import type { ZoneKind } from '../../supabase/functions/_shared/contract.ts';

export const KIND_TEXT: Record<ZoneKind, { name: string; feeds: string }> = {
  venue: { name: 'Venue', feeds: 'Counts everyone at the event (“At the event”).' },
  entrance: { name: 'Entrance', feeds: 'Also counts toward “At the event”, and shows when people arrive.' },
  booth: { name: 'Booth or stand', feeds: 'Feeds “Visited” and “Stayed”, and the booth ranking.' },
  room: { name: 'Room or stage', feeds: 'Ranked with the booths; not part of the booth funnel.' },
};

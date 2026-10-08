// Every event this person may see numbers for, from Mole: the ones their
// org runs, and the stands it has at other people's events.

import { CalendarDays, ChevronRight, MapPin } from 'lucide-react';
import type { MoleEvent } from '../../supabase/functions/_shared/contract.ts';
import type { Backend } from '../data/backend.ts';
import { formatEventWhen } from '../domain/format.ts';
import { Link } from '../lib/Link.tsx';
import { useAsync } from '../lib/useAsync.ts';
import { EmptyState, ErrorNote, Pill, Spinner } from '../ui/kit.tsx';

function EventRow({ e }: { e: MoleEvent }) {
  return (
    <li>
      <Link
        to={`/events/${e.id}`}
        className="group flex items-center gap-4 rounded-panel border border-line bg-surface p-4 transition-colors hover:border-purple-border hover:bg-surface-2"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-chip bg-events-tint text-events-text">
          <CalendarDays className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{e.title}</span>
            {!e.isPublished && <Pill tone="neutral">Draft</Pill>}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-fg-muted">
            <span>{formatEventWhen(e.startsAt, e.endsAt)}</span>
            {e.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden />{e.venue}</span>}
            {e.package === 'EXHIBITOR' && e.hostName && <span>at {e.hostName}</span>}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}

export function EventsPage({ backend }: { backend: Backend }) {
  const events = useAsync(() => backend.myEvents(), [backend]);

  if (events.status === 'loading' && !events.data) return <Spinner label="Loading your events" />;
  if (events.status === 'error') return <ErrorNote error={events.error} onRetry={events.reload} />;
  const list = events.data ?? [];

  if (list.length === 0) {
    return (
      <EmptyState icon={<CalendarDays className="h-6 w-6" />} title="No events yet">
        Events come from Mole. Create one in your Loop dashboard (Events), or ask the owner of your organisation to make you
        an admin or an editor of theirs. It will appear here.
      </EmptyState>
    );
  }

  const hosting = list.filter(e => e.package === 'HOST');
  const stands = list.filter(e => e.package === 'EXHIBITOR');
  const section = (title: string, blurb: string, items: MoleEvent[]) =>
    items.length > 0 && (
      <section className="mb-10">
        <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
        <p className="mb-4 mt-1 text-sm text-fg-muted">{blurb}</p>
        <ul className="space-y-3">{items.map(e => <EventRow key={e.id} e={e} />)}</ul>
      </section>
    );

  return (
    <div>
      <h1 className="mb-8 text-[28px] font-black tracking-tight text-ink">Your events</h1>
      {section('Events you run', 'The whole floor: who came, which booths drew people, and when it was busy.', hosting)}
      {section('Your stands at other events', 'Your stand on its own: who walked up, who stayed, who left their details.', stands)}
    </div>
  );
}

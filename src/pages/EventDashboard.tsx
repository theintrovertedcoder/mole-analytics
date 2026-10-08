// One event's numbers: the funnel, people over time, booths ranked, and what
// Mole recorded beside them. The view and the threshold live in the URL, so a
// link to "Booth A12, 5 minutes" opens exactly that.

import { ArrowLeft, Lightbulb, MapPin, Settings2, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';
import type { EventOutcomes, MoleEvent, Zone } from '../../supabase/functions/_shared/contract.ts';
import { clampThreshold, THRESHOLD_DEFAULT, THRESHOLD_MAX, THRESHOLD_MIN } from '../../supabase/functions/_shared/presence.ts';
import type { Backend } from '../data/backend.ts';
import { formatCount, formatEventWhen, formatMinutes, formatTime } from '../domain/format.ts';
import { buildStages } from '../domain/funnel.ts';
import { insights } from '../domain/insights.ts';
import { Link } from '../lib/Link.tsx';
import { useAsync } from '../lib/useAsync.ts';
import { FunnelChart } from '../ui/FunnelChart.tsx';
import { Card, EmptyState, ErrorNote, Eyebrow, Pill, Spinner } from '../ui/kit.tsx';
import { buttonClass, inputClass } from '../ui/styles.ts';
import { TrafficChart } from '../ui/TrafficChart.tsx';
import { ZoneTable } from '../ui/ZoneTable.tsx';

function readParams() {
  const p = new URLSearchParams(window.location.search);
  return { zone: p.get('zone'), threshold: p.has('t') ? clampThreshold(p.get('t')) : THRESHOLD_DEFAULT };
}
function writeParams(zone: string | null, threshold: number) {
  const p = new URLSearchParams();
  if (zone) p.set('zone', zone);
  if (threshold !== THRESHOLD_DEFAULT) p.set('t', String(threshold));
  const qs = p.toString();
  history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

function Outcomes({ outcomes, event }: { outcomes: EventOutcomes | null; event: MoleEvent }) {
  if (!outcomes) return null;
  const exhibitor = event.package === 'EXHIBITOR';
  const rows: [string, number | null, string][] = [
    [exhibitor ? 'Signed up at your stand' : 'Registered', outcomes.signups, exhibitor ? 'On your Mole stand page, before or during the event.' : 'Everyone on the guest list, whether or not they came.'],
    [exhibitor ? 'Scanned in at the stand' : 'Checked in', outcomes.arrived, 'Arrivals recorded in Mole.'],
    ['Connections your team saved', outcomes.teamContacts, outcomes.teamContacts == null ? 'Needs an event date in Mole.' : 'Contacts your organisation’s members saved in Mole during the event.'],
  ];
  return (
    <Card>
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-events-text" aria-hidden />
        <h2 className="font-extrabold tracking-tight text-ink">From Mole</h2>
      </div>
      <dl className="space-y-4">
        {rows.map(([label, value, note]) => (
          <div key={label}>
            <dt className="text-xs font-semibold text-fg-muted">{label}</dt>
            <dd className="text-2xl font-extrabold tabular-nums tracking-tight text-ink">{value == null ? '—' : formatCount(value)}</dd>
            <dd className="text-xs text-fg-subtle">{note}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function EventDashboard({ backend, eventId }: { backend: Backend; eventId: string }) {
  const [initial] = useState(readParams);
  const [zoneId, setZoneId] = useState<string | null>(initial.zone);
  const [threshold, setThreshold] = useState(initial.threshold);
  // The slider moves `draft`; the query only follows when the thumb is let go,
  // so dragging is one request and not forty.
  const [draft, setDraft] = useState(initial.threshold);

  const base = useAsync(async () => {
    const [event, zones, outcomes] = await Promise.all([backend.event(eventId), backend.zones(eventId), backend.outcomes(eventId)]);
    return { event, zones, outcomes };
  }, [backend, eventId]);

  const zonesReady = base.status === 'ready' && base.data.zones.length > 0;
  const presence = useAsync(
    () => (zonesReady ? backend.presence(eventId, { zoneId, thresholdMinutes: threshold }) : Promise.resolve(null)),
    [backend, eventId, zoneId, threshold, zonesReady],
  );

  if (base.status === 'loading' && !base.data) return <Spinner label="Loading the event" />;
  if (base.status === 'error') return <ErrorNote error={base.error} onRetry={base.reload} />;
  const { event, zones, outcomes } = base.data!;
  if (!event) {
    return (
      <EmptyState icon={<MapPin className="h-6 w-6" />} title="This event isn’t yours to see" action={<Link to="/" className="font-semibold text-purple-text underline">Back to your events</Link>}>
        Either it doesn’t exist, or you aren’t an admin of its organisation or an editor of the event in Mole.
      </EmptyState>
    );
  }

  const focus: Zone | null = zones.find(z => z.id === zoneId) ?? null;
  const exhibitor = event.package === 'EXHIBITOR';
  const setZone = (z: string | null) => { setZoneId(z); writeParams(z, threshold); };
  const commitThreshold = () => { if (draft !== threshold) { setThreshold(draft); writeParams(zoneId, draft); } };

  return (
    <div>
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-fg-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Your events
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {exhibitor ? <Pill tone="events">Your stand</Pill> : <Pill tone="purple">Your event</Pill>}
            <span className="text-xs text-fg-muted">{event.orgName}</span>
          </div>
          <h1 className="text-[28px] font-black leading-tight tracking-tight text-ink">{event.title}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {formatEventWhen(event.startsAt, event.endsAt)}
            {event.venue ? ` · ${event.venue}` : ''}
            {exhibitor && event.hostName ? ` · at ${event.hostName}` : ''}
          </p>
        </div>
        <Link to={`/events/${event.id}/setup`} className={buttonClass('secondary')}>
          <Settings2 className="h-4 w-4" aria-hidden /> Zones and sensors
        </Link>
      </div>

      {zones.length === 0 ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <EmptyState
              icon={<MapPin className="h-6 w-6" />}
              title="No zones yet, so nothing to count"
              action={<Link to={`/events/${event.id}/setup`} className={buttonClass()}>Set up zones and sensors</Link>}
            >
              {exhibitor
                ? 'Add your stand as a zone and put a PLExyz sensor in it. You’ll see who walked up, who stayed, and who left their details.'
                : 'Add the hall, the entrances and each booth as zones, and put a PLExyz sensor in each. The funnel, the busy hours and the booth ranking start as soon as sensors report.'}
            </EmptyState>
          </div>
          <Outcomes outcomes={outcomes} event={event} />
        </div>
      ) : (
        <>
          <Card className="mb-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-ink">Showing</span>
                <select className={inputClass} value={zoneId ?? ''} onChange={e => setZone(e.target.value || null)}>
                  <option value="">{exhibitor ? 'Your stand, and the event around it' : 'The whole event'}</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-baseline justify-between text-[12.5px] font-semibold text-ink">
                  <span>Counts as “stayed” from</span>
                  <span className="rounded-md bg-purple-tint px-2 py-0.5 tabular-nums text-purple-text">{formatMinutes(draft)}</span>
                </span>
                <input
                  type="range" min={THRESHOLD_MIN} max={THRESHOLD_MAX} step={0.5} value={draft}
                  onChange={e => setDraft(Number(e.target.value))}
                  onPointerUp={commitThreshold} onKeyUp={commitThreshold} onBlur={commitThreshold}
                  className="w-full accent-[var(--brand-purple)]"
                  aria-describedby="threshold-help"
                />
                <span id="threshold-help" className="mt-1 flex justify-between text-[11px] text-fg-subtle">
                  <span>A glance ({THRESHOLD_MIN} min)</span><span>A real conversation ({THRESHOLD_MAX} min)</span>
                </span>
              </label>
            </div>
          </Card>

          {presence.status === 'error' && <div className="mb-6"><ErrorNote error={presence.error} onRetry={presence.reload} /></div>}
          {!presence.data && presence.status === 'loading' && <Spinner label="Counting" />}

          {presence.data && (() => {
            const { report } = presence.data;
            const stages = buildStages({ event, report, outcomes, focus, thresholdMinutes: threshold });
            const found = insights({ report, outcomes, event, zones, focus, thresholdMinutes: threshold });
            const stale = presence.status === 'loading';
            return (
              <div className={`grid gap-6 transition-opacity lg:grid-cols-3 ${stale ? 'opacity-60' : ''}`} aria-busy={stale}>
                <div className="min-w-0 space-y-6 lg:col-span-2">
                  <Card>
                    <Eyebrow>{focus ? focus.name : exhibitor ? 'Your stand' : 'The whole event'}</Eyebrow>
                    <h2 className="mb-5 mt-1 text-xl font-extrabold tracking-tight text-ink">Who came, who stayed</h2>
                    <FunnelChart stages={stages} />
                    <p className="mt-5 text-xs text-fg-subtle">
                      {report.sessions === 0
                        ? 'No visits counted in this window yet. If the event has started, check the sensors are online.'
                        : `From ${formatCount(report.sessions)} visits counted by PLExyz sensors, ${formatTime(report.firstSeenAt!)} to ${formatTime(report.lastSeenAt!)}.`}
                    </p>
                  </Card>

                  <Card>
                    <h2 className="text-xl font-extrabold tracking-tight text-ink">When it was busy</h2>
                    <p className="mb-4 mt-1 text-sm text-fg-muted">People there at some point in each hour{focus ? `, at ${focus.name}` : ''}.</p>
                    <TrafficChart buckets={report.traffic} label="People present per hour" />
                  </Card>

                  {!focus && report.zones.length > 1 && (
                    <Card>
                      <h2 className="text-xl font-extrabold tracking-tight text-ink">{exhibitor ? 'Your zones' : 'Booths and rooms'}</h2>
                      <p className="mb-4 mt-1 text-sm text-fg-muted">
                        Ranked by people who stayed {formatMinutes(threshold)} or more. Pick one to see its own funnel.
                      </p>
                      <ZoneTable stats={report.zones} zones={zones} onFocus={setZone} />
                    </Card>
                  )}
                </div>

                <div className="min-w-0 space-y-6">
                  <Card>
                    <div className="mb-4 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-text" aria-hidden />
                      <h2 className="font-extrabold tracking-tight text-ink">What stands out</h2>
                    </div>
                    {found.length === 0 ? (
                      <p className="text-sm text-fg-muted">Not enough visits yet to say anything that would hold up.</p>
                    ) : (
                      <ul className="space-y-3">
                        {found.map(i => (
                          <li key={i.key} className="flex gap-2.5 text-sm text-ink">
                            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
                            <span>{i.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                  <Outcomes outcomes={outcomes} event={event} />
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

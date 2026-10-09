// One event's numbers, laid out as a dashboard: the event and its controls on
// top, the funnel (the prototype's, kept), then the zones as tiles beside their
// ranking, then traffic and staffing, then what stands out. Every chart is the
// prototype's, drawn from real visits; what it invented (staff counts, "+4.2% on
// yesterday") is gone or replaced by what the data actually says.
//
// The view lives in the URL — zone, window, threshold, percentages — so a link
// to "Booth A12, day 2, 5 minutes" opens exactly that.

import { Lightbulb, Settings2, Sparkles, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { EventOutcomes, MoleEvent, Zone } from '../../supabase/functions/_shared/contract.ts';
import { clampThreshold, THRESHOLD_DEFAULT, THRESHOLD_MAX, THRESHOLD_MIN } from '../../supabase/functions/_shared/presence.ts';
import type { Backend } from '../data/backend.ts';
import { formatCount, formatEventWhen, formatMinutes, formatTime } from '../domain/format.ts';
import { buildStages, staffNote, type Stage } from '../domain/funnel.ts';
import { insights, type Insight } from '../domain/insights.ts';
import { bucketFor, eventDays, eventHours, type Granularity } from '../domain/windows.ts';
import { Link } from '../lib/Link.tsx';
import { useAsync } from '../lib/useAsync.ts';
import { FlowFunnel } from '../ui/FlowFunnel.tsx';
import { GoalCard } from '../ui/GoalCard.tsx';
import { Card, EmptyState, ErrorNote, Pill, Spinner } from '../ui/kit.tsx';
import { PageHeader } from '../ui/PageHeader.tsx';
import { StaffingCard } from '../ui/StaffingCard.tsx';
import { StageSheet } from '../ui/StageSheet.tsx';
import { buttonClass, inputClass } from '../ui/styles.ts';
import { TrafficChart } from '../ui/TrafficChart.tsx';
import { ZoneList } from '../ui/ZoneList.tsx';
import { ZoneMap } from '../ui/ZoneMap.tsx';

// ── The view, in the address ────────────────────────────────────────────────

interface View {
  zone: string | null;
  threshold: number;
  g: Granularity;
  slot: number;
  pct: boolean;
}

function readView(): View {
  const p = new URLSearchParams(window.location.search);
  const g = p.get('g');
  return {
    zone: p.get('zone'),
    threshold: p.has('t') ? clampThreshold(p.get('t')) : THRESHOLD_DEFAULT,
    g: g === 'day' || g === 'hour' ? g : 'event',
    slot: Math.max(0, Number(p.get('s') ?? 0) || 0),
    pct: p.get('pct') === '1',
  };
}

function writeView(v: View) {
  const p = new URLSearchParams();
  if (v.zone) p.set('zone', v.zone);
  if (v.threshold !== THRESHOLD_DEFAULT) p.set('t', String(v.threshold));
  if (v.g !== 'event') { p.set('g', v.g); p.set('s', String(v.slot)); }
  if (v.pct) p.set('pct', '1');
  const qs = p.toString();
  history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

// ── The goal, on this device ────────────────────────────────────────────────
// A target is the person's own number, not data; it is kept in this browser,
// and the page works the same without it.

const GOAL_DEFAULT = 100;
const goalKey = (eventId: string) => `mole-sense:goal:${eventId}`;
function readGoal(eventId: string): number {
  try {
    const n = Number(localStorage.getItem(goalKey(eventId)));
    return Number.isFinite(n) && n > 0 ? n : GOAL_DEFAULT;
  } catch {
    return GOAL_DEFAULT;
  }
}
function saveGoal(eventId: string, n: number) {
  try { localStorage.setItem(goalKey(eventId), String(n)); } catch { /* private window: it just isn't remembered */ }
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-chip bg-surface-3 p-1">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`min-h-11 flex-1 rounded-chip px-3 text-xs font-semibold transition-all
            ${value === v ? 'bg-surface text-ink shadow-subtle' : 'text-fg-muted hover:text-ink'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function ToolbarField({ label, aside, className = '', children }: { label: string; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-fg-muted">
        <span>{label}</span>
        {aside}
      </div>
      {children}
    </div>
  );
}

function Insights({ items }: { items: Insight[] }) {
  return (
    <section aria-label="What stands out">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Sparkles className="h-4 w-4 text-purple-text" aria-hidden />
        <h2 className="text-lg font-extrabold tracking-tight text-ink">What stands out</h2>
      </div>
      {items.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-5 text-sm text-fg-muted">
          Not enough visits yet to say anything that would hold up.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map(i => (
            <li key={i.key} className="flex gap-3 rounded-card border border-line bg-surface p-5 text-sm leading-relaxed text-ink shadow-subtle">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-purple-text" aria-hidden />
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
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
        <h2 className="text-lg font-extrabold tracking-tight text-ink">From Mole, for the whole event</h2>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
        {rows.map(([label, value, note]) => (
          <div key={label}>
            <dt className="text-xs font-semibold text-fg-muted">{label}</dt>
            <dd className="text-2xl font-extrabold tabular-nums tracking-tight text-ink">{value == null ? '—' : formatCount(value)}</dd>
            <dd className="text-xs text-fg-muted">{note}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function EventHeader({ event }: { event: MoleEvent }) {
  const exhibitor = event.package === 'EXHIBITOR';
  return (
    <PageHeader
      back={{ to: '/', label: 'Your events' }}
      title={event.title}
      badge={exhibitor ? <Pill tone="events">Exhibitor view</Pill> : <Pill tone="purple">Organiser view</Pill>}
      meta={[
        formatEventWhen(event.startsAt, event.endsAt),
        event.venue,
        exhibitor && event.hostName ? `at ${event.hostName}` : null,
      ].filter(Boolean).join(' · ')}
      actions={
        <Link to={`/events/${event.id}/setup`} className={buttonClass('secondary')}>
          <Settings2 className="h-4 w-4" aria-hidden /> Zones and sensors
        </Link>
      }
    />
  );
}

// ── The page ─────────────────────────────────────────────────────────────────

export function EventDashboard({ backend, eventId }: { backend: Backend; eventId: string }) {
  const [view, setViewState] = useState<View>(readView);
  // The slider moves `draft`; the query only follows when the thumb is let go,
  // so dragging is one request and not forty.
  const [draft, setDraft] = useState(view.threshold);
  const [goal, setGoalState] = useState(() => readGoal(eventId));
  const [open, setOpen] = useState<Stage | null>(null);
  // The tile whose detail is open on the zone map.
  const [picked, setPicked] = useState<string | null>(null);

  const setView = (patch: Partial<View>) => setViewState(v => {
    const next = { ...v, ...patch };
    writeView(next);
    return next;
  });
  const setGoal = (n: number) => { setGoalState(n); if (n > 0) saveGoal(eventId, n); };

  const base = useAsync(async () => {
    const [event, zones, outcomes] = await Promise.all([backend.event(eventId), backend.zones(eventId), backend.outcomes(eventId)]);
    return { event, zones, outcomes };
  }, [backend, eventId]);

  const event = base.data?.event ?? null;
  const start = event?.startsAt ?? null;
  const end = start ? (event?.endsAt ?? new Date(Date.parse(start) + 86_400_000).toISOString()) : null;
  const slots = !start || !end ? [] : view.g === 'day' ? eventDays(start, end) : view.g === 'hour' ? eventHours(start, end) : [];
  const slot = slots[Math.min(view.slot, Math.max(0, slots.length - 1))];

  const zonesReady = base.status === 'ready' && base.data.zones.length > 0;
  const presence = useAsync(
    () => (zonesReady
      ? backend.presence(eventId, {
          zoneId: view.zone,
          thresholdMinutes: view.threshold,
          bucketSeconds: bucketFor(view.g),
          ...(slot ? { from: slot.from, to: slot.to } : {}),
        })
      : Promise.resolve(null)),
    [backend, eventId, view.zone, view.threshold, view.g, slot?.from, zonesReady],
  );

  if (base.status === 'loading' && !base.data) return <Spinner label="Loading the event" />;
  if (base.status === 'error') return <ErrorNote error={base.error} onRetry={base.reload} />;
  const { zones, outcomes } = base.data!;
  if (!event) {
    return (
      <EmptyState mood="sad" title="This event isn’t yours to see" action={<Link to="/" className="font-semibold text-purple-text underline">Back to your events</Link>}>
        Either it doesn’t exist, or you aren’t an admin of its organisation or an editor of the event in Mole.
      </EmptyState>
    );
  }

  const focus: Zone | null = zones.find(z => z.id === view.zone) ?? null;
  const exhibitor = event.package === 'EXHIBITOR';
  const place = focus ? focus.name : exhibitor ? 'your stand' : 'the event';
  const commitThreshold = () => { if (draft !== view.threshold) setView({ threshold: draft }); };

  if (zones.length === 0) {
    return (
      <div>
        <EventHeader event={event} />
        <div className="max-w-3xl space-y-6">
          <EmptyState
            mood="thinking"
            title="No zones yet, so nothing to count"
            action={<Link to={`/events/${event.id}/setup`} className={buttonClass()}>Set up zones and sensors</Link>}
          >
            {exhibitor
              ? 'Add your stand as a zone and put a PLExyz sensor in it. You’ll see who walked up, who stayed, and who left their details.'
              : 'Add the hall, the entrances and each booth as zones, and put a PLExyz sensor in each. The funnel, the busy hours and the booth ranking start as soon as sensors report.'}
          </EmptyState>
          <Outcomes outcomes={outcomes} event={event} />
        </div>
      </div>
    );
  }

  const report = presence.data?.report ?? null;
  const stages = report ? buildStages({ event, report, outcomes, focus, thresholdMinutes: view.threshold, wholeEvent: view.g === 'event' }) : [];
  const found = report ? insights({ report, outcomes, event, zones, focus, thresholdMinutes: view.threshold }) : [];
  const goalStage = stages.find(s => s.source === 'mole');
  const goalMet = !!goalStage && goalStage.value != null && goalStage.value >= goal;
  const stale = presence.status === 'loading';

  const tiles = zones.filter(z => z.kind === 'booth' || z.kind === 'room');
  const showMap = !!report && tiles.length > 1;
  const showList = !!report && !focus && report.zones.length > 1;

  const toolbar = (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <ToolbarField label="Showing" className="w-full sm:w-64">
          <select className={inputClass} value={view.zone ?? ''} onChange={e => setView({ zone: e.target.value || null })} aria-label="Showing">
            <option value="">{exhibitor ? 'Your stand and its event' : 'The whole event'}</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </ToolbarField>

        <ToolbarField label="Time">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<Granularity>
              label="Time"
              value={view.g}
              options={[['event', 'Event'], ['day', 'Day'], ['hour', 'Hour']]}
              onChange={g => setView({ g, slot: 0 })}
            />
            {slots.length > 0 && (
              <select className={`${inputClass} !w-auto`} aria-label={view.g === 'day' ? 'Which day' : 'Which hour'}
                value={Math.min(view.slot, slots.length - 1)} onChange={e => setView({ slot: Number(e.target.value) })}>
                {slots.map((s, i) => <option key={s.from} value={i}>{s.label}</option>)}
              </select>
            )}
          </div>
        </ToolbarField>

        <ToolbarField
          label="Counts as “stayed” from"
          className="w-full sm:w-56"
          aside={<span className="rounded-md bg-purple-tint px-2 py-0.5 text-sm font-extrabold tabular-nums text-purple-text">{formatMinutes(draft)}</span>}
        >
          <input
            type="range" min={THRESHOLD_MIN} max={THRESHOLD_MAX} step={0.5} value={draft}
            onChange={e => setDraft(Number(e.target.value))}
            onPointerUp={commitThreshold} onKeyUp={commitThreshold} onBlur={commitThreshold}
            className="h-11 w-full cursor-pointer accent-[var(--brand-purple)]"
            aria-label="Counts as stayed from, in minutes"
            aria-describedby="threshold-help"
          />
          <span id="threshold-help" className="flex justify-between text-[11px] text-fg-muted">
            <span>A glance</span><span>A conversation</span>
          </span>
        </ToolbarField>

        {goalStage && (
          <ToolbarField label="Connection goal" className="w-full sm:w-44">
            <span className="relative block">
              <input
                type="number" min={1} inputMode="numeric" className={inputClass} value={goal}
                onChange={e => setGoal(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                aria-label="Connection goal"
                aria-describedby="goal-help"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-muted">
                {goalStage.key === 'details' ? 'leads' : 'connections'}
              </span>
            </span>
            <span id="goal-help" className="sr-only">Your own target, kept on this device.</span>
          </ToolbarField>
        )}

      </div>
    </Card>
  );

  return (
    <div>
      <EventHeader event={event} />

      <div className="space-y-6">
        {toolbar}

        <div className={`space-y-6 transition-opacity ${stale ? 'opacity-60' : ''}`} aria-busy={stale}>
          {presence.status === 'error' && <ErrorNote error={presence.error} onRetry={presence.reload} />}
          {!report && presence.status === 'loading' && <Spinner label="Counting" />}

          {report && (
            <>
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-extrabold tracking-tight text-ink">Visitor funnel</h2>
                  <Segmented<'count' | 'pct'>
                    label="Show the funnel as"
                    value={view.pct ? 'pct' : 'count'}
                    options={[['count', 'People'], ['pct', 'Percentages']]}
                    onChange={v => setView({ pct: v === 'pct' })}
                  />
                </div>
                <FlowFunnel stages={stages} showPercent={view.pct} goalMet={goalMet} onOpen={setOpen} />
                <p className="mt-3 px-2 text-xs text-fg-muted">
                  {report.sessions === 0
                    ? 'No visits counted in this window yet. If the event has started, check the sensors are online.'
                    : `${focus ? focus.name : exhibitor ? 'Your stand' : 'The whole event'}${slot ? `, ${slot.label}` : ''}: from ${formatCount(report.sessions)} visits counted by PLExyz sensors, ${formatTime(report.firstSeenAt!)} to ${formatTime(report.lastSeenAt!)}. Tap a stage for what it means.`}
                  {report.staffLeftOut > 0 && ` ${staffNote(report.staffLeftOut)}`}
                </p>
              </div>

              <GoalCard stage={goalStage} goal={goal} />

              {(showMap || showList) && (
                <div className="grid gap-6 xl:grid-cols-12">
                  {showMap && (
                    <div className={showList ? 'xl:col-span-7' : 'xl:col-span-12'}>
                      <ZoneMap
                        zones={zones}
                        stats={report.zones}
                        selectedId={picked}
                        focusId={view.zone}
                        thresholdMinutes={view.threshold}
                        onSelect={setPicked}
                        onFocus={id => { setView({ zone: id }); setPicked(null); }}
                      />
                    </div>
                  )}
                  {showList && (
                    <div className={showMap ? 'xl:col-span-5' : 'xl:col-span-12'}>
                      <ZoneList
                        title={exhibitor ? 'Your zones' : 'Booths and rooms'}
                        stats={report.zones}
                        zones={zones}
                        thresholdMinutes={view.threshold}
                        onFocus={z => setView({ zone: z })}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="flex min-w-0 flex-col">
                  <h2 className="text-lg font-extrabold tracking-tight text-ink">Traffic trend</h2>
                  <p className="mb-4 text-xs text-fg-muted">
                    People at {place} at some point in each {view.g === 'hour' ? 'quarter-hour' : 'hour'}
                  </p>
                  <TrafficChart buckets={report.traffic} label={`People present per ${view.g === 'hour' ? 'quarter-hour' : 'hour'}`} />
                </Card>
                <StaffingCard traffic={report.traffic} place={place} />
              </div>

              <Insights items={found} />

              <Outcomes outcomes={outcomes} event={event} />

              <p className="pb-2 text-center text-[11px] text-fg-muted">Counted by PLExyz sensors · connections from Mole</p>
            </>
          )}
        </div>
      </div>

      <StageSheet stage={open} onClose={() => setOpen(null)} />
    </div>
  );
}

// One event's numbers, laid out the way the prototype was: the context and the
// controls in a column on the left, and on the right the funnel, the goal,
// traffic and staffing, then the booths. Every chart is the prototype's,
// drawn from real visits; what it invented (staff counts, "+4.2% on
// yesterday") is gone or replaced by what the data actually says.
//
// The view lives in the URL — zone, window, threshold, percentages — so a link
// to "Booth A12, day 2, 5 minutes" opens exactly that.

import { ArrowLeft, Clock, Lightbulb, Settings2, Sparkles, Target, Users } from 'lucide-react';
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
import { StaffingCard } from '../ui/StaffingCard.tsx';
import { StageSheet } from '../ui/StageSheet.tsx';
import { buttonClass, inputClass } from '../ui/styles.ts';
import { TrafficChart } from '../ui/TrafficChart.tsx';
import { ZoneTable } from '../ui/ZoneTable.tsx';

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

function Header({ event }: { event: MoleEvent }) {
  const exhibitor = event.package === 'EXHIBITOR';
  return (
    <header className="pb-6">
      <Link to="/" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-fg-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Your events
      </Link>
      <div className="mb-2">{exhibitor ? <Pill tone="events">Exhibitor view</Pill> : <Pill tone="purple">Organiser view</Pill>}</div>
      <h1 className="text-3xl font-black leading-tight tracking-tight text-ink lg:text-4xl">
        {exhibitor ? 'Booth performance' : 'Event performance'}
      </h1>
      <p className="mt-3 text-base font-semibold text-ink">{event.title}</p>
      <p className="mt-1 text-sm text-fg-muted">
        {formatEventWhen(event.startsAt, event.endsAt)}
        {event.venue ? ` · ${event.venue}` : ''}
        {exhibitor && event.hostName ? ` · at ${event.hostName}` : ''}
      </p>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-fg-muted">
        {exhibitor
          ? 'Your stand on its own: who walked up, who stayed, and who left their details.'
          : 'The whole floor: who came, which booths drew people, and when it was busy.'}
      </p>
      <Link to={`/events/${event.id}/setup`} className={`${buttonClass('secondary')} mt-5`}>
        <Settings2 className="h-4 w-4" aria-hidden /> Zones and sensors
      </Link>
    </header>
  );
}

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

function Insights({ items }: { items: Insight[] }) {
  return (
    <section aria-label="What stands out">
      <div className="mb-4 flex items-center gap-2 px-1">
        <Sparkles className="h-4 w-4 text-purple-text" aria-hidden />
        <h2 className="text-sm font-extrabold uppercase tracking-[0.1em] text-ink">What stands out</h2>
      </div>
      {items.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-5 text-sm text-fg-muted">
          Not enough visits yet to say anything that would hold up.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {items.map(i => (
            <li key={i.key} className="flex gap-3 rounded-card border border-line bg-surface p-5 text-sm leading-relaxed text-ink shadow-subtle">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-purple-text" aria-hidden />
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-center text-[11px] text-fg-muted">Counted by PLExyz sensors · connections from Mole</p>
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
        <h2 className="font-extrabold tracking-tight text-ink">From Mole, for the whole event</h2>
      </div>
      <dl className="grid gap-4 sm:grid-cols-3">
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

function ControlLabel({ icon, children, aside }: { icon: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <span className="mb-2 flex items-center justify-between text-[13px] font-semibold text-ink">
      <span className="flex items-center gap-2">{icon}{children}</span>
      {aside}
    </span>
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
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
        <aside className="lg:col-span-4"><Header event={event} /></aside>
        <main className="space-y-6 lg:col-span-8 lg:pt-6">
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
        </main>
      </div>
    );
  }

  const report = presence.data?.report ?? null;
  const stages = report ? buildStages({ event, report, outcomes, focus, thresholdMinutes: view.threshold, wholeEvent: view.g === 'event' }) : [];
  const found = report ? insights({ report, outcomes, event, zones, focus, thresholdMinutes: view.threshold }) : [];
  const goalStage = stages.find(s => s.source === 'mole');
  const goalMet = !!goalStage && goalStage.value != null && goalStage.value >= goal;
  const stale = presence.status === 'loading';

  const controls = (
    <Card className="space-y-6 rounded-[28px] p-5">
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="sr-only">Showing</span>
          <select className={inputClass} value={view.zone ?? ''} onChange={e => setView({ zone: e.target.value || null })} aria-label="Showing">
            <option value="">{exhibitor ? 'Your stand, and the event around it' : 'The whole event'}</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
        <Segmented<Granularity>
          label="Time"
          value={view.g}
          options={[['event', 'Event'], ['day', 'Day'], ['hour', 'Hour']]}
          onChange={g => setView({ g, slot: 0 })}
        />
        {slots.length > 0 && (
          <select className={inputClass} aria-label={view.g === 'day' ? 'Which day' : 'Which hour'}
            value={Math.min(view.slot, slots.length - 1)} onChange={e => setView({ slot: Number(e.target.value) })}>
            {slots.map((s, i) => <option key={s.from} value={i}>{s.label}</option>)}
          </select>
        )}
      </div>

      <label className="block">
        <ControlLabel
          icon={<Clock className="h-4 w-4 text-purple-text" aria-hidden />}
          aside={<span className="rounded-md bg-purple-tint px-2 py-0.5 text-sm font-extrabold tabular-nums text-purple-text">{formatMinutes(draft)}</span>}
        >
          Counts as “stayed” from
        </ControlLabel>
        <input
          type="range" min={THRESHOLD_MIN} max={THRESHOLD_MAX} step={0.5} value={draft}
          onChange={e => setDraft(Number(e.target.value))}
          onPointerUp={commitThreshold} onKeyUp={commitThreshold} onBlur={commitThreshold}
          className="h-11 w-full cursor-pointer accent-[var(--brand-purple)]"
          aria-describedby="threshold-help"
        />
        <span id="threshold-help" className="mt-1 flex justify-between text-[11px] text-fg-subtle">
          <span>A glance ({THRESHOLD_MIN} min)</span><span>A real conversation ({THRESHOLD_MAX} min)</span>
        </span>
      </label>

      {goalStage && (
        <label className="block">
          <ControlLabel icon={<Target className="h-4 w-4 text-sunny-text" aria-hidden />}>Connection goal</ControlLabel>
          <span className="relative block">
            <input
              type="number" min={1} inputMode="numeric" className={inputClass} value={goal}
              onChange={e => setGoal(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              aria-describedby="goal-help"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-fg-subtle">
              {goalStage.key === 'details' ? 'leads' : 'connections'}
            </span>
          </span>
          <span id="goal-help" className="mt-1 block text-[11px] text-fg-subtle">Your own target, kept on this device.</span>
        </label>
      )}

      <div className="flex items-center justify-between border-t border-line pt-4">
        <span className="text-xs text-fg-muted">Show the funnel as</span>
        <Segmented<'count' | 'pct'>
          label="Show the funnel as"
          value={view.pct ? 'pct' : 'count'}
          options={[['count', 'People'], ['pct', 'Percentages']]}
          onChange={v => setView({ pct: v === 'pct' })}
        />
      </div>
    </Card>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-12">
      {/* Left: context and controls, then (on a wide screen) what stands out. */}
      <aside className="min-w-0 space-y-6 lg:sticky lg:top-6 lg:col-span-4">
        <Header event={event} />
        {controls}
        <div className="hidden lg:block">{report && <Insights items={found} />}</div>
      </aside>

      {/* Right: the funnel and everything that explains it. */}
      <main className={`min-w-0 space-y-6 transition-opacity lg:col-span-8 lg:pt-6 ${stale ? 'opacity-60' : ''}`} aria-busy={stale}>
        {presence.status === 'error' && <ErrorNote error={presence.error} onRetry={presence.reload} />}
        {!report && presence.status === 'loading' && <Spinner label="Counting" />}

        {report && (
          <>
            <div>
              <FlowFunnel stages={stages} showPercent={view.pct} goalMet={goalMet} onOpen={setOpen} />
              <p className="mt-3 px-2 text-xs text-fg-muted">
                {report.sessions === 0
                  ? 'No visits counted in this window yet. If the event has started, check the sensors are online.'
                  : `${focus ? focus.name : exhibitor ? 'Your stand' : 'The whole event'}${slot ? `, ${slot.label}` : ''}: from ${formatCount(report.sessions)} visits counted by PLExyz sensors, ${formatTime(report.firstSeenAt!)} to ${formatTime(report.lastSeenAt!)}. Tap a stage for what it means.`}
                {report.staffLeftOut > 0 && ` ${staffNote(report.staffLeftOut)}`}
              </p>
            </div>

            <GoalCard stage={goalStage} goal={goal} />

            <div className="lg:hidden">{<Insights items={found} />}</div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="flex min-w-0 flex-col">
                <h2 className="font-extrabold tracking-tight text-ink">Traffic trend</h2>
                <p className="mb-4 text-xs text-fg-subtle">
                  People at {place} at some point in each {view.g === 'hour' ? 'quarter-hour' : 'hour'}
                </p>
                <TrafficChart buckets={report.traffic} label={`People present per ${view.g === 'hour' ? 'quarter-hour' : 'hour'}`} />
              </Card>
              <StaffingCard traffic={report.traffic} place={place} />
            </div>

            {!focus && report.zones.length > 1 && (
              <Card>
                <h2 className="text-xl font-extrabold tracking-tight text-ink">{exhibitor ? 'Your zones' : 'Booths and rooms'}</h2>
                <p className="mb-4 mt-1 text-sm text-fg-muted">
                  Ranked by people who stayed {formatMinutes(view.threshold)} or more. Pick one to see its own funnel.
                </p>
                <ZoneTable stats={report.zones} zones={zones} onFocus={z => setView({ zone: z })} />
              </Card>
            )}

            <Outcomes outcomes={outcomes} event={event} />
          </>
        )}
      </main>

      <StageSheet stage={open} onClose={() => setOpen(null)} />
    </div>
  );
}

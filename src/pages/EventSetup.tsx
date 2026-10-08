// Where the sensors are at one event: its zones, and which sensor is in each.
// The kind of a zone decides which funnel step it feeds, so it is chosen with
// that said next to it rather than as a bare dropdown of nouns.

import { ArrowLeft, Pencil, Plus, Radio, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Device, Zone, ZoneKind } from '../../supabase/functions/_shared/contract.ts';
import type { Backend } from '../data/backend.ts';
import { Link } from '../lib/Link.tsx';
import { useAsync } from '../lib/useAsync.ts';
import { Button, Card, ErrorNote, Field, Pill, Spinner } from '../ui/kit.tsx';
import { buttonClass, inputClass } from '../ui/styles.ts';
import { DeviceStatusPill } from './SensorsPage.tsx';
import { KIND_TEXT } from '../domain/zones.ts';


function ZoneRow({ zone, devices, spare, backend, onChange }: {
  zone: Zone; devices: Device[]; spare: Device[]; backend: Backend; onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(zone.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-panel border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        {editing ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={e => { e.preventDefault(); act(async () => { await backend.updateZone(zone.id, { name }); setEditing(false); }); }}
          >
            <input className={inputClass} value={name} onChange={e => setName(e.target.value)} aria-label="Zone name" autoFocus />
            <Button type="submit" busy={busy}>Save</Button>
            <Button type="button" tone="quiet" onClick={() => { setEditing(false); setName(zone.name); }}>Cancel</Button>
          </form>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{zone.name}</span>
                <Pill tone="neutral">{KIND_TEXT[zone.kind].name}</Pill>
              </div>
              <p className="mt-0.5 text-xs text-fg-subtle">{KIND_TEXT[zone.kind].feeds}</p>
            </div>
            <button className="rounded-full p-2 text-fg-subtle hover:bg-surface-3 hover:text-ink" aria-label={`Rename ${zone.name}`} onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
            <button
              className="rounded-full p-2 text-fg-subtle hover:bg-bad-tint hover:text-bad-text"
              aria-label={`Delete ${zone.name}`}
              onClick={() => { if (confirm(`Delete “${zone.name}”? Sensors in it are moved out, not unpaired.`)) act(() => backend.deleteZone(zone.id)); }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {devices.length === 0 && <span className="text-xs text-fg-muted">No sensor here yet, so this zone counts nothing.</span>}
        {devices.map(d => (
          <span key={d.id} className="inline-flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-xs">
            <Radio className="h-3.5 w-3.5 text-purple-text" aria-hidden />
            <span className="font-semibold text-ink">{d.label}</span>
            <DeviceStatusPill device={d} />
            <button className="rounded-full px-2 py-0.5 text-fg-muted hover:bg-surface-3 hover:text-ink" onClick={() => act(() => backend.updateDevice(d.id, { zoneId: null }))}>
              Take out
            </button>
          </span>
        ))}
        {spare.length > 0 && (
          <select
            className="rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-semibold text-purple-text"
            value=""
            disabled={busy}
            aria-label={`Put a sensor in ${zone.name}`}
            onChange={e => { const id = e.target.value; if (id) act(() => backend.updateDevice(id, { zoneId: zone.id })); }}
          >
            <option value="">+ Put a sensor here</option>
            {spare.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        )}
      </div>
      {error && <div className="mt-3"><ErrorNote error={error} /></div>}
    </li>
  );
}

export function EventSetup({ backend, eventId }: { backend: Backend; eventId: string }) {
  const data = useAsync(async () => {
    const event = await backend.event(eventId);
    if (!event) return null;
    const [zones, devices, orgs] = await Promise.all([backend.zones(eventId), backend.devices(event.orgId).catch(() => null), backend.myOrgs()]);
    return { event, zones, devices, canPair: orgs.some(o => o.orgId === event.orgId) };
  }, [backend, eventId]);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<ZoneKind>('booth');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (data.status === 'loading' && !data.data) return <Spinner />;
  if (data.status === 'error') return <ErrorNote error={data.error} onRetry={data.reload} />;
  if (!data.data) return <ErrorNote error="This event isn’t yours to set up." />;
  const { event, zones, devices, canPair } = data.data;

  const live = (devices ?? []).filter(d => d.status === 'active');
  const zoneIds = new Set(zones.map(z => z.id));
  const spare = live.filter(d => !d.zoneId);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await backend.createZone(eventId, { name, kind });
      setName('');
      data.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/events/${eventId}`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-fg-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {event.title}
      </Link>
      <h1 className="text-[28px] font-black tracking-tight text-ink">Zones and sensors</h1>
      <p className="mt-1 text-sm text-fg-muted">
        A zone is a place a sensor watches. Put one sensor in each zone; what kind of zone it is decides which numbers it adds to.
      </p>

      <Card className="mt-6">
        <h2 className="mb-4 font-extrabold tracking-tight text-ink">Add a zone</h2>
        <form onSubmit={add} className="grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <Field label="Name">
            <input className={inputClass} required maxLength={80} placeholder="e.g. Booth A12 · TechFlow" value={name} onChange={e => setName(e.target.value)} />
          </Field>
          <Field label="Kind">
            <select className={inputClass} value={kind} onChange={e => setKind(e.target.value as ZoneKind)}>
              {(Object.keys(KIND_TEXT) as ZoneKind[]).map(k => <option key={k} value={k}>{KIND_TEXT[k].name}</option>)}
            </select>
          </Field>
          <Button type="submit" busy={busy}><Plus className="h-4 w-4" aria-hidden /> Add</Button>
        </form>
        <p className="mt-2 text-xs text-fg-subtle">{KIND_TEXT[kind].feeds}</p>
        {error && <div className="mt-3"><ErrorNote error={error} /></div>}
      </Card>

      <ul className="mt-6 space-y-3">
        {zones.map(z => (
          <ZoneRow key={z.id} zone={z} backend={backend} onChange={data.reload}
            devices={(devices ?? []).filter(d => d.zoneId === z.id)} spare={spare} />
        ))}
      </ul>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-extrabold tracking-tight text-ink">Sensors</h2>
            <p className="mt-1 text-sm text-fg-muted">
              {devices == null
                ? 'You can place sensors your organisation has already paired. Pairing new ones needs an admin of the organisation.'
                : spare.length > 0
                  ? `${spare.length} paired sensor${spare.length === 1 ? ' is' : 's are'} not in any zone yet.`
                  : live.some(d => d.zoneId && !zoneIds.has(d.zoneId))
                    ? 'Every paired sensor is placed, some at your other events.'
                    : 'Every paired sensor is placed.'}
            </p>
          </div>
          {canPair && (
            <Link to={`/orgs/${event.orgId}/sensors/pair?event=${eventId}`} className={buttonClass('secondary')}>
              <Radio className="h-4 w-4" aria-hidden /> Pair a sensor
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}

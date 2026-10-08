// An organisation's PLExyz sensors: which are paired, which are waiting for
// the owner to allow them, and whether each is reporting.

import { BatteryFull, BatteryLow, BatteryMedium, Building2, ChevronRight, Radio, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { Device } from '../../supabase/functions/_shared/contract.ts';
import { isOnline } from '../domain/devices.ts';
import type { Backend } from '../data/backend.ts';
import { formatAgo } from '../domain/format.ts';
import { Link } from '../lib/Link.tsx';
import { useAsync } from '../lib/useAsync.ts';
import { Button, EmptyState, ErrorNote, Pill, Spinner } from '../ui/kit.tsx';
import { buttonClass } from '../ui/styles.ts';


export function DeviceStatusPill({ device }: { device: Device }) {
  switch (device.status) {
    case 'pending_approval': return <Pill tone="warn">Waiting for approval</Pill>;
    case 'rejected': return <Pill tone="bad">Not allowed</Pill>;
    case 'expired': return <Pill tone="neutral">Request expired</Pill>;
    case 'revoked': return <Pill tone="neutral">Unpaired</Pill>;
    case 'active': return isOnline(device) ? <Pill tone="ok">Reporting</Pill> : <Pill tone="info">Paired · quiet</Pill>;
  }
}

function Battery({ level }: { level: number | null }) {
  if (level == null) return null;
  const Icon = level > 50 ? BatteryFull : level > 20 ? BatteryMedium : BatteryLow;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${level <= 20 ? 'text-bad-text' : 'text-fg-muted'}`}>
      <Icon className="h-4 w-4" aria-hidden /> {level}%
    </span>
  );
}

function DeviceRow({ device, backend, onChange }: { device: Device; backend: Backend; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      onChange();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-panel border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-chip bg-purple-tint text-purple-text"><Radio className="h-5 w-5" aria-hidden /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{device.label}</span>
            <DeviceStatusPill device={device} />
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-fg-muted">
            <span className="font-mono">{device.code}</span>
            {device.status === 'active' && <span>Last report {formatAgo(device.lastSeenAt)}</span>}
            {device.status === 'active' && !device.zoneId && <span>Not in a zone, so it counts nothing</span>}
          </div>
        </div>
        <Battery level={device.battery} />
        <div className="flex gap-2">
          {device.status === 'pending_approval' && (
            <Button tone="secondary" busy={busy} onClick={() => act(() => backend.refreshDevice(device.id))}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Check again
            </Button>
          )}
          {(device.status === 'active' || device.status === 'pending_approval') && (
            <Button
              tone="danger" busy={busy}
              onClick={() => {
                if (!confirm(`Unpair “${device.label}”? It stops counting at once. What it already counted stays in your reports.`)) return;
                act(async () => {
                  const r = await backend.unpairDevice(device.id);
                  if (!r.plexyzConfirmed) setNote('Unpaired here. PLExyz didn’t confirm, so it may still show as paired there; nothing it sends is counted.');
                });
              }}
            >
              Unpair
            </Button>
          )}
        </div>
      </div>
      {device.status === 'pending_approval' && (
        <p className="mt-3 rounded-chip bg-warn-tint px-3 py-2 text-xs text-warn-text">
          Mole has asked PLExyz to pair this sensor. Whoever owns it allows the request in the PLExyz dashboard; then press Check again.
        </p>
      )}
      {note && <div className="mt-3"><ErrorNote error={note} /></div>}
    </li>
  );
}

export function SensorsPage({ backend, orgId }: { backend: Backend; orgId: string }) {
  const data = useAsync(async () => {
    const orgs = await backend.myOrgs();
    const org = orgs.find(o => o.orgId === orgId) ?? null;
    return { org, devices: org ? await backend.devices(orgId) : [] };
  }, [backend, orgId]);

  if (data.status === 'loading' && !data.data) return <Spinner label="Loading sensors" />;
  if (data.status === 'error') return <ErrorNote error={data.error} onRetry={data.reload} />;
  const { org, devices } = data.data!;
  if (!org) return <ErrorNote error="You aren’t an admin of this organisation’s events, so its sensors aren’t yours to manage." />;

  const current = devices.filter(d => d.status === 'active' || d.status === 'pending_approval');
  const past = devices.filter(d => !current.includes(d));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-fg-muted">{org.orgName}</p>
          <h1 className="text-[28px] font-black tracking-tight text-ink">Sensors</h1>
        </div>
        <Link to={`/orgs/${orgId}/sensors/pair`} className={buttonClass()}>
          <Radio className="h-4 w-4" aria-hidden /> Pair a sensor
        </Link>
      </div>

      {current.length === 0 ? (
        <EmptyState icon={<Radio className="h-6 w-6" />} title="No sensors paired yet"
          action={<Link to={`/orgs/${orgId}/sensors/pair`} className={buttonClass()}>Pair your first sensor</Link>}>
          A PLExyz sensor counts the phones near it — never who they belong to. Scan the QR on the sensor to ask for it; its
          owner allows the request in the PLExyz dashboard, and it starts counting.
        </EmptyState>
      ) : (
        <ul className="space-y-3">{current.map(d => <DeviceRow key={d.id} device={d} backend={backend} onChange={data.reload} />)}</ul>
      )}

      {past.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sm font-semibold text-fg-muted">Earlier requests ({past.length})</summary>
          <ul className="mt-3 space-y-3">{past.map(d => <DeviceRow key={d.id} device={d} backend={backend} onChange={data.reload} />)}</ul>
        </details>
      )}
    </div>
  );
}

/** /sensors when someone runs more than one organisation. */
export function SensorsIndex({ backend }: { backend: Backend }) {
  const orgs = useAsync(() => backend.myOrgs(), [backend]);
  if (orgs.status === 'loading' && !orgs.data) return <Spinner />;
  if (orgs.status === 'error') return <ErrorNote error={orgs.error} onRetry={orgs.reload} />;
  const list = orgs.data ?? [];
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-[28px] font-black tracking-tight text-ink">Sensors</h1>
      {list.length === 0 ? (
        <EmptyState icon={<Building2 className="h-6 w-6" />} title="No organisation to pair sensors for">
          Sensors belong to a Loop organisation. You need to be an owner or admin of one, with events in your scope.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.map(o => (
            <li key={o.orgId}>
              <Link to={`/orgs/${o.orgId}/sensors`} className="flex items-center gap-3 rounded-panel border border-line bg-surface p-4 hover:bg-surface-2">
                <Building2 className="h-5 w-5 text-purple-text" aria-hidden />
                <span className="flex-1 font-semibold text-ink">{o.orgName}</span>
                <ChevronRight className="h-5 w-5 text-fg-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

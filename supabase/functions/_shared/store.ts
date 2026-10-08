// supabase/functions/_shared/store.ts
// ─────────────────────────────────────────────────────────────────────────────
// This project's own database, through PostgREST with the service role.
// ─────────────────────────────────────────────────────────────────────────────
// Plain fetch rather than supabase-js so this file stays importable by both
// Deno and the Node tests. The service role bypasses RLS, which is why every
// caller decides who may do what BEFORE it calls in here; nothing in this file
// checks permission.
// ─────────────────────────────────────────────────────────────────────────────

import type { Device, DeviceStatus, PresenceQuery, PresenceReport, Zone, ZoneKind } from './contract.ts';
import { ApiError } from './http.ts';
import { normaliseReport } from './report.ts';

export interface DeviceRow extends Device {
  plexyzRequestId: string | null;
  plexyzDeviceId: string | null;
}

export interface ZoneRow extends Zone {
  orgId: string;
}

export interface SessionIn {
  visitor_key: string;
  started_at: string;
  ended_at: string;
  source_id: string;
}

export interface Store {
  listDevices(orgId: string): Promise<DeviceRow[]>;
  getDevice(id: string): Promise<DeviceRow | null>;
  deviceByRequest(requestId: string): Promise<DeviceRow | null>;
  activeDeviceByPlexyzId(plexyzId: string): Promise<DeviceRow | null>;
  insertDevice(row: { orgId: string; code: string; label: string; requestedBy: string }): Promise<DeviceRow>;
  updateDevice(id: string, patch: Partial<{
    label: string; status: DeviceStatus; zoneId: string | null; plexyzRequestId: string | null;
    plexyzDeviceId: string | null; approvedAt: string | null; lastSeenAt: string; battery: number | null;
  }>): Promise<DeviceRow>;
  deleteDevice(id: string): Promise<void>;
  setCredentials(deviceId: string, accessToken: string): Promise<void>;
  getCredentials(deviceId: string): Promise<string | null>;
  clearCredentials(deviceId: string): Promise<void>;

  listZones(eventId: string): Promise<ZoneRow[]>;
  getZone(id: string): Promise<ZoneRow | null>;
  insertZone(row: { eventId: string; orgId: string; name: string; kind: ZoneKind; createdBy: string }): Promise<ZoneRow>;
  updateZone(id: string, patch: Partial<{ name: string; kind: ZoneKind }>): Promise<ZoneRow>;
  deleteZone(id: string): Promise<void>;

  report(eventId: string, q: PresenceQuery): Promise<PresenceReport>;
  ingest(deviceId: string, rows: SessionIn[]): Promise<{ received: number; stored: number; dropped_no_zone: number }>;
  /** False if this delivery was already handled. */
  recordDelivery(id: string, kind: string): Promise<boolean>;
  ping(): Promise<boolean>;
}

const DEVICE_COLS = 'id,mole_org_id,code,label,status,zone_id,requested_at,approved_at,last_seen_at,battery,plexyz_request_id,plexyz_device_id';
const ZONE_COLS = 'id,mole_event_id,mole_org_id,name,kind';

export const toDevice = (r: any): DeviceRow => ({
  id: r.id,
  orgId: r.mole_org_id,
  code: r.code,
  label: r.label,
  status: r.status,
  zoneId: r.zone_id ?? null,
  requestedAt: r.requested_at,
  approvedAt: r.approved_at ?? null,
  lastSeenAt: r.last_seen_at ?? null,
  battery: r.battery ?? null,
  plexyzRequestId: r.plexyz_request_id ?? null,
  plexyzDeviceId: r.plexyz_device_id ?? null,
});

export const toZone = (r: any): ZoneRow => ({
  id: r.id, eventId: r.mole_event_id, orgId: r.mole_org_id, name: r.name, kind: r.kind,
});

/** Public shape: what the browser may see of a device. No PLExyz ids. */
export function publicDevice(d: DeviceRow): Device {
  const { plexyzRequestId: _r, plexyzDeviceId: _d, ...rest } = d;
  return rest;
}

const DEVICE_PATCH_COLUMNS: Record<string, string> = {
  label: 'label', status: 'status', zoneId: 'zone_id', plexyzRequestId: 'plexyz_request_id',
  plexyzDeviceId: 'plexyz_device_id', approvedAt: 'approved_at', lastSeenAt: 'last_seen_at', battery: 'battery',
};

export function postgrestStore(url: string, serviceKey: string, f: typeof fetch = fetch): Store {
  const base = `${url.replace(/\/+$/, '')}/rest/v1`;
  const H = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  async function req(path: string, init: RequestInit = {}, prefer?: string): Promise<any> {
    const res = await f(`${base}${path}`, {
      ...init,
      headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) },
    });
    if (res.status === 204) return null;
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const code = body?.code as string | undefined;
      // 23505 unique, 23503 foreign key, 23514 check: the database saying no
      // to something the caller should have been told about specifically.
      if (code === '23505') throw new ApiError('conflict', body?.message ?? 'Already exists.');
      if (code === '23503') throw new ApiError('conflict', body?.message ?? 'Still in use.');
      if (code === '23514' || code === '22P02') throw new ApiError('invalid', 'That value is not allowed.');
      console.error(`store ${init.method ?? 'GET'} ${path} → ${res.status}: ${text.slice(0, 300)}`);
      throw new Error(`store error ${res.status}`);
    }
    return body;
  }

  const one = (rows: any[] | null) => (rows && rows[0]) ?? null;
  const q = encodeURIComponent;

  return {
    async listDevices(orgId) {
      const rows = await req(`/devices?select=${DEVICE_COLS}&mole_org_id=eq.${q(orgId)}&order=requested_at.desc`);
      return rows.map(toDevice);
    },
    async getDevice(id) {
      const r = one(await req(`/devices?select=${DEVICE_COLS}&id=eq.${q(id)}`));
      return r ? toDevice(r) : null;
    },
    async deviceByRequest(requestId) {
      const r = one(await req(`/devices?select=${DEVICE_COLS}&plexyz_request_id=eq.${q(requestId)}`));
      return r ? toDevice(r) : null;
    },
    async activeDeviceByPlexyzId(plexyzId) {
      const r = one(await req(`/devices?select=${DEVICE_COLS}&plexyz_device_id=eq.${q(plexyzId)}&status=eq.active`));
      return r ? toDevice(r) : null;
    },
    async insertDevice({ orgId, code, label, requestedBy }) {
      const rows = await req(`/devices?select=${DEVICE_COLS}`, {
        method: 'POST',
        body: JSON.stringify({ mole_org_id: orgId, code, label, requested_by: requestedBy }),
      }, 'return=representation');
      return toDevice(rows[0]);
    },
    async updateDevice(id, patch) {
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) body[DEVICE_PATCH_COLUMNS[k]!] = v;
      const rows = await req(`/devices?select=${DEVICE_COLS}&id=eq.${q(id)}`, {
        method: 'PATCH', body: JSON.stringify(body),
      }, 'return=representation');
      if (!rows?.[0]) throw new ApiError('not_found', 'That sensor is gone.');
      return toDevice(rows[0]);
    },
    async deleteDevice(id) {
      await req(`/devices?id=eq.${q(id)}`, { method: 'DELETE' });
    },
    async setCredentials(deviceId, accessToken) {
      await req('/device_credentials?on_conflict=device_id', {
        method: 'POST',
        body: JSON.stringify({ device_id: deviceId, access_token: accessToken, updated_at: new Date().toISOString() }),
      }, 'resolution=merge-duplicates');
    },
    async getCredentials(deviceId) {
      const r = one(await req(`/device_credentials?select=access_token&device_id=eq.${q(deviceId)}`));
      return r?.access_token ?? null;
    },
    async clearCredentials(deviceId) {
      await req(`/device_credentials?device_id=eq.${q(deviceId)}`, { method: 'DELETE' });
    },

    async listZones(eventId) {
      const rows = await req(`/zones?select=${ZONE_COLS}&mole_event_id=eq.${q(eventId)}&order=created_at.asc`);
      return rows.map(toZone);
    },
    async getZone(id) {
      const r = one(await req(`/zones?select=${ZONE_COLS}&id=eq.${q(id)}`));
      return r ? toZone(r) : null;
    },
    async insertZone({ eventId, orgId, name, kind, createdBy }) {
      const rows = await req(`/zones?select=${ZONE_COLS}`, {
        method: 'POST',
        body: JSON.stringify({ mole_event_id: eventId, mole_org_id: orgId, name, kind, created_by: createdBy }),
      }, 'return=representation');
      return toZone(rows[0]);
    },
    async updateZone(id, patch) {
      const rows = await req(`/zones?select=${ZONE_COLS}&id=eq.${q(id)}`, {
        method: 'PATCH', body: JSON.stringify(patch),
      }, 'return=representation');
      if (!rows?.[0]) throw new ApiError('not_found', 'That zone is gone.');
      return toZone(rows[0]);
    },
    async deleteZone(id) {
      await req(`/zones?id=eq.${q(id)}`, { method: 'DELETE' });
    },

    async report(eventId, pq) {
      const raw = await req('/rpc/presence_report', {
        method: 'POST',
        body: JSON.stringify({
          p_event_id: eventId, p_from: pq.from, p_to: pq.to, p_threshold_minutes: pq.thresholdMinutes,
          p_zone_id: pq.zoneId, p_bucket_seconds: pq.bucketSeconds,
        }),
      });
      return normaliseReport(raw);
    },
    async ingest(deviceId, rows) {
      return req('/rpc/ingest_presence', { method: 'POST', body: JSON.stringify({ p_device_id: deviceId, p_rows: rows }) });
    },
    async recordDelivery(id, kind) {
      try {
        await req('/webhook_receipts', { method: 'POST', body: JSON.stringify({ delivery_id: id, kind }) });
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.code === 'conflict') return false;
        throw e;
      }
    },
    async ping() {
      try {
        await req('/zones?select=id&limit=1');
        return true;
      } catch {
        return false;
      }
    },
  };
}

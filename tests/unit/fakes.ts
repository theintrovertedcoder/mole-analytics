// In-memory stand-ins for the three things the edge functions talk to.
// The memory store mirrors the database's own refusals (one live pairing per
// code, a zone with history cannot be deleted) so the routes are tested
// against the same answers Postgres gives; tests/db/run.mjs proves Postgres
// gives them.

import type { MoleEvent, MoleOrg, PresenceReport } from '../../supabase/functions/_shared/contract.ts';
import { ApiError } from '../../supabase/functions/_shared/http.ts';
import type { MoleClient } from '../../supabase/functions/_shared/mole.ts';
import type { Pairing, PlexyzClient } from '../../supabase/functions/_shared/plexyz.ts';
import { PlexyzRefusal } from '../../supabase/functions/_shared/plexyz.ts';
import { presenceReport, type PresenceSession } from '../../supabase/functions/_shared/presence.ts';
import type { DeviceRow, SessionIn, Store, ZoneRow } from '../../supabase/functions/_shared/store.ts';

let n = 0;
export const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

export function memoryStore() {
  const devices = new Map<string, DeviceRow>();
  const creds = new Map<string, string>();
  const zones = new Map<string, ZoneRow>();
  const sessions: (PresenceSession & { deviceId: string; sourceId: string })[] = [];
  const deliveries = new Set<string>();

  const store: Store = {
    async listDevices(orgId) { return [...devices.values()].filter(d => d.orgId === orgId); },
    async getDevice(id) { return devices.get(id) ?? null; },
    async deviceByRequest(r) { return [...devices.values()].find(d => d.plexyzRequestId === r) ?? null; },
    async activeDeviceByPlexyzId(p) { return [...devices.values()].find(d => d.plexyzDeviceId === p && d.status === 'active') ?? null; },
    async insertDevice({ orgId, code, label }) {
      if ([...devices.values()].some(d => d.code === code && (d.status === 'pending_approval' || d.status === 'active'))) {
        throw new ApiError('conflict', 'duplicate key value violates unique constraint "devices_one_live_pairing"');
      }
      const d: DeviceRow = {
        id: uuid(), orgId, code, label, status: 'pending_approval', zoneId: null,
        requestedAt: new Date().toISOString(), approvedAt: null, lastSeenAt: null, battery: null,
        plexyzRequestId: null, plexyzDeviceId: null,
      };
      devices.set(d.id, d);
      return d;
    },
    async updateDevice(id, patch) {
      const d = devices.get(id);
      if (!d) throw new ApiError('not_found', 'gone');
      const next = { ...d, ...patch } as DeviceRow;
      devices.set(id, next);
      return next;
    },
    async deleteDevice(id) { devices.delete(id); },
    async setCredentials(id, t) { creds.set(id, t); },
    async getCredentials(id) { return creds.get(id) ?? null; },
    async clearCredentials(id) { creds.delete(id); },
    async listZones(eventId) { return [...zones.values()].filter(z => z.eventId === eventId); },
    async getZone(id) { return zones.get(id) ?? null; },
    async insertZone({ eventId, orgId, name, kind }) {
      const z: ZoneRow = { id: uuid(), eventId, orgId, name, kind };
      zones.set(z.id, z);
      return z;
    },
    async updateZone(id, patch) {
      const z = zones.get(id);
      if (!z) throw new ApiError('not_found', 'gone');
      const next = { ...z, ...patch };
      zones.set(id, next);
      return next;
    },
    async deleteZone(id) {
      if (sessions.some(s => s.zoneId === id)) throw new ApiError('conflict', 'violates foreign key constraint');
      zones.delete(id);
      for (const d of devices.values()) if (d.zoneId === id) devices.set(d.id, { ...d, zoneId: null });
    },
    async report(eventId, q): Promise<PresenceReport> {
      const zs = [...zones.values()].filter(z => z.eventId === eventId);
      return presenceReport({ zones: zs, sessions, ...q });
    },
    async ingest(deviceId, rows: SessionIn[]) {
      const d = devices.get(deviceId);
      if (!d || d.status !== 'active' || !d.zoneId) return { received: rows.length, stored: 0, dropped_no_zone: rows.length };
      let stored = 0;
      for (const r of rows) {
        if (sessions.some(s => s.deviceId === deviceId && s.sourceId === r.source_id)) continue;
        if (Date.parse(r.ended_at) < Date.parse(r.started_at)) continue;
        sessions.push({ deviceId, sourceId: r.source_id, zoneId: d.zoneId, visitorKey: r.visitor_key, startedAt: r.started_at, endedAt: r.ended_at });
        stored++;
      }
      return { received: rows.length, stored, dropped_no_zone: 0 };
    },
    async recordDelivery(id) {
      if (deliveries.has(id)) return false;
      deliveries.add(id);
      return true;
    },
    async ping() { return true; },
  };
  return { store, devices, creds, zones, sessions };
}

/** Mole V3 as seen by one token per person. */
export function fakeMole(people: Record<string, { userId: string; orgs: MoleOrg[]; events: MoleEvent[] }>): MoleClient {
  return {
    async user(token) {
      const p = people[token];
      return p ? { id: p.userId, email: null } : null;
    },
    async orgs(token) { return people[token]?.orgs ?? []; },
    async event(token, id) { return people[token]?.events.find(e => e.id === id) ?? null; },
    async health() { return true; },
  };
}

export function fakePlexyz() {
  const requests = new Map<string, Pairing & { code: string }>();
  const revoked: string[] = [];
  const known = new Set(['PLX-0001', 'PLX-0002', 'PLX-0003']);
  const client: PlexyzClient = {
    async requestPairing({ code }) {
      if (!known.has(code)) throw new PlexyzRefusal('unknown_code', "PLExyz doesn't recognise that code.");
      const p = { requestId: `req-${code}`, state: 'pending' as const, deviceId: null, accessToken: null, code };
      requests.set(p.requestId, p);
      return p;
    },
    async getPairing(id) {
      const p = requests.get(id);
      if (!p) throw new Error('no such request');
      return p;
    },
    async revoke(deviceId) { revoked.push(deviceId); },
  };
  /** What happens when the owner clicks Allow in the PLExyz dashboard. */
  const approve = (code: string) => {
    const p = requests.get(`req-${code}`)!;
    requests.set(p.requestId, { ...p, state: 'approved', deviceId: `dev-${code}`, accessToken: `tok-${code}` });
  };
  return { client, approve, revoked, requests };
}

export function event(over: Partial<MoleEvent> & { id: string; orgId: string }): MoleEvent {
  return {
    title: 'KL Tech Week', slug: 'kl-tech-week', package: 'HOST', orgName: 'Org', venue: 'MITEC',
    startsAt: '2026-10-10T01:00:00.000Z', endsAt: '2026-10-10T10:00:00.000Z', hostName: null, isPublished: true,
    ...over,
  };
}

// src/data/sample/sampleBackend.ts
// ─────────────────────────────────────────────────────────────────────────────
// Sample mode: a whole made-up organisation, in memory.
// ─────────────────────────────────────────────────────────────────────────────
// It runs the server's own code wherever there is server code to run — the
// window and threshold rules (api.ts), the QR rules (qr.ts), the arithmetic
// (presence.ts) — so sample mode cannot show something the real product would
// refuse or compute differently. What it invents is only the input: an org,
// three events, sensors, and a day's visits from generate.ts.
//
// Every page shows the sample banner while this is the backend.
// ─────────────────────────────────────────────────────────────────────────────

import { eventWindow, presenceQuery } from '../../../supabase/functions/_shared/api.ts';
import type {
  Device, EventOutcomes, MoleEvent, MoleOrg, Zone, ZoneKind,
} from '../../../supabase/functions/_shared/contract.ts';
import { presenceReport, type PresenceSession } from '../../../supabase/functions/_shared/presence.ts';
import { parseDeviceQr, QR_REASON_TEXT } from '../../../supabase/functions/_shared/qr.ts';
import { UserFacingError, type Account, type Backend } from '../backend.ts';
import { generateSessions, rng } from './generate.ts';

const ORG = '5a5a5a5a-0000-4000-8000-000000000001';
const E_EXPO = '5a5a5a5a-0000-4000-8000-0000000000e1';
const E_STAND = '5a5a5a5a-0000-4000-8000-0000000000e2';
const E_MEETUP = '5a5a5a5a-0000-4000-8000-0000000000e3';

const org: MoleOrg = { orgId: ORG, orgName: 'Mole Asia Pacific (sample)', role: 'OWNER', scope: 'ORG' };

const events: MoleEvent[] = [
  {
    id: E_EXPO, title: 'KL Founders Expo', slug: 'kl-founders-expo', package: 'HOST', orgId: ORG, orgName: org.orgName,
    venue: 'MITEC, Kuala Lumpur', startsAt: '2026-10-03T01:00:00.000Z', endsAt: '2026-10-03T10:00:00.000Z', hostName: null, isPublished: true,
  },
  {
    id: E_STAND, title: 'Mole at KL Tech Week', slug: 'mole-at-kl-tech-week', package: 'EXHIBITOR', orgId: ORG, orgName: org.orgName,
    venue: 'KLCC Hall 4', startsAt: '2026-09-24T01:00:00.000Z', endsAt: '2026-09-24T09:00:00.000Z', hostName: 'KL Tech Week', isPublished: true,
  },
  {
    id: E_MEETUP, title: 'Mole Founders Meetup', slug: 'mole-founders-meetup', package: 'HOST', orgId: ORG, orgName: org.orgName,
    venue: 'Mole HQ, Bangsar', startsAt: '2026-11-14T11:00:00.000Z', endsAt: '2026-11-14T14:00:00.000Z', hostName: null, isPublished: false,
  },
];

let idn = 0;
const zid = () => `5a5a5a5a-0000-4000-9000-${String(++idn).padStart(12, '0')}`;
const did = () => `5a5a5a5a-0000-4000-a000-${String(++idn).padStart(12, '0')}`;

function buildWorld() {
  const zones: Zone[] = [];
  const add = (eventId: string, name: string, kind: ZoneKind) => {
    const z = { id: zid(), eventId, name, kind };
    zones.push(z);
    return z;
  };
  add(E_EXPO, 'Main hall', 'venue');
  add(E_EXPO, 'North entrance', 'entrance');
  for (const b of ['Booth A12 · TechFlow', 'Booth B04 · GreenLeaf', 'Booth C99 · Nexus', 'Booth D01 · Mole', 'Booth E07 · Kopi Labs']) add(E_EXPO, b, 'booth');
  add(E_EXPO, 'Stage room', 'room');
  add(E_STAND, 'Our stand', 'booth');

  const devices: Device[] = zones.map((z, i) => ({
    id: did(), orgId: ORG, code: `PLX-${(4100 + i).toString(16).toUpperCase()}`, label: `Sensor · ${z.name}`,
    status: 'active', zoneId: z.id, requestedAt: '2026-09-20T03:00:00.000Z', approvedAt: '2026-09-20T03:05:00.000Z',
    lastSeenAt: '2026-10-03T10:00:00.000Z', battery: 100 - i * 9,
  }));
  devices.push(
    { id: did(), orgId: ORG, code: 'PLX-SPARE1', label: 'Spare sensor', status: 'active', zoneId: null, requestedAt: '2026-09-28T03:00:00.000Z', approvedAt: '2026-09-28T03:10:00.000Z', lastSeenAt: null, battery: 64 },
    { id: did(), orgId: ORG, code: 'PLX-LOANED', label: 'Borrowed from the venue', status: 'rejected', zoneId: null, requestedAt: '2026-09-29T03:00:00.000Z', approvedAt: null, lastSeenAt: null, battery: null },
  );

  const zonesOf = (e: string) => zones.filter(z => z.eventId === e);
  const sessions: PresenceSession[] = [
    ...generateSessions({ zones: zonesOf(E_EXPO), start: events[0]!.startsAt!, end: events[0]!.endsAt!, visitors: 1400, seed: 42, staffPerBooth: 2 }),
    ...generateSessions({ zones: zonesOf(E_STAND), start: events[1]!.startsAt!, end: events[1]!.endsAt!, visitors: 380, seed: 7, staffPerBooth: 3 }),
  ];

  // Check-ins: a share of the people the entrance saw, at the time they came in.
  const r = rng(99);
  const entrance = zonesOf(E_EXPO).find(z => z.kind === 'entrance')!;
  const arrivals = new Map<string, number>();
  let arrived = 0;
  for (const s of sessions) {
    if (s.zoneId !== entrance.id || r() > 0.34) continue;
    const h = new Date(s.startedAt);
    h.setUTCMinutes(0, 0, 0);
    arrivals.set(h.toISOString(), (arrivals.get(h.toISOString()) ?? 0) + 1);
    arrived++;
  }
  const outcomes: Record<string, EventOutcomes> = {
    [E_EXPO]: {
      signups: arrived + 212, arrived, teamContacts: 46,
      arrivalsByHour: [...arrivals.entries()].sort().map(([hour, count]) => ({ hour, count })),
      window: eventWindow(events[0]!),
    },
    [E_STAND]: {
      signups: 61, arrived: 44, teamContacts: 27,
      arrivalsByHour: [], window: eventWindow(events[1]!),
    },
    [E_MEETUP]: { signups: 18, arrived: 0, teamContacts: 0, arrivalsByHour: [], window: eventWindow(events[2]!) },
  };
  return { zones, devices, sessions, outcomes };
}

const wait = (ms = 120) => new Promise(r => setTimeout(r, ms));

export function sampleBackend(): Backend {
  const w = buildWorld();
  let account: Account | null = { id: 'sample-user', email: 'you@example.com' };
  const listeners = new Set<(a: Account | null) => void>();
  const tell = () => listeners.forEach(l => l(account));

  const ev = (eventId: string) => {
    const e = events.find(x => x.id === eventId);
    if (!e) throw new UserFacingError('No such event, or you do not manage it.', 'not_found');
    return e;
  };
  const dev = (deviceId: string) => {
    const d = w.devices.find(x => x.id === deviceId);
    if (!d) throw new UserFacingError('No such sensor.', 'not_found');
    return d;
  };
  const replace = (d: Device) => {
    w.devices = w.devices.map(x => (x.id === d.id ? d : x));
    return d;
  };

  return {
    mode: 'sample',

    async account() { return account; },
    onAccountChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    async signInWithPassword(email) { await wait(); account = { id: 'sample-user', email }; tell(); },
    async sendEmailCode() { await wait(); },
    async signInWithEmailCode(email) { await wait(); account = { id: 'sample-user', email }; tell(); },
    async signInWithGoogle() { await wait(); account = { id: 'sample-user', email: 'you@example.com' }; tell(); },
    async signOut() { account = null; tell(); },

    async myOrgs() { await wait(); return [org]; },
    async myEvents() { await wait(); return events; },
    async event(eventId) { await wait(); return events.find(e => e.id === eventId) ?? null; },
    async outcomes(eventId) { await wait(); return w.outcomes[eventId] ?? null; },

    async zones(eventId) { await wait(); ev(eventId); return w.zones.filter(z => z.eventId === eventId); },
    async createZone(eventId, z) {
      await wait();
      ev(eventId);
      const name = z.name.trim();
      if (!name || name.length > 80) throw new UserFacingError('The zone name must be 1 to 80 characters.', 'invalid');
      const zone = { id: zid(), eventId, name, kind: z.kind };
      w.zones.push(zone);
      return zone;
    },
    async updateZone(zoneId, patch) {
      await wait();
      const z = w.zones.find(x => x.id === zoneId);
      if (!z) throw new UserFacingError('No such zone.', 'not_found');
      Object.assign(z, patch.name ? { name: patch.name.trim() } : {}, patch.kind ? { kind: patch.kind } : {});
      return { ...z };
    },
    async deleteZone(zoneId) {
      await wait();
      if (w.sessions.some(s => s.zoneId === zoneId)) {
        throw new UserFacingError('This zone already has visits counted in it, so deleting it would change past reports. Rename it instead.', 'conflict');
      }
      w.zones = w.zones.filter(z => z.id !== zoneId);
      w.devices = w.devices.map(d => (d.zoneId === zoneId ? { ...d, zoneId: null } : d));
    },

    async devices(orgId) { await wait(); return w.devices.filter(d => d.orgId === orgId); },
    async pairDevice(orgId, { code, label }) {
      await wait(400);
      const qr = parseDeviceQr(code);
      if (!qr.ok) throw new UserFacingError(QR_REASON_TEXT[qr.reason], 'invalid');
      if (w.devices.some(d => d.code === qr.code && (d.status === 'pending_approval' || d.status === 'active'))) {
        throw new UserFacingError('This sensor is already paired, or waiting for approval. Unpair it there first.', 'conflict');
      }
      const d: Device = {
        id: did(), orgId, code: qr.code, label: label.trim() || qr.code, status: 'pending_approval', zoneId: null,
        requestedAt: new Date().toISOString(), approvedAt: null, lastSeenAt: null, battery: null,
      };
      w.devices.unshift(d);
      return d;
    },
    async refreshDevice(deviceId) { await wait(); return dev(deviceId); },
    async updateDevice(deviceId, patch) {
      await wait();
      const d = dev(deviceId);
      if (patch.zoneId) {
        const z = w.zones.find(x => x.id === patch.zoneId);
        if (!z) throw new UserFacingError('No such zone.', 'not_found');
      }
      return replace({ ...d, ...(patch.label !== undefined ? { label: patch.label.trim() } : {}), ...('zoneId' in patch ? { zoneId: patch.zoneId ?? null } : {}) });
    },
    async unpairDevice(deviceId) {
      await wait();
      return { device: replace({ ...dev(deviceId), status: 'revoked', zoneId: null }), plexyzConfirmed: true };
    },

    async presence(eventId, q) {
      await wait(200);
      const e = ev(eventId);
      const zones = w.zones.filter(z => z.eventId === eventId);
      const url = new URL('https://sample.invalid/');
      if (q.from) url.searchParams.set('from', q.from);
      if (q.to) url.searchParams.set('to', q.to);
      if (q.thresholdMinutes != null) url.searchParams.set('threshold', String(q.thresholdMinutes));
      if (q.zoneId) url.searchParams.set('zone', q.zoneId);
      if (q.bucketSeconds) url.searchParams.set('bucket', String(q.bucketSeconds));
      let query;
      try {
        query = presenceQuery(url, e, zones.map(z => ({ ...z, orgId: ORG })));
      } catch (err) {
        throw new UserFacingError((err as Error).message, 'invalid');
      }
      return { query, report: presenceReport({ zones, sessions: w.sessions, ...query }) };
    },

    async simulateOwnerDecision(deviceId, decision) {
      await wait(300);
      const d = dev(deviceId);
      if (d.status !== 'pending_approval') return;
      replace(decision === 'approved'
        ? { ...d, status: 'active', approvedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), battery: 100 }
        : { ...d, status: 'rejected' });
    },
  };
}

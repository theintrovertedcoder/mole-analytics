// supabase/functions/_shared/api.ts
// ─────────────────────────────────────────────────────────────────────────────
// The `api` edge function: everything the app asks this product's backend.
// ─────────────────────────────────────────────────────────────────────────────
// Every route answers one question first: may THIS Mole user touch THIS thing?
//
//   an org's sensors   → the org is in api_v1_my_orgs for this user
//                        (an OWNER or ADMIN whose scope covers events)
//   an event's zones   → api_v1_event returns the event for this user
//   and its numbers      (Mole V3's own can_manage_event decides)
//   a sensor or zone   → look up its org or event here, then ask as above
//   by id
//
// A thing that exists but is not yours answers 404, the same as one that does
// not exist, so ids cannot be probed for existence.
//
// Written as a factory over its dependencies so the tests can drive every
// route with a fake Mole, a fake PLExyz and an in-memory store.
// ─────────────────────────────────────────────────────────────────────────────

import type { MoleEvent, PresenceQuery, ZoneKind } from './contract.ts';
import { ZONE_KINDS } from './contract.ts';
import { ApiError, corsHeaders, errorResponse, json, readJson } from './http.ts';
import type { MoleClient, MoleUser } from './mole.ts';
import { PlexyzRefusal, type Pairing, type PlexyzClient } from './plexyz.ts';
import { clampThreshold } from './presence.ts';
import { parseDeviceQr, QR_REASON_TEXT } from './qr.ts';
import { publicDevice, type DeviceRow, type Store, type ZoneRow } from './store.ts';

export interface ApiDeps {
  mole: MoleClient | null;
  store: Store | null;
  /** Null until PLExyz credentials are set. Pairing says so plainly. */
  plexyz: PlexyzClient | null;
  allowedOrigins: string[];
  /** Where PLExyz should send pairing updates for this deployment. */
  webhookUrl: string;
  now?: () => Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_WINDOW_DAYS = 366;

type ReadyDeps = Omit<ApiDeps, 'mole' | 'store'> & { mole: MoleClient; store: Store };
type Ctx = { req: Request; url: URL; user: MoleUser; token: string; deps: ReadyDeps };

function cleanLabel(v: unknown, what: string): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (s.length < 1 || s.length > 80) throw new ApiError('invalid', `${what} must be 1 to 80 characters.`);
  return s;
}

function zoneKind(v: unknown): ZoneKind {
  if (typeof v === 'string' && (ZONE_KINDS as readonly string[]).includes(v)) return v as ZoneKind;
  throw new ApiError('invalid', `Zone type must be one of: ${ZONE_KINDS.join(', ')}.`);
}

async function requireOrg(c: Ctx, orgId: string) {
  if (!UUID.test(orgId)) throw new ApiError('not_found', 'No such organisation.');
  const org = (await c.deps.mole.orgs(c.token)).find(o => o.orgId === orgId);
  if (!org) throw new ApiError('not_found', 'No such organisation, or you do not manage it.');
  return org;
}

async function requireEvent(c: Ctx, eventId: string): Promise<MoleEvent> {
  if (!UUID.test(eventId)) throw new ApiError('not_found', 'No such event.');
  const ev = await c.deps.mole.event(c.token, eventId);
  if (!ev) throw new ApiError('not_found', 'No such event, or you do not manage it.');
  return ev;
}

async function requireDevice(c: Ctx, id: string): Promise<DeviceRow> {
  const d = UUID.test(id) ? await c.deps.store.getDevice(id) : null;
  if (!d) throw new ApiError('not_found', 'No such sensor.');
  await requireOrg(c, d.orgId).catch(() => { throw new ApiError('not_found', 'No such sensor.'); });
  return d;
}

async function requireZone(c: Ctx, id: string): Promise<ZoneRow> {
  const z = UUID.test(id) ? await c.deps.store.getZone(id) : null;
  if (!z) throw new ApiError('not_found', 'No such zone.');
  await requireEvent(c, z.eventId).catch(() => { throw new ApiError('not_found', 'No such zone.'); });
  return z;
}

/** The window an event's numbers cover by default: its own start and end. */
export function eventWindow(ev: MoleEvent): { from: string; to: string } | null {
  if (!ev.startsAt) return null;
  const from = new Date(ev.startsAt);
  const to = ev.endsAt ? new Date(ev.endsAt) : new Date(from.getTime() + 24 * 3600 * 1000);
  return to > from ? { from: from.toISOString(), to: to.toISOString() } : null;
}

export function presenceQuery(url: URL, ev: MoleEvent, zones: ZoneRow[]): PresenceQuery {
  const def = eventWindow(ev);
  const fromS = url.searchParams.get('from') ?? def?.from;
  const toS = url.searchParams.get('to') ?? def?.to;
  if (!fromS || !toS) {
    throw new ApiError('invalid', 'This event has no date in Mole yet, so there is no window to count. Add a date in Mole first.');
  }
  const from = new Date(fromS), to = new Date(toS);
  if (Number.isNaN(+from) || Number.isNaN(+to) || to <= from) throw new ApiError('invalid', 'The time window is not valid.');
  if (+to - +from > MAX_WINDOW_DAYS * 86_400_000) throw new ApiError('invalid', 'The window can be at most a year.');

  const zoneId = url.searchParams.get('zone') || null;
  if (zoneId && !zones.some(z => z.id === zoneId)) throw new ApiError('invalid', 'That zone is not part of this event.');

  const bucket = Number(url.searchParams.get('bucket') ?? 3600);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    thresholdMinutes: clampThreshold(url.searchParams.get('threshold') ?? undefined),
    zoneId,
    bucketSeconds: Number.isFinite(bucket) ? Math.max(300, Math.min(86_400, Math.round(bucket))) : 3600,
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

type Handler = (c: Ctx, p: Record<string, string>) => Promise<Response>;
const routes: [string, RegExp, Handler][] = [];
const route = (method: string, pattern: string, h: Handler) => {
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$');
  routes.push([method, re, h]);
};

route('GET', '/orgs/:orgId/devices', async (c, p) => {
  await requireOrg(c, p.orgId!);
  return json({ devices: (await c.deps.store.listDevices(p.orgId!)).map(publicDevice) });
});

route('POST', '/orgs/:orgId/devices', async (c, p) => {
  const org = await requireOrg(c, p.orgId!);
  const body = await readJson(c.req);
  const qr = parseDeviceQr(String(body.code ?? ''));
  if (!qr.ok) throw new ApiError('invalid', QR_REASON_TEXT[qr.reason]);
  const label = cleanLabel(body.label ?? qr.code, 'The name');
  if (!c.deps.plexyz) {
    throw new ApiError('not_configured', "PLExyz isn't connected to Mole Sense yet, so sensors can't be paired. Nothing was saved.");
  }

  // Row first, then PLExyz: the unique index on a live pairing is what stops
  // two people pairing the same sensor at the same moment, and it can only do
  // that if the row exists before anybody calls out.
  let row: DeviceRow;
  try {
    row = await c.deps.store.insertDevice({ orgId: org.orgId, code: qr.code, label, requestedBy: c.user.id });
  } catch (e) {
    if (e instanceof ApiError && e.code === 'conflict') {
      throw new ApiError('conflict', 'This sensor is already paired, or waiting for approval. Unpair it there first.');
    }
    throw e;
  }

  try {
    const pairing = await c.deps.plexyz.requestPairing({ code: qr.code, orgName: org.orgName, label, callbackUrl: c.deps.webhookUrl });
    row = await c.deps.store.updateDevice(row.id, { plexyzRequestId: pairing.requestId });
    // Some systems approve at once for a device the owner already trusts.
    if (pairing.state !== 'pending') row = await applyPairing(c.deps.store, row, pairing, c.deps.now?.() ?? new Date());
    return json({ device: publicDevice(row) }, 201);
  } catch (e) {
    // PLExyz said no, or did not answer: take the row back out, so the sensor
    // is not left "waiting for approval" for a request that was never made.
    await c.deps.store.deleteDevice(row.id).catch(() => undefined);
    if (e instanceof PlexyzRefusal) {
      throw new ApiError(e.kind === 'unknown_code' ? 'not_found' : 'conflict', e.message);
    }
    throw e;
  }
});

route('POST', '/devices/:id/refresh', async (c, p) => {
  let d = await requireDevice(c, p.id!);
  if (d.status === 'pending_approval' && d.plexyzRequestId && c.deps.plexyz) {
    const pairing = await c.deps.plexyz.getPairing(d.plexyzRequestId);
    d = await applyPairing(c.deps.store, d, pairing, c.deps.now?.() ?? new Date());
  }
  return json({ device: publicDevice(d) });
});

route('PATCH', '/devices/:id', async (c, p) => {
  const d = await requireDevice(c, p.id!);
  const body = await readJson(c.req);
  const patch: { label?: string; zoneId?: string | null } = {};
  if ('label' in body) patch.label = cleanLabel(body.label, 'The name');
  if ('zoneId' in body) {
    if (body.zoneId === null) {
      patch.zoneId = null;
    } else {
      const z = await requireZone(c, String(body.zoneId));
      // A sensor can only count for its own org's events.
      if (z.orgId !== d.orgId) throw new ApiError('invalid', "That zone belongs to another organisation's event.");
      patch.zoneId = z.id;
    }
  }
  return json({ device: publicDevice(await c.deps.store.updateDevice(d.id, patch)) });
});

route('DELETE', '/devices/:id', async (c, p) => {
  const d = await requireDevice(c, p.id!);
  let plexyzConfirmed = true;
  if (d.status === 'active' && d.plexyzDeviceId && c.deps.plexyz) {
    const token = await c.deps.store.getCredentials(d.id);
    if (token) {
      try {
        await c.deps.plexyz.revoke(d.plexyzDeviceId, token);
      } catch (e) {
        // Unpaired here regardless: ingest stores nothing from a revoked
        // sensor, so nothing more is counted even if PLExyz keeps sending.
        console.error('plexyz revoke failed', e);
        plexyzConfirmed = false;
      }
    }
  }
  await c.deps.store.clearCredentials(d.id);
  const next = await c.deps.store.updateDevice(d.id, { status: 'revoked', zoneId: null });
  return json({ device: publicDevice(next), plexyzConfirmed });
});

route('GET', '/events/:eventId/zones', async (c, p) => {
  await requireEvent(c, p.eventId!);
  return json({ zones: (await c.deps.store.listZones(p.eventId!)).map(({ orgId: _o, ...z }) => z) });
});

route('POST', '/events/:eventId/zones', async (c, p) => {
  const ev = await requireEvent(c, p.eventId!);
  const body = await readJson(c.req);
  const z = await c.deps.store.insertZone({
    eventId: ev.id, orgId: ev.orgId, name: cleanLabel(body.name, 'The zone name'), kind: zoneKind(body.kind), createdBy: c.user.id,
  });
  const { orgId: _o, ...zone } = z;
  return json({ zone }, 201);
});

route('PATCH', '/zones/:id', async (c, p) => {
  const z = await requireZone(c, p.id!);
  const body = await readJson(c.req);
  const patch: { name?: string; kind?: ZoneKind } = {};
  if ('name' in body) patch.name = cleanLabel(body.name, 'The zone name');
  if ('kind' in body) patch.kind = zoneKind(body.kind);
  const { orgId: _o, ...zone } = await c.deps.store.updateZone(z.id, patch);
  return json({ zone });
});

route('DELETE', '/zones/:id', async (c, p) => {
  const z = await requireZone(c, p.id!);
  try {
    await c.deps.store.deleteZone(z.id);
  } catch (e) {
    if (e instanceof ApiError && e.code === 'conflict') {
      throw new ApiError('conflict', "This zone already has visits counted in it, so deleting it would change past reports. Rename it instead.");
    }
    throw e;
  }
  return json({ deleted: true });
});

route('GET', '/events/:eventId/presence', async (c, p) => {
  const ev = await requireEvent(c, p.eventId!);
  const zones = await c.deps.store.listZones(ev.id);
  const q = presenceQuery(c.url, ev, zones);
  return json({ query: q, report: await c.deps.store.report(ev.id, q) });
});

// ── Pairing state ────────────────────────────────────────────────────────────


/** Applies what PLExyz says to a device that is waiting. Shared with the webhook. */
export async function applyPairing(store: Store, d: DeviceRow, pairing: Pairing, now: Date): Promise<DeviceRow> {
  if (d.status !== 'pending_approval') return d; // a late or repeated answer changes nothing
  if (pairing.state === 'approved') {
    if (!pairing.deviceId) {
      console.error('plexyz approved without a device id', pairing.requestId);
      return d;
    }
    if (pairing.accessToken) await store.setCredentials(d.id, pairing.accessToken);
    return store.updateDevice(d.id, { status: 'active', plexyzDeviceId: pairing.deviceId, approvedAt: now.toISOString() });
  }
  if (pairing.state === 'rejected' || pairing.state === 'expired') {
    return store.updateDevice(d.id, { status: pairing.state });
  }
  return d;
}

// ── The handler ──────────────────────────────────────────────────────────────

export function createApiHandler(deps: ApiDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    const cors = corsHeaders(req.headers.get('origin'), deps.allowedOrigins);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);
    // Supabase serves this at /functions/v1/api/…; locally it may be /api/….
    const path = url.pathname.replace(/^\/functions\/v1/, '').replace(/^\/api/, '') || '/';

    try {
      // A check Haziq can open in a browser tab. Says what is connected and
      // nothing about any value.
      if (req.method === 'GET' && path === '/health') {
        const [db, mole] = await Promise.all([
          deps.store ? deps.store.ping() : Promise.resolve(false),
          deps.mole ? deps.mole.health() : Promise.resolve(false),
        ]);
        return json({ ok: db && mole, database: db, moleV3: mole, plexyz: !!deps.plexyz }, 200, cors);
      }

      if (!deps.mole || !deps.store) {
        throw new ApiError('not_configured', 'This backend is missing its settings. See docs/YOUR_TURN.md.');
      }

      const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
      const user = token ? await deps.mole.user(token) : null;
      if (!user) throw new ApiError('unauthenticated', 'Sign in with your Mole account.');

      for (const [method, re, h] of routes) {
        const m = re.exec(path);
        if (m && method === req.method) {
          const res = await h({ req, url, user, token, deps: deps as ReadyDeps }, { ...(m.groups ?? {}) });
          for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
          return res;
        }
      }
      throw new ApiError('not_found', 'No such endpoint.');
    } catch (e) {
      return errorResponse(e, cors);
    }
  };
}

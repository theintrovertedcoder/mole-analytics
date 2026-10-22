// src/data/live/transport.ts
// ─────────────────────────────────────────────────────────────────────────────
// The data half of the live backend, one interface with two ways to reach it.
// ─────────────────────────────────────────────────────────────────────────────
//   direct    Mole V3's api_v1_* functions for orgs, events and outcomes, and
//             this product's own `api` function for zones, sensors and numbers.
//             Two doors, each with its own error shape. What the app did first.
//
//   gateway   Everything through the Mole API (api.mole.is/v1): one door, one
//             error shape (problem+json with a request id), rate limits, and
//             the same rules for every caller (mole-api audit MS-03).
//
// Sign-in stays with Mole V3 either way (liveBackend.ts); a transport only needs
// a way to get the signed-in person's token. Screens never know which transport
// they have. Adding a route is one method here in each transport, and the
// Backend interface says which.
// ─────────────────────────────────────────────────────────────────────────────

import type { EventOutcomes, PresenceQuery } from '../../../supabase/functions/_shared/contract.ts';
import { mapEvent, mapOrg } from '../../../supabase/functions/_shared/mole.ts';
import { UserFacingError, type Backend } from '../backend.ts';

export type DataTransport = Pick<
  Backend,
  | 'myOrgs' | 'myEvents' | 'event' | 'outcomes'
  | 'zones' | 'createZone' | 'updateZone' | 'deleteZone'
  | 'devices' | 'pairDevice' | 'refreshDevice' | 'updateDevice' | 'unpairDevice'
  | 'presence'
>;

/** The signed-in person's Mole V3 token; throws "sign in" when there is none. */
export type TokenSource = () => Promise<string>;

export function mapOutcomes(raw: any): EventOutcomes | null {
  if (!raw) return null;
  return {
    signups: Number(raw.signups ?? 0),
    arrived: Number(raw.arrived ?? 0),
    teamContacts: raw.team_contacts == null ? null : Number(raw.team_contacts),
    arrivalsByHour: (raw.arrivals_by_hour ?? []).map((h: any) => ({ hour: new Date(h.hour).toISOString(), count: Number(h.count) })),
    window: raw.window ? { from: new Date(raw.window.from).toISOString(), to: new Date(raw.window.to).toISOString() } : null,
  };
}

/** The presence query as URL parameters, the same for both transports. */
export function presenceParams(q: Partial<PresenceQuery>): string {
  const p = new URLSearchParams();
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  if (q.thresholdMinutes != null) p.set('threshold', String(q.thresholdMinutes));
  if (q.zoneId) p.set('zone', q.zoneId);
  if (q.bucketSeconds) p.set('bucket', String(q.bucketSeconds));
  return p.toString();
}

// ── direct ───────────────────────────────────────────────────────────────────

export interface DirectDeps {
  /** A Mole V3 api_v1_* function, called as the signed-in person. */
  rpc<T>(fn: `api_v1_${string}`, args?: Record<string, unknown>): Promise<T>;
  /** This product's `api` function; answers its own `{ zones }`, `{ device }`… shapes. */
  api<T>(method: string, path: string, body?: unknown): Promise<T>;
}

export function directTransport({ rpc, api }: DirectDeps): DataTransport {
  return {
    async myOrgs() { return (await rpc<any[]>('api_v1_my_orgs')).map(mapOrg); },
    async myEvents() { return (await rpc<any[]>('api_v1_my_events')).map(mapEvent); },
    async event(id) {
      const rows = await rpc<any[]>('api_v1_event', { p_event_id: id });
      return rows[0] ? mapEvent(rows[0]) : null;
    },
    async outcomes(eventId) { return mapOutcomes(await rpc<any>('api_v1_event_outcomes', { p_event_id: eventId })); },

    async zones(eventId) { return (await api<{ zones: any[] }>('GET', `/events/${eventId}/zones`)).zones; },
    async createZone(eventId, z) { return (await api<{ zone: any }>('POST', `/events/${eventId}/zones`, z)).zone; },
    async updateZone(id, patch) { return (await api<{ zone: any }>('PATCH', `/zones/${id}`, patch)).zone; },
    async deleteZone(id) { await api('DELETE', `/zones/${id}`); },

    async devices(orgId) { return (await api<{ devices: any[] }>('GET', `/orgs/${orgId}/devices`)).devices; },
    async pairDevice(orgId, d) { return (await api<{ device: any }>('POST', `/orgs/${orgId}/devices`, d)).device; },
    async refreshDevice(id) { return (await api<{ device: any }>('POST', `/devices/${id}/refresh`)).device; },
    async updateDevice(id, patch) { return (await api<{ device: any }>('PATCH', `/devices/${id}`, patch)).device; },
    async unpairDevice(id) { return api('DELETE', `/devices/${id}`); },

    async presence(eventId, q) { return api('GET', `/events/${eventId}/presence?${presenceParams(q)}`); },
  };
}

// ── gateway ──────────────────────────────────────────────────────────────────

/**
 * Everything through the Mole API. It answers `{ data, meta }`, and on failure
 * RFC 9457 problem+json: `{ code, detail, request_id }`. The detail is already
 * written for a person, so it is shown as it is.
 */
export function gatewayTransport(baseUrl: string, token: TokenSource, f: typeof fetch = (...a) => fetch(...a)): DataTransport {
  const base = `${baseUrl.replace(/\/+$/, '')}/v1`;

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await f(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${await token()}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      if (e instanceof UserFacingError) throw e;
      throw new UserFacingError("Couldn't reach Mole. Check your connection and try again.", 'unavailable');
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new UserFacingError(
        json?.detail ?? json?.title ?? 'Something went wrong. Try again in a minute.',
        json?.code ?? 'error',
        json?.request_id ?? res.headers.get('x-request-id') ?? undefined,
      );
    }
    return json?.data as T;
  }

  /** "Not yours" and "not there" are the same 404; both mean "nothing to show". */
  async function orNull<T>(p: Promise<T>): Promise<T | null> {
    try {
      return await p;
    } catch (e) {
      if (e instanceof UserFacingError && e.code === 'not_found') return null;
      throw e;
    }
  }

  return {
    async myOrgs() { return (await call<any[]>('GET', '/orgs')).map(mapOrg); },
    async myEvents() { return (await call<any[]>('GET', '/events')).map(mapEvent); },
    async event(id) {
      const row = await orNull(call<any>('GET', `/events/${id}`));
      return row ? mapEvent(row) : null;
    },
    async outcomes(eventId) { return mapOutcomes(await orNull(call<any>('GET', `/events/${eventId}/outcomes`))); },

    zones: (eventId) => call('GET', `/events/${eventId}/zones`),
    createZone: (eventId, z) => call('POST', `/events/${eventId}/zones`, z),
    updateZone: (id, patch) => call('PATCH', `/zones/${id}`, patch),
    async deleteZone(id) { await call('DELETE', `/zones/${id}`); },

    devices: (orgId) => call('GET', `/orgs/${orgId}/devices`),
    pairDevice: (orgId, d) => call('POST', `/orgs/${orgId}/devices`, d),
    refreshDevice: (id) => call('POST', `/devices/${id}/refresh`),
    updateDevice: (id, patch) => call('PATCH', `/devices/${id}`, patch),
    unpairDevice: (id) => call('DELETE', `/devices/${id}`),

    presence: (eventId, q) => call('GET', `/events/${eventId}/presence?${presenceParams(q)}`),
  };
}

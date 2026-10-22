// The two ways the live app reaches its data (src/data/live/transport.ts): the
// same answers either way, and the gateway's own error shape read correctly.
import { describe, expect, it } from 'vitest';
import { readLiveConfig } from '../../src/config/env.ts';
import { UserFacingError } from '../../src/data/backend.ts';
import { directTransport, gatewayTransport, type DataTransport } from '../../src/data/live/transport.ts';
import { uuid } from './fakes.ts';

const ORG = uuid(), EV = uuid(), ZONE = uuid(), DEV = uuid();
// What Mole V3's api_v1_* functions return (snake case), and what Mole Sense's api returns.
const orgRow = { org_id: ORG, org_name: 'Org A', role: 'ADMIN', scope: 'ORG' };
const eventRow = { id: EV, title: 'KL Tech Week', slug: 'kl', package: 'HOST', org_id: ORG, org_name: 'Org A', venue: 'MITEC', starts_at: '2026-10-10T01:00:00Z', ends_at: '2026-10-10T10:00:00Z', host_name: null, is_published: true };
const outcomesRow = { signups: 120, arrived: 80, team_contacts: 12, arrivals_by_hour: [{ hour: '2026-10-10T01:00:00Z', count: 30 }], window: { from: '2026-10-10T01:00:00Z', to: '2026-10-10T10:00:00Z' } };
const zone = { id: ZONE, eventId: EV, name: 'Hall', kind: 'room' };
const device = { id: DEV, orgId: ORG, label: 'Door', status: 'active' };
const presence = { query: { from: 'a', to: 'b', thresholdMinutes: 5, zoneId: null, bucketSeconds: 3600 }, report: { funnel: {} } };

/** Mole V3 and Mole Sense as the direct transport sees them. */
function direct(): DataTransport {
  return directTransport({
    async rpc(fn, args) {
      if (fn === 'api_v1_my_orgs') return [orgRow] as never;
      if (fn === 'api_v1_my_events') return [eventRow] as never;
      if (fn === 'api_v1_event') return (args?.p_event_id === EV ? [eventRow] : []) as never;
      if (fn === 'api_v1_event_outcomes') return (args?.p_event_id === EV ? outcomesRow : null) as never;
      throw new Error(fn);
    },
    async api(method, path) {
      const key = `${method} ${path.split('?')[0]}`;
      const answers: Record<string, unknown> = {
        [`GET /events/${EV}/zones`]: { zones: [zone] },
        [`POST /events/${EV}/zones`]: { zone },
        [`PATCH /zones/${ZONE}`]: { zone },
        [`DELETE /zones/${ZONE}`]: { deleted: true },
        [`GET /orgs/${ORG}/devices`]: { devices: [device] },
        [`POST /orgs/${ORG}/devices`]: { device },
        [`POST /devices/${DEV}/refresh`]: { device },
        [`PATCH /devices/${DEV}`]: { device },
        [`DELETE /devices/${DEV}`]: { device, plexyzConfirmed: true },
        [`GET /events/${EV}/presence`]: presence,
      };
      if (!(key in answers)) throw new Error(key);
      return answers[key] as never;
    },
  });
}

/** The Mole API as the gateway transport sees it: `{ data, meta }`, problem+json on failure. */
function gateway(log: { url: string; init: RequestInit }[] = []): DataTransport {
  const ok = (data: unknown) => new Response(JSON.stringify({ data, meta: { request_id: 'req_1' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  const notFound = () => new Response(JSON.stringify({ code: 'not_found', detail: "No event with that id, or it isn't yours.", request_id: 'req_404', status: 404 }), { status: 404 });
  const f = (async (url: string, init: RequestInit) => {
    log.push({ url, init });
    const path = new URL(url).pathname;
    const key = `${init.method} ${path}`;
    const answers: Record<string, unknown> = {
      'GET /v1/orgs': [orgRow],
      'GET /v1/events': [eventRow],
      [`GET /v1/events/${EV}`]: eventRow,
      [`GET /v1/events/${EV}/outcomes`]: outcomesRow,
      [`GET /v1/events/${EV}/zones`]: [zone],
      [`POST /v1/events/${EV}/zones`]: zone,
      [`PATCH /v1/zones/${ZONE}`]: zone,
      [`DELETE /v1/zones/${ZONE}`]: { deleted: true },
      [`GET /v1/orgs/${ORG}/devices`]: [device],
      [`POST /v1/orgs/${ORG}/devices`]: device,
      [`POST /v1/devices/${DEV}/refresh`]: device,
      [`PATCH /v1/devices/${DEV}`]: device,
      [`DELETE /v1/devices/${DEV}`]: { device, plexyzConfirmed: true },
      [`GET /v1/events/${EV}/presence`]: presence,
    };
    return key in answers ? ok(answers[key]) : notFound();
  }) as unknown as typeof fetch;
  return gatewayTransport('https://api.mole.is/', async () => 'token-abc', f);
}

describe('the two transports give the same answers', () => {
  it('for every method a screen can call', async () => {
    const run = async (t: DataTransport) => ({
      orgs: await t.myOrgs(),
      events: await t.myEvents(),
      event: await t.event(EV),
      missing: await t.event(uuid()),
      outcomes: await t.outcomes(EV),
      noOutcomes: await t.outcomes(uuid()),
      zones: await t.zones(EV),
      createZone: await t.createZone(EV, { name: 'Hall', kind: 'room' }),
      updateZone: await t.updateZone(ZONE, { name: 'Hall' }),
      deleteZone: await t.deleteZone(ZONE),
      devices: await t.devices(ORG),
      pair: await t.pairDevice(ORG, { code: 'PLX-0001', label: 'Door' }),
      refresh: await t.refreshDevice(DEV),
      updateDevice: await t.updateDevice(DEV, { label: 'Door' }),
      unpair: await t.unpairDevice(DEV),
      presence: await t.presence(EV, { bucketSeconds: 3600 }),
    });
    const d = await run(direct());
    expect(await run(gateway())).toEqual(d);
    expect(d.orgs).toEqual([{ orgId: ORG, orgName: 'Org A', role: 'ADMIN', scope: 'ORG' }]);
    expect(d.missing).toBeNull();
    expect(d.outcomes?.arrived).toBe(80);
  });
});

describe('the gateway transport', () => {
  it('calls /v1 on the gateway with the person\'s token, and JSON only when there is a body', async () => {
    const log: { url: string; init: RequestInit }[] = [];
    const t = gateway(log);
    await t.myOrgs();
    await t.createZone(EV, { name: 'Hall', kind: 'room' });
    await t.presence(EV, { bucketSeconds: 900, zoneId: ZONE });
    expect(log[0]!.url).toBe('https://api.mole.is/v1/orgs');
    expect((log[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer token-abc');
    expect((log[0]!.init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect((log[1]!.init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(log[1]!.init.body).toBe(JSON.stringify({ name: 'Hall', kind: 'room' }));
    expect(log[2]!.url).toBe(`https://api.mole.is/v1/events/${EV}/presence?zone=${ZONE}&bucket=900`);
  });

  it('shows the gateway\'s own words, code and request id when it refuses', async () => {
    const f = (async () => new Response(JSON.stringify({ code: 'rate_limited', detail: 'Too many requests. Try again in 3 s.', request_id: 'req_429' }), { status: 429 })) as unknown as typeof fetch;
    const e = await gatewayTransport('https://api.mole.is', async () => 't', f).myOrgs().catch(x => x);
    expect(e).toBeInstanceOf(UserFacingError);
    expect(e.message).toBe('Too many requests. Try again in 3 s.');
    expect(e.code).toBe('rate_limited');
    expect(e.requestId).toBe('req_429');
  });

  it('a 404 on a list is still an error, not an empty list', async () => {
    const f = (async () => new Response(JSON.stringify({ code: 'not_found', detail: 'No such organisation.' }), { status: 404 })) as unknown as typeof fetch;
    await expect(gatewayTransport('https://api.mole.is', async () => 't', f).devices(ORG)).rejects.toThrow('No such organisation.');
  });

  it('no connection is a plain message; no sign-in is asked for before any call', async () => {
    const down = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    const e = await gatewayTransport('https://api.mole.is', async () => 't', down).myEvents().catch(x => x);
    expect(e.code).toBe('unavailable');
    expect(e.message).toMatch(/Couldn't reach Mole/);
    let called = false;
    const spy = (async () => { called = true; return new Response('{}'); }) as unknown as typeof fetch;
    const noSession = async () => { throw new UserFacingError('Sign in with your Mole account.', 'unauthenticated'); };
    await expect(gatewayTransport('https://api.mole.is', noSession, spy).myOrgs()).rejects.toThrow('Sign in');
    expect(called).toBe(false);
  });
});

describe('which transport a build uses', () => {
  const base = { VITE_MOLE_SUPABASE_URL: 'https://v3.supabase.co', VITE_MOLE_SUPABASE_ANON_KEY: 'sb_publishable_x' };
  it('the gateway alone is enough; trailing slashes are trimmed', () => {
    expect(readLiveConfig({ ...base, VITE_MOLE_API_URL: 'https://api.mole.is/' })).toMatchObject({ gatewayUrl: 'https://api.mole.is', apiUrl: null });
  });
  it('the direct function alone still works, as before', () => {
    expect(readLiveConfig({ ...base, VITE_ANALYTICS_API_URL: 'https://s.supabase.co/functions/v1/api' })).toMatchObject({ gatewayUrl: null });
  });
  it('without either, or without Mole V3, it is not live (never sample data by accident)', () => {
    expect(readLiveConfig(base)).toBeNull();
    expect(readLiveConfig({ VITE_MOLE_API_URL: 'https://api.mole.is' })).toBeNull();
  });
});

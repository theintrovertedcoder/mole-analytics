import { beforeEach, describe, expect, it } from 'vitest';
import { createApiHandler } from '../../supabase/functions/_shared/api.ts';
import type { MoleOrg } from '../../supabase/functions/_shared/contract.ts';
import { event, fakeMole, fakePlexyz, memoryStore, uuid } from './fakes.ts';

const ORIGIN = 'https://analytics.mole.is';
const ORG_A = uuid(), ORG_B = uuid();
const EV_A = uuid(), EV_B = uuid();
const orgA: MoleOrg = { orgId: ORG_A, orgName: 'Org A', role: 'ADMIN', scope: 'ORG' };
const orgB: MoleOrg = { orgId: ORG_B, orgName: 'Org B', role: 'OWNER', scope: 'ORG' };

let mem: ReturnType<typeof memoryStore>;
let plx: ReturnType<typeof fakePlexyz>;
let call: (method: string, path: string, opts?: { token?: string; body?: unknown; origin?: string }) => Promise<{ status: number; body: any; headers: Headers }>;

function setup(withPlexyz = true) {
  mem = memoryStore();
  plx = fakePlexyz();
  const handler = createApiHandler({
    store: mem.store,
    mole: fakeMole({
      alice: { userId: uuid(), orgs: [orgA], events: [event({ id: EV_A, orgId: ORG_A })] },
      bob: { userId: uuid(), orgs: [orgB], events: [event({ id: EV_B, orgId: ORG_B, package: 'EXHIBITOR' })] },
      // Runs Org A, and also edits one of Org B's events.
      carol: { userId: uuid(), orgs: [orgA], events: [event({ id: EV_A, orgId: ORG_A }), event({ id: EV_B, orgId: ORG_B })] },
      // Edits one event of Org A, but runs no org: may see that event, may not pair sensors.
      eve: { userId: uuid(), orgs: [], events: [event({ id: EV_A, orgId: ORG_A })] },
    }),
    plexyz: withPlexyz ? plx.client : null,
    allowedOrigins: [ORIGIN],
    webhookUrl: 'https://x.supabase.co/functions/v1/plexyz_webhook',
  });
  call = async (method, path, { token = 'alice', body, origin = ORIGIN } = {}) => {
    const res = await handler(new Request(`https://x.supabase.co/functions/v1/api${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, origin, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }));
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
}

beforeEach(() => setup());

describe('who may do what', () => {
  it('refuses a request with no Mole session', async () => {
    const r = await call('GET', `/orgs/${ORG_A}/devices`, { token: '' });
    expect(r.status).toBe(401);
  });

  it("will not show one org another org's sensors", async () => {
    expect((await call('GET', `/orgs/${ORG_A}/devices`, { token: 'bob' })).status).toBe(404);
  });

  it("will not pair a sensor to an org you don't run", async () => {
    const r = await call('POST', `/orgs/${ORG_A}/devices`, { token: 'bob', body: { code: 'PLX-0001' } });
    expect(r.status).toBe(404);
    expect(mem.devices.size).toBe(0);
  });

  it('an event editor sees the event but cannot pair sensors for the org', async () => {
    expect((await call('GET', `/events/${EV_A}/zones`, { token: 'eve' })).status).toBe(200);
    expect((await call('POST', `/orgs/${ORG_A}/devices`, { token: 'eve', body: { code: 'PLX-0001' } })).status).toBe(404);
  });

  it("will not show the numbers for somebody else's event", async () => {
    expect((await call('GET', `/events/${EV_B}/presence`)).status).toBe(404);
  });

  it('a sensor or zone that is not yours looks exactly like one that does not exist', async () => {
    const z = (await call('POST', `/events/${EV_B}/zones`, { token: 'bob', body: { name: 'Stand', kind: 'booth' } })).body.zone;
    const theirs = await call('PATCH', `/zones/${z.id}`, { body: { name: 'mine now' } });
    const nobody = await call('PATCH', `/zones/${uuid()}`, { body: { name: 'x' } });
    expect(theirs.status).toBe(404);
    expect(theirs.body).toEqual(nobody.body);
  });

  it("will not place your sensor in another org's zone", async () => {
    // Bob's zone, and a sensor of Alice's that Bob somehow had the id of: Bob
    // cannot touch Alice's sensor, and Alice cannot see Bob's zone.
    const zb = (await call('POST', `/events/${EV_B}/zones`, { token: 'bob', body: { name: 'Stand', kind: 'booth' } })).body.zone;
    const d = (await call('POST', `/orgs/${ORG_A}/devices`, { body: { code: 'PLX-0001' } })).body.device;
    expect((await call('PATCH', `/devices/${d.id}`, { body: { zoneId: zb.id } })).status).toBe(404);
    expect((await call('PATCH', `/devices/${d.id}`, { token: 'bob', body: { zoneId: zb.id } })).status).toBe(404);
    expect(mem.devices.get(d.id)!.zoneId).toBeNull();
  });
});

it("even someone who can see both events cannot put one org's sensor in the other's zone", async () => {
  const zb = (await call('POST', `/events/${EV_B}/zones`, { token: 'carol', body: { name: 'Their stand', kind: 'booth' } })).body.zone;
  const d = (await call('POST', `/orgs/${ORG_A}/devices`, { token: 'carol', body: { code: 'PLX-0001' } })).body.device;
  const r = await call('PATCH', `/devices/${d.id}`, { token: 'carol', body: { zoneId: zb.id } });
  expect(r.status).toBe(400);
  expect(mem.devices.get(d.id)!.zoneId).toBeNull();
});

describe('pairing a sensor', () => {
  it('goes pending, then active once the owner allows it in PLExyz', async () => {
    const r = await call('POST', `/orgs/${ORG_A}/devices`, { body: { code: 'https://example.com/pair?code=PLX-0001', label: 'Booth A12' } });
    expect(r.status).toBe(201);
    expect(r.body.device).toMatchObject({ status: 'pending_approval', label: 'Booth A12', code: 'PLX-0001' });

    // Asking again before anyone has clicked Allow changes nothing.
    expect((await call('POST', `/devices/${r.body.device.id}/refresh`)).body.device.status).toBe('pending_approval');

    plx.approve('PLX-0001');
    const after = await call('POST', `/devices/${r.body.device.id}/refresh`);
    expect(after.body.device.status).toBe('active');
    expect(mem.creds.get(r.body.device.id)).toBe('tok-PLX-0001');
  });

  it('never sends PLExyz ids or tokens to the browser', async () => {
    const r = await call('POST', `/orgs/${ORG_A}/devices`, { body: { code: 'PLX-0001' } });
    plx.approve('PLX-0001');
    const after = await call('POST', `/devices/${r.body.device.id}/refresh`);
    const list = await call('GET', `/orgs/${ORG_A}/devices`);
    const text = JSON.stringify([r.body, after.body, list.body]);
    expect(text).not.toMatch(/tok-PLX|req-PLX|dev-PLX|plexyz/i);
  });

  it('refuses the same sensor twice, and leaves nothing behind when PLExyz says no', async () => {
    await call('POST', `/orgs/${ORG_A}/devices`, { body: { code: 'PLX-0001' } });
    const again = await call('POST', `/orgs/${ORG_B}/devices`, { token: 'bob', body: { code: 'PLX-0001' } });
    expect(again.status).toBe(409);

    const unknown = await call('POST', `/orgs/${ORG_A}/devices`, { body: { code: 'PLX-9999' } });
    expect(unknown.status).toBe(404);
    expect([...mem.devices.values()].map(d => d.code)).toEqual(['PLX-0001']);
  });

  it("refuses a QR that isn't a device code before calling PLExyz", async () => {
    const r = await call('POST', `/orgs/${ORG_A}/devices`, { body: { code: 'https://mole.is/' } });
    expect(r.status).toBe(400);
    expect(plx.requests.size).toBe(0);
  });

  it('says plainly when PLExyz is not connected, and saves nothing', async () => {
    setup(false);
    const r = await call('POST', `/orgs/${ORG_A}/devices`, { body: { code: 'PLX-0001' } });
    expect(r.status).toBe(503);
    expect(r.body.error.message).toMatch(/isn't connected/);
    expect(mem.devices.size).toBe(0);
  });

  it('unpairing tells PLExyz, forgets the token, and frees the sensor for re-pairing', async () => {
    const d = (await call('POST', `/orgs/${ORG_A}/devices`, { body: { code: 'PLX-0002' } })).body.device;
    plx.approve('PLX-0002');
    await call('POST', `/devices/${d.id}/refresh`);
    const r = await call('DELETE', `/devices/${d.id}`);
    expect(r.body).toMatchObject({ device: { status: 'revoked' }, plexyzConfirmed: true });
    expect(plx.revoked).toEqual(['dev-PLX-0002']);
    expect(mem.creds.has(d.id)).toBe(false);
    expect((await call('POST', `/orgs/${ORG_B}/devices`, { token: 'bob', body: { code: 'PLX-0002' } })).status).toBe(201);
  });
});

describe('zones', () => {
  it('cannot delete a zone that already has visits; renaming is fine', async () => {
    const z = (await call('POST', `/events/${EV_A}/zones`, { body: { name: 'Booth A', kind: 'booth' } })).body.zone;
    mem.sessions.push({ deviceId: 'd', sourceId: 's', zoneId: z.id, visitorKey: 'k', startedAt: '2026-10-10T02:00:00Z', endedAt: '2026-10-10T02:10:00Z' });
    const del = await call('DELETE', `/zones/${z.id}`);
    expect(del.status).toBe(409);
    expect(del.body.error.message).toMatch(/Rename it instead/);
    expect((await call('PATCH', `/zones/${z.id}`, { body: { name: 'Booth A (TechFlow)' } })).status).toBe(200);
  });

  it('only takes the four zone types', async () => {
    expect((await call('POST', `/events/${EV_A}/zones`, { body: { name: 'x', kind: 'vip' } })).status).toBe(400);
  });
});

describe('the numbers', () => {
  it("defaults to the event's own window and the shared threshold limits", async () => {
    const r = await call('GET', `/events/${EV_A}/presence?threshold=999`);
    expect(r.status).toBe(200);
    expect(r.body.query).toMatchObject({ from: '2026-10-10T01:00:00.000Z', to: '2026-10-10T10:00:00.000Z', thresholdMinutes: 30 });
  });

  it('refuses a zone from another event', async () => {
    const zb = (await call('POST', `/events/${EV_B}/zones`, { token: 'bob', body: { name: 'S', kind: 'booth' } })).body.zone;
    expect((await call('GET', `/events/${EV_A}/presence?zone=${zb.id}`)).status).toBe(400);
  });
});

describe('the edges', () => {
  it('answers CORS only for the app', async () => {
    const ok = await call('GET', `/orgs/${ORG_A}/devices`);
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    const other = await call('GET', `/orgs/${ORG_A}/devices`, { origin: 'https://evil.example' });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('has a health check that needs no sign-in and reveals no values', async () => {
    const r = await call('GET', '/health', { token: '' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, database: true, moleV3: true, plexyz: true });
  });

  it('says "no such endpoint" rather than guessing', async () => {
    expect((await call('GET', '/nope')).status).toBe(404);
  });
});

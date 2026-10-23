// What the 23 Oct hardening promises (mole-api audit MS-02, MS-04, MS-06, MS-11,
// MS-12, MS-13), each driven through the real handlers with fakes around them.
import { describe, expect, it } from 'vitest';
import { createApiHandler } from '../../supabase/functions/_shared/api.ts';
import { ttlCache } from '../../supabase/functions/_shared/cache.ts';
import type { MoleOrg } from '../../supabase/functions/_shared/contract.ts';
import { cacheSeconds } from '../../supabase/functions/_shared/env.ts';
import { ApiError } from '../../supabase/functions/_shared/http.ts';
import { cachedMoleClient, httpMoleClient, type MoleClient } from '../../supabase/functions/_shared/mole.ts';
import { signBody } from '../../supabase/functions/_shared/plexyz.ts';
import { callUpstream } from '../../supabase/functions/_shared/upstream.ts';
import { createWebhookHandler } from '../../supabase/functions/_shared/webhook.ts';
import { event, fakeMole, fakePlexyz, memoryStore, uuid } from './fakes.ts';

const ORG = uuid(), EV = uuid();
const org: MoleOrg = { orgId: ORG, orgName: 'Org A', role: 'ADMIN', scope: 'ORG' };

function api(over: Partial<Parameters<typeof createApiHandler>[0]> = {}) {
  const mem = memoryStore();
  const handler = createApiHandler({
    store: mem.store,
    mole: fakeMole({ alice: { userId: uuid(), orgs: [org], events: [event({ id: EV, orgId: ORG })] } }),
    plexyz: fakePlexyz().client,
    allowedOrigins: ['https://sense.mole.is'],
    webhookUrl: 'https://x.supabase.co/functions/v1/plexyz_webhook',
    ...over,
  });
  return async (method: string, path: string, headers: Record<string, string> = { authorization: 'Bearer alice' }) => {
    const res = await handler(new Request(`https://x.supabase.co/functions/v1/api${path}`, { method, headers }));
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
}

/** A fetch that never answers, only gives up when the deadline aborts it. */
const hang = ((_u: string, init: RequestInit) => new Promise<Response>((_, reject) => {
  const keep = setTimeout(() => {}, 10_000);
  init.signal?.addEventListener('abort', () => { clearTimeout(keep); reject(new DOMException('timed out', 'TimeoutError')); });
})) as unknown as typeof fetch;

describe('MS-04 · a delivery that fails halfway is retried, not lost', () => {
  it('no receipt until the visits are stored; the retry stores them; a third copy is a duplicate', async () => {
    const mem = memoryStore();
    const zone = await mem.store.insertZone({ eventId: EV, orgId: ORG, name: 'Booth', kind: 'booth', createdBy: uuid() });
    const d = await mem.store.insertDevice({ orgId: ORG, code: 'PLX-0001', label: 'x', requestedBy: uuid() });
    await mem.store.updateDevice(d.id, { status: 'active', plexyzDeviceId: 'dev-1', zoneId: zone.id });
    // The database times out on the first ingest only.
    const realIngest = mem.store.ingest.bind(mem.store);
    let fail = true;
    mem.store.ingest = async (id, rows) => {
      if (fail) { fail = false; throw new ApiError('unavailable', 'the Mole Sense database took too long to answer.'); }
      return realIngest(id, rows);
    };
    const handler = createWebhookHandler({ store: mem.store, webhookSecret: 'whsec-test-0123456789', visitorSecret: 'visitor-secret-abcdef' });
    const raw = JSON.stringify({ type: 'presence.sessions', data: { device_id: 'dev-1', sessions: [{ id: 's1', visitor: 'AA', started_at: '2026-10-10T02:00:00Z', ended_at: '2026-10-10T02:06:00Z' }] } });
    const deliver = async () => {
      const res = await handler(new Request('https://x/functions/v1/plexyz_webhook', {
        method: 'POST', body: raw,
        headers: { 'x-plexyz-signature': await signBody('whsec-test-0123456789', raw), 'x-plexyz-delivery': 'delivery-1' },
      }));
      return { status: res.status, body: await res.json() };
    };
    const first = await deliver();
    expect(first.status).toBe(503);              // PLExyz will retry a 5xx
    expect(mem.sessions).toHaveLength(0);
    expect(await mem.store.hasDelivery('delivery-1')).toBe(false);
    const retry = await deliver();
    expect(retry.status).toBe(200);
    expect(retry.body.stored).toBe(1);
    expect(mem.sessions).toHaveLength(1);
    const again = await deliver();
    expect(again.body.duplicate).toBe(true);
    expect(mem.sessions).toHaveLength(1);
  });
});

describe('MS-11 / MS-12 · every outside call has a deadline, and failure is a plain 503', () => {
  it('a call that hangs is cut off and says which service', async () => {
    const t0 = Date.now();
    const e = await callUpstream('Mole', 'https://mole.example/x', {}, { fetch: hang, timeoutMs: 20 }).catch(x => x);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.code).toBe('unavailable');
    expect(e.message).toMatch(/^Mole took too long/);
    expect(e.headers['Retry-After']).toBe('30');
  });

  it('a call that cannot be made at all says so too', async () => {
    const refused = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    const e = await callUpstream('PLExyz', 'https://plexyz.example/x', {}, { fetch: refused }).catch(x => x);
    expect(e.code).toBe('unavailable');
    expect(e.message).toMatch(/^Couldn't reach PLExyz/);
  });

  it('Mole V3 unreachable during sign-in: the person gets 503 unavailable, not a vague 500', async () => {
    const down = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    const call = api({ mole: httpMoleClient('https://v3.example', 'anon', down) });
    const r = await call('GET', `/events/${EV}/zones`);
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe('unavailable');
    expect(r.body.error.message).toMatch(/Mole sign-in/);
  });
});

describe('MS-13 · health tells ok, degraded and down apart', () => {
  it('ok with everything; degraded (200) without PLExyz; down (503) without the database', async () => {
    expect((await api()('GET', '/health', {})).body.status).toBe('ok');
    const noPlexyz = await api({ plexyz: null })('GET', '/health', {});
    expect(noPlexyz.status).toBe(200);
    expect(noPlexyz.body).toMatchObject({ ok: true, status: 'degraded', plexyz: false });
    const mem = memoryStore();
    mem.store.ping = async () => false;
    const down = await api({ store: mem.store })('GET', '/health', {});
    expect(down.status).toBe(503);
    expect(down.body).toMatchObject({ ok: false, status: 'down', database: false });
  });
});

describe('MS-06 · errors are decided before sign-in and carry a request id', () => {
  it('an unknown path is 404 and a wrong method 405 with Allow, without asking Mole who you are', async () => {
    let asked = 0;
    const mole: MoleClient = { ...fakeMole({}), async user() { asked++; return null; } };
    const call = api({ mole });
    expect((await call('GET', '/nowhere')).status).toBe(404);
    const wrong = await call('PUT', `/events/${EV}/zones`);
    expect(wrong.status).toBe(405);
    expect(wrong.headers.get('allow')).toBe('GET, POST, OPTIONS');
    expect(wrong.body.error.code).toBe('method_not_allowed');
    expect(asked).toBe(0);
  });

  it('the caller\'s request id is echoed; one is made when none is sent; it is in every error', async () => {
    const call = api();
    const given = await call('GET', '/nowhere', { 'x-request-id': 'gw-trace-123456' });
    expect(given.headers.get('x-request-id')).toBe('gw-trace-123456');
    expect(given.body.error.requestId).toBe('gw-trace-123456');
    const made = await call('GET', '/nowhere', {});
    expect(made.headers.get('x-request-id')).toMatch(/^sense_[0-9a-f]{32}$/);
    const unsafe = await call('GET', '/nowhere', { 'x-request-id': 'bad id <script>' });
    expect(unsafe.headers.get('x-request-id')).toMatch(/^sense_/);
  });

  it('a bug is a 500 "internal" with no stack or detail in the answer', async () => {
    const mem = memoryStore();
    mem.store.listZones = async () => { throw new Error('relation "zones" does not exist at line 12'); };
    const r = await api({ store: mem.store })('GET', `/events/${EV}/zones`);
    expect(r.status).toBe(500);
    expect(r.body.error.code).toBe('internal');
    expect(JSON.stringify(r.body)).not.toMatch(/relation|line 12/);
  });
});

describe('MS-02 · Mole V3 answers are kept briefly, per person, and failures never', () => {
  function counting() {
    const n = { user: 0, orgs: 0, event: 0 };
    let failNext = false;
    const inner: MoleClient = {
      async user(t) { n.user++; if (failNext) { failNext = false; throw new ApiError('unavailable', 'x'); } return t === 'nobody' ? null : { id: `u-${t}`, email: null }; },
      async orgs(t) { n.orgs++; return t === 'alice' ? [org] : []; },
      async event(_t, id) { n.event++; return id === EV ? event({ id: EV, orgId: ORG }) : null; },
      async health() { return true; },
    };
    return { inner, n, failNext: () => { failNext = true; } };
  }

  it('asks Mole once per minute per person; each person gets their own answer', async () => {
    let now = 0;
    const c = counting();
    const mole = cachedMoleClient(c.inner, 60, () => now);
    await mole.orgs('alice'); await mole.orgs('alice');
    expect(c.n.orgs).toBe(1);
    expect(await mole.orgs('bob')).toEqual([]);   // a different token never sees alice's answer
    expect(c.n.orgs).toBe(2);
    now += 60_000;
    await mole.orgs('alice');
    expect(c.n.orgs).toBe(3);
  });

  it('joins identical questions asked at the same moment', async () => {
    const c = counting();
    const mole = cachedMoleClient(c.inner, 60);
    await Promise.all([mole.user('alice'), mole.user('alice'), mole.user('alice')]);
    expect(c.n.user).toBe(1);
  });

  it('never keeps "no such user", "no such event" or a failure', async () => {
    const c = counting();
    const mole = cachedMoleClient(c.inner, 60);
    await mole.user('nobody'); await mole.user('nobody');
    expect(c.n.user).toBe(2);
    await mole.event('alice', uuid()); await mole.event('alice', uuid());
    expect(c.n.event).toBe(2);
    c.failNext();
    await expect(mole.user('alice')).rejects.toThrow();
    expect(await mole.user('alice')).toEqual({ id: 'u-alice', email: null });
  });

  it('0 seconds turns it off; a bad setting means the default, never "for ever"', async () => {
    const c = counting();
    const off = cachedMoleClient(c.inner, 0);
    await off.orgs('alice'); await off.orgs('alice');
    expect(c.n.orgs).toBe(2);
    const get = (v?: string) => () => v;
    expect(cacheSeconds(get(undefined))).toBe(60);
    expect(cacheSeconds(get('0'))).toBe(0);
    expect(cacheSeconds(get('nonsense'))).toBe(60);
    expect(cacheSeconds(get('99999'))).toBe(300);
  });

  it('the cache is bounded', async () => {
    const cache = ttlCache<number>(60_000, 3);
    for (let i = 0; i < 10; i++) await cache.get(`k${i}`, async () => i);
    expect(cache.size).toBeLessThanOrEqual(3);
  });
});

// P2-09 · one request id end to end. The Mole API gateway sends `x-request-id`;
// Mole Sense uses it (header, error body, log line) when it is well formed and
// makes its own when it is absent or not to be trusted. Both the `api` function
// and the PLExyz webhook are driven through their real handlers.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiHandler } from '../../supabase/functions/_shared/api.ts';
import { requestId } from '../../supabase/functions/_shared/http.ts';
import { signBody } from '../../supabase/functions/_shared/plexyz.ts';
import { createWebhookHandler } from '../../supabase/functions/_shared/webhook.ts';
import { event, fakeMole, fakePlexyz, memoryStore, uuid } from './fakes.ts';

const ORG = uuid(), EV = uuid();
const MADE = /^sense_[0-9a-f]{32}$/;

function api(over: Partial<Parameters<typeof createApiHandler>[0]> = {}) {
  const mem = memoryStore();
  const handler = createApiHandler({
    store: mem.store,
    mole: fakeMole({ alice: { userId: uuid(), orgs: [{ orgId: ORG, orgName: 'Org A', role: 'ADMIN', scope: 'ORG' }], events: [event({ id: EV, orgId: ORG })] } }),
    plexyz: fakePlexyz().client,
    allowedOrigins: ['https://sense.mole.is'],
    webhookUrl: 'https://x.supabase.co/functions/v1/plexyz_webhook',
    ...over,
  });
  return async (path: string, headers: Record<string, string>) => {
    const res = await handler(new Request(`https://x.supabase.co/functions/v1/api${path}`, { method: 'GET', headers }));
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
}

const SECRET = 'whsec-test-0123456789';
function webhook() {
  const mem = memoryStore();
  const handler = createWebhookHandler({ store: mem.store, webhookSecret: SECRET, visitorSecret: 'visitor-secret-abcdef' });
  return async (body: unknown, headers: Record<string, string> = {}, sign = true) => {
    const raw = JSON.stringify(body);
    const res = await handler(new Request('https://x/functions/v1/plexyz_webhook', {
      method: 'POST',
      headers: { ...(sign ? { 'x-plexyz-signature': await signBody(SECRET, raw) } : {}), 'x-plexyz-delivery': `d-${Math.random()}`, ...headers },
      body: raw,
    }));
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
}

// Values that must never be trusted. A newline cannot be sent in a real header
// (the runtime refuses it), so requestId() is also given one directly below.
const BAD: Record<string, string> = {
  'with spaces': 'gw trace 123456',
  'too long (129)': 'a'.repeat(129),
  'too short (7)': 'abcdefg',
  'markup': 'bad<script>alert(1)</script>',
  'slash': 'gw/trace/123456',
};

afterEach(() => vi.restoreAllMocks());

describe('requestId()', () => {
  const of = (v: string | null) => requestId({ headers: { get: () => v } });

  it('keeps a well formed id exactly, at both ends of the length range and with : . _ -', () => {
    for (const ok of ['gateway:req_1.2-3', 'a'.repeat(8), 'a'.repeat(128), 'Mole:Abc.123_xyz-9']) expect(of(ok)).toBe(ok);
  });

  it('replaces anything malformed, including a newline', () => {
    for (const bad of [...Object.values(BAD), 'abcdefgh12\n', 'abcdefgh\nX-Evil: 1', '\nabcdefghij', '', 'abcdefgh\r']) expect(of(bad)).toMatch(MADE);
  });

  it('makes one when none is sent, and each is different', () => {
    expect(of(null)).toMatch(MADE);
    expect(of(null)).not.toBe(of(null));
  });
});

describe('api: the gateway\'s request id is this request\'s id', () => {
  it('a valid id is echoed in the header and in the error body', async () => {
    const r = await api()('/nowhere', { 'x-request-id': 'gw:trace.123-456_x' });
    expect(r.status).toBe(404);
    expect(r.headers.get('x-request-id')).toBe('gw:trace.123-456_x');
    expect(r.body.error.requestId).toBe('gw:trace.123-456_x');
  });

  it('a valid id is echoed on a success and on an unauthenticated error too', async () => {
    const ok = await api()('/health', { 'x-request-id': 'gw-trace-123456' });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('x-request-id')).toBe('gw-trace-123456');
    const no = await api()(`/events/${EV}/zones`, { 'x-request-id': 'gw-trace-123456' });
    expect(no.status).toBe(401);
    expect(no.headers.get('x-request-id')).toBe('gw-trace-123456');
    expect(no.body.error.requestId).toBe('gw-trace-123456');
  });

  it('an unhandled bug is a 500 that carries the same id, and the log line has it', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const mem = memoryStore();
    mem.store.listZones = async () => { throw new Error('boom'); };
    const r = await api({ store: mem.store })(`/events/${EV}/zones`, { authorization: 'Bearer alice', 'x-request-id': 'gw-trace-500-abc' });
    expect(r.status).toBe(500);
    expect(r.headers.get('x-request-id')).toBe('gw-trace-500-abc');
    expect(r.body.error.requestId).toBe('gw-trace-500-abc');
    expect(String(err.mock.calls[0]?.[0])).toContain('[gw-trace-500-abc]');
  });

  for (const [name, bad] of Object.entries(BAD)) {
    it(`a malformed id (${name}) is replaced, in header and body`, async () => {
      const r = await api()('/nowhere', { 'x-request-id': bad });
      expect(r.headers.get('x-request-id')).toMatch(MADE);
      expect(r.body.error.requestId).toBe(r.headers.get('x-request-id'));
      expect(JSON.stringify(r.body)).not.toContain(bad);
    });
  }

  it('no id sent: one is made, as before, and is in the body', async () => {
    const r = await api()('/nowhere', {});
    expect(r.headers.get('x-request-id')).toMatch(MADE);
    expect(r.body.error.requestId).toBe(r.headers.get('x-request-id'));
  });
});

describe('plexyz_webhook: the same rule', () => {
  it('a valid id is echoed on an error answer (header and body) and on a handled delivery', async () => {
    const send = webhook();
    const bad = await send({ type: 'x' }, { 'x-request-id': 'gw:trace.123-456_x' }, false);
    expect(bad.status).toBe(401);
    expect(bad.headers.get('x-request-id')).toBe('gw:trace.123-456_x');
    expect(bad.body.error.requestId).toBe('gw:trace.123-456_x');
    const ok = await send({ type: 'device.status', data: {} }, { 'x-request-id': 'gw-trace-123456' });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('x-request-id')).toBe('gw-trace-123456');
  });

  it('the id is in the log line', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await webhook()({ type: 'brand.new.kind', data: {} }, { 'x-request-id': 'gw-trace-123456' });
    expect(log.mock.calls.some((c) => String(c[0]).includes('[gw-trace-123456]'))).toBe(true);
  });

  for (const [name, badId] of Object.entries(BAD)) {
    it(`a malformed id (${name}) is replaced`, async () => {
      const r = await webhook()({ type: 'x' }, { 'x-request-id': badId }, false);
      expect(r.headers.get('x-request-id')).toMatch(MADE);
      expect(r.body.error.requestId).toBe(r.headers.get('x-request-id'));
    });
  }

  it('no id sent: one is made, and a wrong method carries it too', async () => {
    const r = await webhook()({ type: 'x' }, {}, false);
    expect(r.headers.get('x-request-id')).toMatch(MADE);
    expect(r.body.error.requestId).toBe(r.headers.get('x-request-id'));
    const handler = createWebhookHandler({ store: memoryStore().store, webhookSecret: SECRET, visitorSecret: 'v' });
    const get = await handler(new Request('https://x/functions/v1/plexyz_webhook', { method: 'GET', headers: { 'x-request-id': 'gw-trace-123456' } }));
    expect(get.status).toBe(405);
    expect(get.headers.get('x-request-id')).toBe('gw-trace-123456');
  });
});

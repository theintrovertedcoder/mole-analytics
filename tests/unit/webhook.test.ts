import { beforeEach, describe, expect, it } from 'vitest';
import { signBody, visitorKey } from '../../supabase/functions/_shared/plexyz.ts';
import { createWebhookHandler } from '../../supabase/functions/_shared/webhook.ts';
import { memoryStore, uuid } from './fakes.ts';

const SECRET = 'whsec-test-0123456789';
const VISITOR = 'visitor-secret-abcdef';
const EVENT = uuid();

let mem: ReturnType<typeof memoryStore>;
let send: (body: unknown, opts?: { sign?: boolean; delivery?: string }) => Promise<{ status: number; body: any }>;
let deviceId: string;

beforeEach(async () => {
  mem = memoryStore();
  const handler = createWebhookHandler({ store: mem.store, webhookSecret: SECRET, visitorSecret: VISITOR });
  let k = 0;
  send = async (body, { sign = true, delivery } = {}) => {
    const raw = JSON.stringify(body);
    const res = await handler(new Request('https://x/functions/v1/plexyz_webhook', {
      method: 'POST',
      headers: {
        ...(sign ? { 'x-plexyz-signature': await signBody(SECRET, raw) } : {}),
        'x-plexyz-delivery': delivery ?? `d-${++k}`,
      },
      body: raw,
    }));
    return { status: res.status, body: await res.json() };
  };
  const zone = await mem.store.insertZone({ eventId: EVENT, orgId: uuid(), name: 'Booth', kind: 'booth', createdBy: uuid() });
  const d = await mem.store.insertDevice({ orgId: uuid(), code: 'PLX-0001', label: 'x', requestedBy: uuid() });
  deviceId = (await mem.store.updateDevice(d.id, { plexyzRequestId: 'req-1', zoneId: zone.id })).id;
});

const sessions = (id: string, visitor = 'AA:BB:CC:DD:EE:FF') => ({
  type: 'presence.sessions',
  data: { device_id: 'dev-1', sessions: [{ id, visitor, started_at: '2026-10-10T02:00:00Z', ended_at: '2026-10-10T02:06:00Z' }] },
});

describe('plexyz_webhook', () => {
  it('rejects anything not signed with our secret', async () => {
    expect((await send({ type: 'pairing.updated', data: { request_id: 'req-1', status: 'approved', device_id: 'dev-1' } }, { sign: false })).status).toBe(401);
    expect(mem.devices.get(deviceId)!.status).toBe('pending_approval');
  });

  it('activates the sensor when the owner allows the pairing', async () => {
    const r = await send({ type: 'pairing.updated', data: { request_id: 'req-1', status: 'approved', device_id: 'dev-1', access_token: 't' } });
    expect(r.body.status).toBe('active');
    expect(mem.creds.get(deviceId)).toBe('t');
  });

  it('a late "rejected" cannot undo an approval', async () => {
    await send({ type: 'pairing.updated', data: { request_id: 'req-1', status: 'approved', device_id: 'dev-1' } });
    await send({ type: 'pairing.updated', data: { request_id: 'req-1', status: 'rejected' } });
    expect(mem.devices.get(deviceId)!.status).toBe('active');
  });

  it('ignores sessions from a sensor nobody has allowed yet', async () => {
    const r = await send(sessions('s1'));
    expect(r.body.ignored).toMatch(/no active pairing/);
    expect(mem.sessions).toHaveLength(0);
  });

  it('stores the visitor only as a hash, never as what the sensor saw', async () => {
    await send({ type: 'pairing.updated', data: { request_id: 'req-1', status: 'approved', device_id: 'dev-1' } });
    await send(sessions('s1'));
    expect(mem.sessions).toHaveLength(1);
    const key = mem.sessions[0]!.visitorKey;
    expect(key).not.toContain('AA:BB');
    expect(key).toBe(await visitorKey(VISITOR, EVENT, 'AA:BB:CC:DD:EE:FF'));
    // The same phone at another event is somebody else.
    expect(key).not.toBe(await visitorKey(VISITOR, uuid(), 'AA:BB:CC:DD:EE:FF'));
  });

  it('a retried delivery counts once', async () => {
    await send({ type: 'pairing.updated', data: { request_id: 'req-1', status: 'approved', device_id: 'dev-1' } });
    await send(sessions('s1'), { delivery: 'same' });
    const again = await send(sessions('s1'), { delivery: 'same' });
    expect(again.body.duplicate).toBe(true);
    // And the same session id in a new delivery is still one visit.
    await send(sessions('s1'));
    expect(mem.sessions).toHaveLength(1);
  });

  it('records a heartbeat without letting a sensor claim to be from the future', async () => {
    await send({ type: 'pairing.updated', data: { request_id: 'req-1', status: 'approved', device_id: 'dev-1' } });
    await send({ type: 'device.status', data: { device_id: 'dev-1', seen_at: '2999-01-01T00:00:00Z', battery: 140 } });
    const d = mem.devices.get(deviceId)!;
    expect(Date.parse(d.lastSeenAt!)).toBeLessThanOrEqual(Date.now());
    expect(d.battery).toBe(100);
  });
});

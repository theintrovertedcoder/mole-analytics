// supabase/functions/_shared/webhook.ts
// ─────────────────────────────────────────────────────────────────────────────
// The `plexyz_webhook` edge function: what PLExyz sends us.
// ─────────────────────────────────────────────────────────────────────────────
// Three kinds of delivery (assumed shapes, see plexyz.ts and
// docs/PLEXYZ_INTEGRATION.md):
//
//   pairing.updated     the owner allowed or refused a pairing in PLExyz
//   presence.sessions   visits a sensor saw
//   device.status       a heartbeat: last seen, battery
//
// Order of operations, each for a reason:
//
//   1. The signature, before anything is parsed or stored. An unsigned body
//      is somebody else's, however plausible it looks.
//   2. The delivery id, before acting. PLExyz will retry anything it is not
//      sure we got; a retry must not count the same visits twice.
//   3. The raw visitor id is hashed before it is stored, and never logged.
// ─────────────────────────────────────────────────────────────────────────────

import { applyPairing } from './api.ts';
import { errorResponse, json } from './http.ts';
import { toPairing, verifySignature, visitorKey } from './plexyz.ts';
import type { SessionIn, Store } from './store.ts';

export interface WebhookDeps {
  store: Store | null;
  webhookSecret: string;
  visitorSecret: string;
  now?: () => Date;
}

/** At most this many sessions in one delivery; more is a misconfiguration, not traffic. */
export const MAX_SESSIONS = 5000;

export function createWebhookHandler(deps: WebhookDeps): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      if (req.method !== 'POST') return json({ error: { code: 'invalid', message: 'POST only.' } }, 405);
      if (!deps.store || !deps.webhookSecret || !deps.visitorSecret) {
        return json({ error: { code: 'not_configured', message: 'Webhook secrets are not set.' } }, 503);
      }
      const raw = await req.text();
      if (!(await verifySignature(deps.webhookSecret, raw, req.headers.get('x-plexyz-signature')))) {
        return json({ error: { code: 'unauthenticated', message: 'Bad signature.' } }, 401);
      }

      let body: any;
      try {
        body = JSON.parse(raw);
      } catch {
        return json({ error: { code: 'invalid', message: 'Not JSON.' } }, 400);
      }
      const type = String(body?.type ?? '');
      const delivery = req.headers.get('x-plexyz-delivery') ?? (body?.id ? String(body.id) : '');
      if (!delivery) return json({ error: { code: 'invalid', message: 'No delivery id.' } }, 400);
      if (!(await deps.store.recordDelivery(delivery, type || 'unknown'))) {
        return json({ ok: true, duplicate: true });
      }

      const data = body?.data ?? {};
      const now = deps.now?.() ?? new Date();

      if (type === 'pairing.updated') {
        const pairing = toPairing(data);
        const d = pairing.requestId ? await deps.store.deviceByRequest(pairing.requestId) : null;
        if (!d) return json({ ok: true, ignored: 'unknown pairing request' });
        const next = await applyPairing(deps.store, d, pairing, now);
        return json({ ok: true, status: next.status });
      }

      if (type === 'presence.sessions') {
        const d = data.device_id ? await deps.store.activeDeviceByPlexyzId(String(data.device_id)) : null;
        if (!d) return json({ ok: true, ignored: 'no active pairing for that device' });
        const zone = d.zoneId ? await deps.store.getZone(d.zoneId) : null;
        const list: any[] = Array.isArray(data.sessions) ? data.sessions : [];
        if (list.length > MAX_SESSIONS) {
          return json({ error: { code: 'invalid', message: `At most ${MAX_SESSIONS} sessions per delivery.` } }, 413);
        }
        if (!zone) {
          // Ingest would drop them anyway; saying so here keeps the log honest.
          return json({ ok: true, received: list.length, stored: 0, dropped_no_zone: list.length });
        }
        const rows: SessionIn[] = [];
        for (const s of list) {
          const started = Date.parse(s?.started_at), ended = Date.parse(s?.ended_at);
          if (!s?.visitor || !s?.id || Number.isNaN(started) || Number.isNaN(ended)) continue;
          rows.push({
            visitor_key: await visitorKey(deps.visitorSecret, zone.eventId, String(s.visitor)),
            started_at: new Date(started).toISOString(),
            ended_at: new Date(ended).toISOString(),
            source_id: String(s.id),
          });
        }
        const result = await deps.store.ingest(d.id, rows);
        return json({ ok: true, ...result, malformed: list.length - rows.length });
      }

      if (type === 'device.status') {
        const d = data.device_id ? await deps.store.activeDeviceByPlexyzId(String(data.device_id)) : null;
        if (!d) return json({ ok: true, ignored: 'no active pairing for that device' });
        const seen = Date.parse(data.seen_at);
        const battery = Number(data.battery);
        await deps.store.updateDevice(d.id, {
          lastSeenAt: new Date(Number.isNaN(seen) ? now.getTime() : Math.min(seen, now.getTime())).toISOString(),
          battery: Number.isFinite(battery) ? Math.max(0, Math.min(100, Math.round(battery))) : d.battery,
        });
        return json({ ok: true });
      }

      // Accepted so PLExyz stops retrying; logged so we notice a new kind.
      console.log(`plexyz webhook: ignored type "${type}"`);
      return json({ ok: true, ignored: 'unknown type' }, 202);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

// supabase/functions/_shared/plexyz.ts
// ─────────────────────────────────────────────────────────────────────────────
// PLExyz, behind one interface.
// ─────────────────────────────────────────────────────────────────────────────
// **The HTTP shapes below are our assumption, not reka.re's documentation.**
// We have not seen the PLExyz cloud API yet. Everything that would change when
// we do is in this file: the paths, the field names, the signature header.
// docs/PLEXYZ_INTEGRATION.md lists each assumption next to the question that
// settles it. Nothing outside this file knows what PLExyz's wire format is.
//
// The flow we built for, from Haziq's description:
//
//   1. Someone at the org scans the QR on the sensor.
//   2. We ask PLExyz to pair that device with Mole           → requestPairing
//   3. The request shows up in the PLExyz dashboard; the device's owner allows it.
//   4. PLExyz tells us (webhook `pairing.updated`), or we ask  → getPairing
//   5. Sessions stream to us (webhook `presence.sessions`).
//   6. Unpairing tells PLExyz to stop                          → revoke
// ─────────────────────────────────────────────────────────────────────────────

import { ApiError } from './http.ts';

export type PairingState = 'pending' | 'approved' | 'rejected' | 'expired';

export interface Pairing {
  requestId: string;
  state: PairingState;
  /** Set once approved. */
  deviceId: string | null;
  /** Set once approved: what we present to PLExyz for this device from then on. */
  accessToken: string | null;
}

export interface PlexyzClient {
  requestPairing(input: { code: string; orgName: string; label: string; callbackUrl: string }): Promise<Pairing>;
  getPairing(requestId: string): Promise<Pairing>;
  revoke(deviceId: string, accessToken: string): Promise<void>;
}

export class PlexyzRefusal extends Error {
  constructor(public kind: 'unknown_code' | 'already_paired', message: string) {
    super(message);
  }
}

const STATES: PairingState[] = ['pending', 'approved', 'rejected', 'expired'];

export function toPairing(body: any): Pairing {
  const state = STATES.includes(body?.status) ? body.status as PairingState : 'pending';
  return {
    requestId: String(body?.id ?? body?.request_id ?? ''),
    state,
    deviceId: body?.device_id ? String(body.device_id) : null,
    accessToken: body?.access_token ? String(body.access_token) : null,
  };
}

export function httpPlexyzClient(baseUrl: string, apiKey: string, f: typeof fetch = fetch): PlexyzClient {
  const base = baseUrl.replace(/\/+$/, '');
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  async function call(path: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await f(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
    } catch (e) {
      console.error('plexyz unreachable', e);
      throw new ApiError('upstream', "PLExyz didn't answer. Try again in a minute.");
    }
    return res;
  }

  return {
    async requestPairing({ code, orgName, label, callbackUrl }) {
      const res = await call('/v1/pairing-requests', {
        method: 'POST',
        body: JSON.stringify({ device_code: code, requester: { product: 'Mole', org_name: orgName, label }, callback_url: callbackUrl }),
      });
      if (res.status === 404) throw new PlexyzRefusal('unknown_code', "PLExyz doesn't recognise that code.");
      if (res.status === 409) throw new PlexyzRefusal('already_paired', 'PLExyz says this sensor is already paired elsewhere.');
      if (!res.ok) {
        console.error(`plexyz pairing → ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
        throw new ApiError('upstream', "PLExyz didn't accept the request. Try again in a minute.");
      }
      return toPairing(await res.json());
    },
    async getPairing(requestId) {
      const res = await call(`/v1/pairing-requests/${encodeURIComponent(requestId)}`, { method: 'GET' });
      if (!res.ok) throw new ApiError('upstream', "PLExyz didn't answer about this pairing.");
      return toPairing(await res.json());
    },
    async revoke(deviceId, accessToken) {
      const res = await call(`/v1/devices/${encodeURIComponent(deviceId)}/pairing`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok && res.status !== 404) throw new ApiError('upstream', "PLExyz didn't confirm the unpairing.");
    },
  };
}

// ── Webhook signatures ───────────────────────────────────────────────────────

const enc = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Compares in constant time, so the answer's timing says nothing about how close a guess was. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** `X-Plexyz-Signature: sha256=<hex HMAC-SHA256 of the raw body>` (assumed — see the header). */
export async function verifySignature(secret: string, rawBody: string, header: string | null): Promise<boolean> {
  if (!secret || !header) return false;
  const given = header.trim().replace(/^sha256=/i, '').toLowerCase();
  return sameText(given, await hmacHex(secret, rawBody));
}

export async function signBody(secret: string, rawBody: string): Promise<string> {
  return `sha256=${await hmacHex(secret, rawBody)}`;
}

/**
 * The only form a visitor identifier is ever stored in. Keyed by a secret and
 * the event, so the same phone is one visitor across an event and cannot be
 * matched across events, or back to the phone, without the secret.
 */
export async function visitorKey(secret: string, eventId: string, raw: string): Promise<string> {
  return (await hmacHex(secret, `${eventId}|${raw}`)).slice(0, 32);
}

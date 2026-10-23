// supabase/functions/_shared/mole.ts
// ─────────────────────────────────────────────────────────────────────────────
// Mole V3, from the server side.
// ─────────────────────────────────────────────────────────────────────────────
// People sign in with their Mole account, so the token on every request is a
// Mole V3 token, and Mole V3 is the only thing that can say what it is worth.
// We do not verify it ourselves with a shared JWT secret: that would put Mole's
// most powerful secret in a second project, and it would keep accepting a
// token Mole has already revoked. Instead every request asks Mole V3:
//
//   who is this?               GET  /auth/v1/user
//   which orgs may they run?   POST /rest/v1/rpc/api_v1_my_orgs
//   may they see this event?   POST /rest/v1/rpc/api_v1_event
//
// …with the person's own token, so Mole V3's own rules decide, and the anon
// key, which is public. The api_v1_* functions are migration 143 in Mole V3
// (older notes say 119; it was renumbered on 16 Oct).
//
// Asking costs two or three calls per request, so `cachedMoleClient` wraps
// this client and keeps each answer for a short while (MOLE_CACHE_SECONDS).
// ─────────────────────────────────────────────────────────────────────────────

import { hashKey, ttlCache } from './cache.ts';
import type { MoleEvent, MoleOrg } from './contract.ts';
import { ApiError } from './http.ts';
import { callUpstream } from './upstream.ts';

export interface MoleUser {
  id: string;
  email: string | null;
}

export interface MoleClient {
  user(token: string): Promise<MoleUser | null>;
  orgs(token: string): Promise<MoleOrg[]>;
  event(token: string, eventId: string): Promise<MoleEvent | null>;
  health(): Promise<boolean>;
}

export function mapEvent(r: any): MoleEvent {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    package: r.package === 'EXHIBITOR' ? 'EXHIBITOR' : 'HOST',
    orgId: r.org_id,
    orgName: r.org_name,
    venue: r.venue ?? null,
    startsAt: r.starts_at ?? null,
    endsAt: r.ends_at ?? null,
    hostName: r.host_name ?? null,
    isPublished: !!r.is_published,
  };
}

export function mapOrg(r: any): MoleOrg {
  return { orgId: r.org_id, orgName: r.org_name, role: r.role, scope: r.scope };
}

export function httpMoleClient(url: string, anonKey: string, f: typeof fetch = fetch, timeoutMs?: number): MoleClient {
  const base = url.replace(/\/+$/, '');
  const headers = (token: string) => ({
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  async function rpc(token: string, fn: string, args: Record<string, unknown>): Promise<any[]> {
    const res = await callUpstream('Mole', `${base}/rest/v1/rpc/${fn}`, { method: 'POST', headers: headers(token), body: JSON.stringify(args) }, { fetch: f, timeoutMs });
    if (res.status === 401) throw new ApiError('unauthenticated', 'Your Mole session has ended. Sign in again.');
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`mole rpc ${fn} → ${res.status}: ${text.slice(0, 300)}`);
      // 404 here is PostgREST saying the function does not exist: migration 143
      // has not been run on Mole V3. Say that, rather than "something went wrong".
      if (res.status === 404) throw new ApiError('not_configured', 'Mole V3 is missing the analytics API (migration 143).');
      throw new ApiError('upstream', "Mole didn't answer properly. Try again in a minute.");
    }
    const body = await res.json();
    return Array.isArray(body) ? body : body == null ? [] : [body];
  }

  return {
    async user(token) {
      if (!token) return null;
      const res = await callUpstream('Mole sign-in', `${base}/auth/v1/user`, { headers: headers(token) }, { fetch: f, timeoutMs });
      if (res.status === 401 || res.status === 403) return null;
      if (!res.ok) throw new ApiError('upstream', "Mole sign-in didn't answer. Try again in a minute.");
      const u = await res.json();
      return u?.id ? { id: u.id, email: u.email ?? null } : null;
    },
    async orgs(token) {
      return (await rpc(token, 'api_v1_my_orgs', {})).map(mapOrg);
    },
    async event(token, eventId) {
      const rows = await rpc(token, 'api_v1_event', { p_event_id: eventId });
      return rows[0] ? mapEvent(rows[0]) : null;
    },
    async health() {
      try {
        const res = await callUpstream('Mole', `${base}/auth/v1/health`, { headers: { apikey: anonKey } }, { fetch: f, timeoutMs });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}

/**
 * The same client, remembering each person's answers for `ttlSeconds`: who they
 * are, their orgs, and each event they asked about. Keyed by a hash of the
 * token, so one person never sees another's answer, and a token Mole V3 revokes
 * stops working here within `ttlSeconds` at most. "No such user" and "no such
 * event" are never kept, so a new sign-in or a new event shows at once.
 * `ttlSeconds` 0 turns the cache off.
 */
export function cachedMoleClient(inner: MoleClient, ttlSeconds: number, now: () => number = Date.now): MoleClient {
  const ms = Math.max(0, ttlSeconds) * 1000;
  const users = ttlCache<MoleUser | null>(ms, 2_000, now);
  const orgs = ttlCache<MoleOrg[]>(ms, 2_000, now);
  const events = ttlCache<MoleEvent | null>(ms, 5_000, now);
  const present = (v: unknown) => v != null;
  return {
    async user(token) {
      if (!token) return null;
      return users.get(await hashKey(token), () => inner.user(token), present);
    },
    async orgs(token) {
      return orgs.get(await hashKey(token), () => inner.orgs(token));
    },
    async event(token, eventId) {
      return events.get(`${await hashKey(token)}:${eventId}`, () => inner.event(token, eventId), present);
    },
    health: () => inner.health(),
  };
}

// src/data/live/liveBackend.ts
// ─────────────────────────────────────────────────────────────────────────────
// The real thing: Mole V3 for the account, events and outcomes, and this
// product's `api` function for zones, sensors and the sensor numbers.
// ─────────────────────────────────────────────────────────────────────────────
// Sign-in is Mole V3's own Supabase auth, so a Mole account is the account
// here and there is no second password. Mole V3 is read only through its
// api_v1_* functions (migration 119 in Mole-V3); this file never names a V3
// table.
// ─────────────────────────────────────────────────────────────────────────────

// The two parts of supabase-js this needs, not the whole of it: realtime and
// storage would be another 80 kB the app never calls.
import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import type { EventOutcomes, MoleEvent, PresenceQuery } from '../../../supabase/functions/_shared/contract.ts';
import { mapEvent, mapOrg } from '../../../supabase/functions/_shared/mole.ts';
import type { LiveConfig } from '../../config/env.ts';
import { UserFacingError, type Account, type Backend } from '../backend.ts';

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

export function liveBackend(cfg: LiveConfig): Backend {
  const auth = new AuthClient({
    url: `${cfg.moleUrl}/auth/v1`,
    headers: { apikey: cfg.moleAnonKey, Authorization: `Bearer ${cfg.moleAnonKey}` },
    storageKey: 'mole-sense-auth',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  });
  // Every PostgREST call goes out as the signed-in person, so Mole V3's own
  // rules decide what comes back.
  const db = new PostgrestClient(`${cfg.moleUrl}/rest/v1`, {
    headers: { apikey: cfg.moleAnonKey },
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const { data } = await auth.getSession();
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${data.session?.access_token ?? cfg.moleAnonKey}`);
      return fetch(input, { ...init, headers });
    },
  });

  async function token(): Promise<string> {
    const { data } = await auth.getSession();
    const t = data.session?.access_token;
    if (!t) throw new UserFacingError('Sign in with your Mole account.', 'unauthenticated');
    return t;
  }

  async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await db.rpc(fn, args);
    if (error) {
      // PGRST202: the function is not there — migration 119 has not been run.
      if (error.code === 'PGRST202') {
        throw new UserFacingError('Mole is missing the analytics connection (migration 119). Ask the Mole team to run it.', 'not_configured');
      }
      throw new UserFacingError("Couldn't reach Mole. Check your connection and try again.");
    }
    return data as T;
  }

  async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${cfg.apiUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      if (e instanceof UserFacingError) throw e;
      throw new UserFacingError("Couldn't reach Mole Sense. Check your connection and try again.");
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new UserFacingError(json?.error?.message ?? 'Something went wrong. Try again in a minute.', json?.error?.code ?? 'error');
    }
    return json as T;
  }

  const toAccount = (u: { id: string; email?: string | null } | null | undefined): Account | null =>
    u ? { id: u.id, email: u.email ?? null } : null;

  return {
    mode: 'live',

    async account() {
      const { data } = await auth.getSession();
      return toAccount(data.session?.user);
    },
    onAccountChange(cb) {
      const { data } = auth.onAuthStateChange((_e, session) => cb(toAccount(session?.user)));
      return () => data.subscription.unsubscribe();
    },
    async signInWithPassword(email, password) {
      const { error } = await auth.signInWithPassword({ email, password });
      if (error) throw new UserFacingError("That email and password don't match a Mole account.");
    },
    async signInWithGoogle() {
      const { error } = await auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (error) throw new UserFacingError("Google sign-in didn't start. Try again.");
    },
    async signOut() {
      await auth.signOut();
    },

    async myOrgs() {
      return (await rpc<any[]>('api_v1_my_orgs')).map(mapOrg);
    },
    async myEvents() {
      return (await rpc<any[]>('api_v1_my_events')).map(mapEvent);
    },
    async event(id) {
      const rows = await rpc<any[]>('api_v1_event', { p_event_id: id });
      return rows[0] ? mapEvent(rows[0]) as MoleEvent : null;
    },
    async outcomes(eventId) {
      return mapOutcomes(await rpc<any>('api_v1_event_outcomes', { p_event_id: eventId }));
    },

    async zones(eventId) {
      return (await api<{ zones: any[] }>('GET', `/events/${eventId}/zones`)).zones;
    },
    async createZone(eventId, z) {
      return (await api<{ zone: any }>('POST', `/events/${eventId}/zones`, z)).zone;
    },
    async updateZone(id, patch) {
      return (await api<{ zone: any }>('PATCH', `/zones/${id}`, patch)).zone;
    },
    async deleteZone(id) {
      await api('DELETE', `/zones/${id}`);
    },

    async devices(orgId) {
      return (await api<{ devices: any[] }>('GET', `/orgs/${orgId}/devices`)).devices;
    },
    async pairDevice(orgId, d) {
      return (await api<{ device: any }>('POST', `/orgs/${orgId}/devices`, d)).device;
    },
    async refreshDevice(id) {
      return (await api<{ device: any }>('POST', `/devices/${id}/refresh`)).device;
    },
    async updateDevice(id, patch) {
      return (await api<{ device: any }>('PATCH', `/devices/${id}`, patch)).device;
    },
    async unpairDevice(id) {
      return api('DELETE', `/devices/${id}`);
    },

    async presence(eventId, q: Partial<PresenceQuery>) {
      const p = new URLSearchParams();
      if (q.from) p.set('from', q.from);
      if (q.to) p.set('to', q.to);
      if (q.thresholdMinutes != null) p.set('threshold', String(q.thresholdMinutes));
      if (q.zoneId) p.set('zone', q.zoneId);
      if (q.bucketSeconds) p.set('bucket', String(q.bucketSeconds));
      return api('GET', `/events/${eventId}/presence?${p}`);
    },
  };
}

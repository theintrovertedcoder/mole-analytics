// src/data/live/liveBackend.ts
// ─────────────────────────────────────────────────────────────────────────────
// The real thing: Mole V3 for the account, and a transport for the data.
// ─────────────────────────────────────────────────────────────────────────────
// Sign-in is Mole V3's own Supabase auth, so a Mole account is the account
// here and there is no second password. The data goes one of two ways
// (transport.ts): through the Mole API gateway when VITE_MOLE_API_URL is set,
// otherwise straight to Mole V3's api_v1_* functions (migration 143 in
// Mole-V3) and this product's `api` function. Neither names a V3 table.
// ─────────────────────────────────────────────────────────────────────────────

// The two parts of supabase-js this needs, not the whole of it: realtime and
// storage would be another 80 kB the app never calls.
import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import type { LiveConfig } from '../../config/env.ts';
import { UserFacingError, type Account, type Backend } from '../backend.ts';
import { directTransport, gatewayTransport, type DataTransport } from './transport.ts';

export { mapOutcomes } from './transport.ts';

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
      // PGRST202: the function is not there — migration 143 has not been run.
      if (error.code === 'PGRST202') {
        throw new UserFacingError('Mole is missing the analytics connection (migration 143). Ask the Mole team to run it.', 'not_configured');
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
      throw new UserFacingError(json?.error?.message ?? 'Something went wrong. Try again in a minute.', json?.error?.code ?? 'error', json?.error?.requestId);
    }
    return json as T;
  }

  const data: DataTransport = cfg.gatewayUrl ? gatewayTransport(cfg.gatewayUrl, token) : directTransport({ rpc, api });

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
    async sendEmailCode(email) {
      const { error } = await auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (!error) return;
      if (error.status === 429 || /seconds|rate limit/i.test(error.message)) {
        throw new UserFacingError('A code was sent a moment ago. Wait a minute before asking for another.', 'rate_limited');
      }
      if (/invalid/i.test(error.message)) throw new UserFacingError('That doesn’t look like an email address.');
      throw new UserFacingError("The code didn't send. Check your connection and try again.");
    },
    async signInWithEmailCode(email, code) {
      const { error } = await auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) throw new UserFacingError('That code isn’t right, or it has expired. Check the newest email, or ask for a new code.', 'bad_code');
    },
    async signInWithGoogle() {
      const { error } = await auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      if (error) throw new UserFacingError("Google sign-in didn't start. Try again.");
    },
    async signOut() {
      await auth.signOut();
    },

    ...data,
  };
}

// src/config/env.ts
// ─────────────────────────────────────────────────────────────────────────────
// Which data this build shows.
// ─────────────────────────────────────────────────────────────────────────────
// Every VITE_ value is compiled into the app and readable by anyone, so only
// public values go here: Mole V3's project URL and anon key, and where the data
// comes from. Secrets are edge-function settings.
//
//   VITE_MOLE_API_URL        the Mole API gateway (https://api.mole.is). When set,
//                            all data goes through it (transport.ts, "gateway").
//   VITE_ANALYTICS_API_URL   this product's own function, used when the gateway
//                            isn't set ("direct", what the app did first).
//
//   sample  made-up data, with a banner on every page that says so
//   live    Mole V3 sign-in and the real backend
//   broken  a production build missing its settings: says so, shows no data
//
// A production build never falls back to sample data on its own. A customer
// who saw a believable funnel because a variable was missing would have no way
// to know it was invented.
// ─────────────────────────────────────────────────────────────────────────────

export type DataMode = 'sample' | 'live' | 'broken';

export interface LiveConfig {
  moleUrl: string;
  moleAnonKey: string;
  /** This product's `api` function (direct transport), or null when the gateway is used. */
  apiUrl: string | null;
  /** The Mole API gateway; when set, every data call goes through it. */
  gatewayUrl: string | null;
}

const e = import.meta.env;
const trimmed = (v: unknown) => (v ? String(v).replace(/\/+$/, '') : null);

export function readLiveConfig(env: Record<string, unknown>): LiveConfig | null {
  const apiUrl = trimmed(env.VITE_ANALYTICS_API_URL);
  const gatewayUrl = trimmed(env.VITE_MOLE_API_URL);
  return env.VITE_MOLE_SUPABASE_URL && env.VITE_MOLE_SUPABASE_ANON_KEY && (apiUrl || gatewayUrl)
    ? { moleUrl: String(env.VITE_MOLE_SUPABASE_URL), moleAnonKey: String(env.VITE_MOLE_SUPABASE_ANON_KEY), apiUrl, gatewayUrl }
    : null;
}

export const liveConfig: LiveConfig | null = readLiveConfig(e);

export const dataMode: DataMode =
  e.VITE_SAMPLE_DATA === 'true' ? 'sample'
    : liveConfig ? 'live'
    : e.DEV ? 'sample'
    : 'broken';

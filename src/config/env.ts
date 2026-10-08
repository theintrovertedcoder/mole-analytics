// src/config/env.ts
// ─────────────────────────────────────────────────────────────────────────────
// Which data this build shows.
// ─────────────────────────────────────────────────────────────────────────────
// Every VITE_ value is compiled into the app and readable by anyone, so only
// public values go here: Mole V3's project URL and anon key, and this
// product's own function URL. Secrets are edge-function settings.
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
  apiUrl: string;
}

const e = import.meta.env;

export const liveConfig: LiveConfig | null =
  e.VITE_MOLE_SUPABASE_URL && e.VITE_MOLE_SUPABASE_ANON_KEY && e.VITE_ANALYTICS_API_URL
    ? {
        moleUrl: String(e.VITE_MOLE_SUPABASE_URL),
        moleAnonKey: String(e.VITE_MOLE_SUPABASE_ANON_KEY),
        apiUrl: String(e.VITE_ANALYTICS_API_URL).replace(/\/+$/, ''),
      }
    : null;

export const dataMode: DataMode =
  e.VITE_SAMPLE_DATA === 'true' ? 'sample'
    : liveConfig ? 'live'
    : e.DEV ? 'sample'
    : 'broken';

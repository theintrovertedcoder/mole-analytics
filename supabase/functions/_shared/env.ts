// supabase/functions/_shared/env.ts
// ─────────────────────────────────────────────────────────────────────────────
// Every setting the two functions read, in one place.
// ─────────────────────────────────────────────────────────────────────────────
// Set in Supabase → Edge Functions → Secrets for the Mole Sense project
// (docs/YOUR_TURN.md has the link). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// are provided by Supabase itself and are not set by hand.
//
//   MOLE_SUPABASE_URL       Mole V3's project URL            (public value)
//   MOLE_SUPABASE_ANON_KEY  Mole V3's anon key               (public value)
//   APP_ORIGINS             where the app is served, comma-separated
//   PLEXYZ_API_URL          PLExyz cloud API base            (from reka.re)
//   PLEXYZ_API_KEY          our key for that API             (secret)
//   PLEXYZ_WEBHOOK_SECRET   what PLExyz signs deliveries with (secret)
//   VISITOR_KEY_SECRET      hashes visitor ids; any long random string (secret)
//
// A missing PLExyz value leaves pairing switched off with a plain message,
// not a crash, so the rest can be set up and checked before reka.re replies.
// ─────────────────────────────────────────────────────────────────────────────

import { createApiHandler, type ApiDeps } from './api.ts';
import { httpMoleClient } from './mole.ts';
import { httpPlexyzClient } from './plexyz.ts';
import { postgrestStore } from './store.ts';
import { createWebhookHandler } from './webhook.ts';

type Get = (k: string) => string | undefined;

function base(get: Get) {
  const supaUrl = get('SUPABASE_URL');
  const serviceKey = get('SUPABASE_SERVICE_ROLE_KEY');
  return { supaUrl, store: supaUrl && serviceKey ? postgrestStore(supaUrl, serviceKey) : null };
}

export function apiFromEnv(get: Get) {
  const { supaUrl, store } = base(get);
  const moleUrl = get('MOLE_SUPABASE_URL');
  const moleAnon = get('MOLE_SUPABASE_ANON_KEY');
  const plexUrl = get('PLEXYZ_API_URL');
  const plexKey = get('PLEXYZ_API_KEY');
  const deps: ApiDeps = {
    store,
    mole: moleUrl && moleAnon ? httpMoleClient(moleUrl, moleAnon) : null,
    plexyz: plexUrl && plexKey ? httpPlexyzClient(plexUrl, plexKey) : null,
    allowedOrigins: (get('APP_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean),
    webhookUrl: `${(supaUrl ?? '').replace(/\/+$/, '')}/functions/v1/plexyz_webhook`,
  };
  return createApiHandler(deps);
}

export function webhookFromEnv(get: Get) {
  return createWebhookHandler({
    store: base(get).store,
    webhookSecret: get('PLEXYZ_WEBHOOK_SECRET') ?? '',
    visitorSecret: get('VISITOR_KEY_SECRET') ?? '',
  });
}

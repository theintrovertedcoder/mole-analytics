# Architecture

## Three systems

| | Owns | This product talks to it with |
|---|---|---|
| **Mole V3** (Supabase `czuquiqpsjwpiqmcllbd`) | people, accounts, Loop orgs, events, sign-ups, contacts | the person's own Mole token, against `api_v1_*` only |
| **Mole Analytics** (its own Supabase project) | zones, sensors and their pairing, visits | the `api` edge function |
| **PLExyz cloud** (reka.re) | the sensors and what they detect | `_shared/plexyz.ts` out; `plexyz_webhook` in |

## A request, end to end

1. The browser signs in against **Mole V3's auth**: the same account as the Mole app.
2. Events and Mole outcomes come straight from **Mole V3**: `api_v1_my_events`,
   `api_v1_event`, `api_v1_event_outcomes`, `api_v1_my_orgs`. Mole V3's own
   rules decide what comes back.
3. Zones, sensors and the sensor numbers come from the **`api` function**, with
   the same Mole token. For each request it:
   - asks Mole V3 who the token is (`/auth/v1/user`);
   - asks Mole V3 whether they run the org (`api_v1_my_orgs`) or may see the
     event (`api_v1_event`);
   - only then reads or writes this project's database with the service role.
   Something that exists but isn't yours answers 404, the same as something
   that doesn't exist.
4. **PLExyz** posts to `plexyz_webhook`. The signature is checked before
   anything is parsed, the delivery id before anything is acted on, and the
   visitor id is hashed before it is stored.

## The database (`supabase/migrations/`)

`zones` · `devices` · `device_credentials` (kept apart so no `select *` returns
a token) · `presence_sessions` · `webhook_receipts`.

Nobody signs in to this database, so `anon` and `authenticated` get nothing:
RLS on with no policies, every grant revoked. `tests/db/run.mjs` attempts each
read and write as both and requires the refusal.

`presence_report()` computes the dashboard numbers in Postgres;
`_shared/presence.ts` computes the same numbers in TypeScript for sample mode.
The db test runs both on the same 3,000+ sessions (generated, plus hand-placed
boundary cases) across eleven views, and fails on any difference.

## Shared code

`supabase/functions/_shared/` is pure TypeScript (fetch and Web Crypto only),
loaded by both the edge runtime and Vite. The API's response types, the funnel
arithmetic, the QR rules and the window and threshold rules exist once. Sample
mode runs the server's own `presenceQuery()` and `presenceReport()`.

## The app (`src/`)

| | |
|---|---|
| `config/env.ts` | sample, live, or not configured: never falls back to sample on its own in production |
| `data/` | one `Backend` interface; `live/` and `sample/` implement it, loaded on demand |
| `domain/` | how numbers become sentences: funnel labels, insights, formats |
| `pages/` | events, the event dashboard, zones and sensors, sensors, pairing |
| `ui/` | the kit, the shell, and three charts |

First load is about 87 kB of JavaScript (gzip), checked by `npm run budget`.
The QR reader (jsQR, 47 kB) loads only when the camera opens, and only where
the browser has no built-in `BarcodeDetector`.

## Deploying

| What | Where | How |
|---|---|---|
| The app | Railway, from this repository | `railway.json`: `npm ci && npm run build`, then `npm start` |
| Migrations and functions | the Mole Analytics Supabase project | GitHub → Actions → **Deploy backend** → Run workflow |
| `api_v1` | Mole V3's project | V3 migration 119, pasted into V3's SQL editor |

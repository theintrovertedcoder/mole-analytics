# Mole Sense

**Feel the crowd.** For event organisers and exhibitors: who came, who visited
which booth, who stayed, and who connected. The counts come from
[PLExyz](https://reka.re) Wi-Fi presence sensors; the connections come from
Mole.

Moles barely see; they feel footsteps through the ground. The sensors work
the same way: they notice phones nearby and never see who anyone is. It will
live at **sense.mole.is**.

It is a separate product from Mole V3, with its own repository and its own
backend. People sign in with their Mole account, and it reads Mole only
through Mole V3's read-only `api_v1`.

```
 browser ──sign-in, events, outcomes──▶ Mole V3 (Supabase: auth + api_v1_* functions)
    │
    └──zones, sensors, numbers──▶ api ─┐   Mole Sense's own Supabase project
                                       ├─▶ zones · devices · presence_sessions
 PLExyz cloud ──signed webhooks──▶ plexyz_webhook ─┘
```

## Run it

```
npm install
npm run dev          # http://localhost:3000, on sample data
```

With no settings it runs on **sample data**, with a banner on every page saying
so. To use real data, copy `.env.example` to `.env.local` and fill it in.

## Checks

| | |
|---|---|
| `npm run check` | typecheck · lint · unit tests · build · first-load budget · secrets audit |
| `npm run test:db` | the database against a real Postgres 16 |
| `npm run test:e2e` | eight journeys in Chromium, with axe on each page |

CI runs all of them on every push.

## Where things are

| | |
|---|---|
| `src/` | the app (React 19, Vite, Tailwind on the Mole tokens) |
| `supabase/functions/_shared/` | the code the app and the server share: the funnel arithmetic, the QR rules, the API contract |
| `supabase/functions/api`, `plexyz_webhook` | the two edge functions |
| `supabase/migrations/` | this product's database |
| `brand/` | the Mole design tokens, copied from Mole V3 |
| `docs/YOUR_TURN.md` | what needs Haziq, in order |
| `docs/ARCHITECTURE.md` · `DECISIONS.md` · `PLEXYZ_INTEGRATION.md` · `BRIEF.md` | how and why |

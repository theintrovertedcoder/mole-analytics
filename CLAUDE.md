# Working notes for Claude

Mole Sense (sense.mole.is) is a sibling of Mole V3 (`mole-networking/Mole-V3`). Haziq's
standing rules from that repository's `CLAUDE.md` apply here too. The ones
that matter most, restated so they are in front of you:

## Haziq is the founder, not the ops engineer

- **Every dashboard request comes with the direct URL** to the exact page, and
  the CLI command as well as the link, never instead of it.
- **Never ask him to verify something with a terminal command.** Give him a
  URL he can open. `GET /functions/v1/api/health` exists for exactly that.
  If a command really can't be avoided: say where to type it (Win → `powershell`),
  use `curl.exe` not `curl`, and say what a good and a bad answer look like.
- `docs/YOUR_TURN.md` is his list for this product: in order, one step at a
  time, each with its link and a "Done when". Keep it current.

## Two projects, never mixed

- **Mole V3's Supabase project is `czuquiqpsjwpiqmcllbd`.** This product has its
  own project. The deploy workflow refuses V3's ref; do the same by hand.
- Mole V3 is read **only** through its `api_v1_*` functions (V3 migration 119).
  Never read a V3 table directly from here. A new need is a new `api_v1_*`
  function in V3, with V3's db assertions; a changed shape is `api_v2`.
- **Mole Admin is not in this product.** No staff override, no cross-org view.
  `api_v1` deliberately has no `is_admin` clause.

## Secrets

- PLExyz keys, the webhook secret, the visitor-key secret and service-role keys
  are **edge-function secrets**. Never a `VITE_` variable: those are compiled
  into the app. `npm run audit:secrets` checks the build.
- Log at most the first 8 characters of any secret. Never commit one.

## Honest numbers

- **Never show a number that isn't true.** A step with no sensor says "not
  measured" and what would measure it. Insights only appear when there is
  enough data behind them. A production build without its settings shows
  nothing rather than sample data.
- The funnel arithmetic exists twice: `supabase/functions/_shared/presence.ts`
  and `presence_report()` in the migration. `npm run test:db` holds them equal.
  Change one, change the other.
- Visitor identifiers are stored only as HMAC(secret, event id + raw id).

## Gates, every change

`npm run check` · `npm run test:db` · `npm run test:e2e`. A test that passes
has proved nothing until you have watched it fail: mutate the code and confirm
it is caught. Check colour contrast numerically (`tests/unit/brand.test.ts`),
never by eye.

## Branding

`brand/` is copied from Mole V3 and must stay identical to it; change the
design system there and copy the three files over. Tailwind colours are the
token variables, nothing else.

## Git

Develop on the branch the session names, commit per task, push. Before every
push check ancestry (`git merge-base --is-ancestor origin/<branch> HEAD`): the
container has rolled back mid-session before.

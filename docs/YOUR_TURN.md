# Your turn: Mole Sense

**Everything on this page needs you.** In order: each step unblocks the next.
No step needs a terminal.

What you get at the end: the app on its own address, signing people in with
their Mole account and showing their real events. Sensor numbers start as soon
as PLExyz is connected (step 8). Until then the app says plainly that pairing
isn't connected yet; it doesn't show made-up numbers.

To see it working before any of this, the app runs on sample data with a
banner saying so. Steps 1–7 replace that with the real thing.

---

## ☐ 1 · Let Mole Sense read Mole · 2 minutes

This is **B26** on Mole V3's own list, and the same thing:

**1.** Open the migration, press **Raw**, select all, copy:
**https://github.com/mole-networking/Mole-V3/blob/claude/sleepy-ramanujan-hr1ygm/supabase/migrations/119_analytics_api_v1.sql**

**2.** Paste it into Mole V3's SQL editor and press **Run**:
**https://supabase.com/dashboard/project/czuquiqpsjwpiqmcllbd/sql/new**

A good answer is one row reading **`4 | 0`**. It only adds four read-only
functions that answer with counts; it changes nothing that exists.

→ **Done when:** the row reads `4 | 0`.

## ☐ 2 · Create the Mole Sense Supabase project · 5 minutes

**https://supabase.com/dashboard/new**

- Name: **Mole Sense**. Region: **Southeast Asia (Singapore)**, the same as Mole V3.
- **Save the database password** in your password manager. Step 3 needs it.
- **This is a new project, not Mole V3.** Nothing about Mole V3 changes.

When it's ready, its address is `https://<ref>.supabase.co`. **Send me the
ref** (the 20 letters). I'll put the exact links for steps 4–5 on this page.

→ **Done when:** the project's dashboard opens and you have the ref and the password.

## ☐ 3 · Give GitHub what it needs to deploy · 5 minutes

**a.** Make a Supabase access token. Name it `mole-sense deploy`:
**https://supabase.com/dashboard/account/tokens**

**b.** Add three repository secrets here (**New repository secret** for each):
**https://github.com/theintrovertedcoder/mole-analytics/settings/secrets/actions**

| Name | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | the token from **a** |
| `SUPABASE_PROJECT_REF` | the **new** project's ref from step 2 (not Mole V3's) |
| `SUPABASE_DB_PASSWORD` | the database password from step 2 |

→ **Done when:** all three names are listed on that page.

## ☐ 4 · Deploy the backend · 1 click, ~3 minutes

**https://github.com/theintrovertedcoder/mole-analytics/actions/workflows/deploy-backend.yml**
→ **Run workflow** → **Run workflow**.

It creates the tables and deploys the two functions. It refuses to run if the
ref is Mole V3's, so a mix-up can't land in Mole.

→ **Done when:** the run shows a green tick.

## ☐ 5 · The backend's settings · 10 minutes

In the **new** project: **Edge Functions → Secrets** (`…/project/<new ref>/settings/functions`).
Add:

| Name | Value |
|---|---|
| `MOLE_SUPABASE_URL` | `https://czuquiqpsjwpiqmcllbd.supabase.co` |
| `MOLE_SUPABASE_ANON_KEY` | Mole V3's **anon public** key: https://supabase.com/dashboard/project/czuquiqpsjwpiqmcllbd/settings/api |
| `APP_ORIGINS` | the app's address from step 6, `https://sense.mole.is` (more than one: separate with commas) |
| `VISITOR_KEY_SECRET` | a long random password from your password manager's generator, 40+ characters. **Never change it once events are counted**: it would split everyone into new visitors |

Leave the three `PLEXYZ_…` settings for step 8.

**Check it in a browser:** `https://<new ref>.supabase.co/functions/v1/api/health`

- **Good:** `{"ok":true,"database":true,"moleV3":true,"plexyz":false}`
- `"database":false`: step 4 didn't finish. Open its run and send me the red step.
- `"moleV3":false`: `MOLE_SUPABASE_URL` or `MOLE_SUPABASE_ANON_KEY` is wrong. Copy them again from the links above.
- A "not found" page: the functions aren't deployed. Run step 4 again.

→ **Done when:** the health page shows `"ok":true`.

## ☐ 6 · Put the app online · 15 minutes on Railway

**https://railway.app** → **New project** → **Deploy from GitHub repo** →
`theintrovertedcoder/mole-analytics`. It reads `railway.json` by itself.

**Variables** on that service (these three are public by design, safe in Railway):

| Name | Value |
|---|---|
| `VITE_MOLE_SUPABASE_URL` | `https://czuquiqpsjwpiqmcllbd.supabase.co` |
| `VITE_MOLE_SUPABASE_ANON_KEY` | Mole V3's anon public key (same as step 5) |
| `VITE_ANALYTICS_API_URL` | `https://<new ref>.supabase.co/functions/v1/api` |

Then give it its address, **sense.mole.is**:

**a.** In Railway, on the service: **Settings → Networking → Custom Domain** →
type `sense.mole.is`. Railway shows a **CNAME target** (it ends in
`.up.railway.app`). Copy it.

**b.** In Cloudflare, where mole.is lives: **https://dash.cloudflare.com/** →
**mole.is** → **DNS** → **Records** → **Add record**:
Type **CNAME** · Name **`sense`** · Target: what you copied · Proxy status
**DNS only** (the grey cloud), so Railway can issue the certificate.

Railway's Custom Domain row turns green within a few minutes.

**Never add a `VITE_` variable holding a secret.** Everything starting `VITE_`
is readable by anyone who opens the site.

→ **Done when:** **https://sense.mole.is** shows "Sign in with your Mole
account", with no yellow sample-data banner.

## ☐ 7 · Let Mole sign-in come back to the new site · 2 minutes

Mole V3 only sends people back to addresses it knows. Add
**`https://sense.mole.is/**`** under **Redirect URLs**:
**https://supabase.com/dashboard/project/czuquiqpsjwpiqmcllbd/auth/url-configuration**

Only add to that list. **Don't change the Site URL.**

→ **Done when:** "Continue with Google" on sense.mole.is lands you on **Your
events**, showing your Loop org's events.

## ☐ 8 · Connect PLExyz · **waiting on reka.re**

Send reka.re the questions in `docs/PLEXYZ_INTEGRATION.md` (*What we assumed,
and the question that settles each*). Their answers decide the last piece of
code, and I change it when they arrive. Then, in the new project's
**Edge Functions → Secrets**:

| Name | From |
|---|---|
| `PLEXYZ_API_URL` | reka.re |
| `PLEXYZ_API_KEY` | reka.re |
| `PLEXYZ_WEBHOOK_SECRET` | reka.re, or agreed with them |

And give reka.re our webhook address: `https://<new ref>.supabase.co/functions/v1/plexyz_webhook`

→ **Done when:** the health page shows `"plexyz":true` and a scanned sensor
shows "Waiting for approval" in **Sensors**.

## ☐ 9 · Privacy before real visitors are counted

The sensors count phones of people who never signed up for anything. Before the
first real event: venue signage, a retention period, and the same PDPA review
Mole V3 is getting. Add it to the lawyer's email (Mole V3 YOUR_TURN B2).

→ **Done when:** the lawyer has said yes, or said what to change.

## ~~☐ 10 · The name~~ · **done, 8 Oct**

**Mole Sense**, at **sense.mole.is**. *Feel the crowd.* The app, the docs and
the setup steps above all use it. Before announcing it publicly, check that
"Mole Sense" is free to trademark in Malaysia: **https://iponline.myipo.gov.my/**

→ **Done when:** named. ✓

---

## What unblocks what

| You finish | I can start |
|---|---|
| **2** · the project ref | exact links on this page for steps 4–5 |
| **8** · reka.re's answers | the real PLExyz client, replacing the assumed one |
| a decision on **what organisers pay for** (`docs/DECISIONS.md`, the last section) | the features that make it worth a subscription |

# Your turn: Mole Sense

**Everything on this page needs you.** In order: each step unblocks the next.
No step needs a terminal.

What you get at the end: the app on its own address, signing people in with
their Mole account and showing their real events. Sensor numbers start as soon
as PLExyz is connected (step 8). Until then the app says plainly that pairing
isn't connected yet; it doesn't show made-up numbers.

**It is already online at https://sense.mole.is** (8 Oct), on sample data, with
a yellow banner on every page saying so. It asks for no password and search
engines are told not to list it. Steps 1–5 and 7 replace the sample with the
real thing (with 7b for the sign-in code); step 6 is done.

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
| `APP_ORIGINS` | the app's address, `https://sense.mole.is` (more than one: separate with commas) |
| `VISITOR_KEY_SECRET` | a long random password from your password manager's generator, 40+ characters. **Never change it once events are counted**: it would split everyone into new visitors |

Leave the three `PLEXYZ_…` settings for step 8.

**Check it in a browser:** `https://<new ref>.supabase.co/functions/v1/api/health`

- **Good:** `{"ok":true,"database":true,"moleV3":true,"plexyz":false}`
- `"database":false`: step 4 didn't finish. Open its run and send me the red step.
- `"moleV3":false`: `MOLE_SUPABASE_URL` or `MOLE_SUPABASE_ANON_KEY` is wrong. Copy them again from the links above.
- A "not found" page: the functions aren't deployed. Run step 4 again.

**Then let the uptime check watch it** (30 seconds). GitHub already checks
sense.mole.is every half hour and emails you if it's down. To have it check the
backend too, add a variable named **`HEALTH_URL`** with the health address above
as its value:
**https://github.com/theintrovertedcoder/mole-analytics/settings/variables/actions/new**

→ **Done when:** the health page shows `"ok":true`, and the variable is saved.
The next run here says "and the backend is healthy":
**https://github.com/theintrovertedcoder/mole-analytics/actions/workflows/uptime.yml**

## ~~☐ 6 · Put the app online~~ · **done, 8 Oct**

**https://sense.mole.is** is live, hosted on Cloudflare the same way as
rally.mole.is and bingo.mole.is (a Worker named `mole-sense`). Cloudflare made
the address and its certificate; there was nothing to set up by hand.

**Look at it now:** open https://sense.mole.is

- **Good:** a yellow line across the top saying "Sample data", then
  "Feel the crowd." and an **Explore the sample** button. That button opens the
  sample events.
- **"This site can't be reached" or a certificate warning:** Cloudflare was
  still issuing the certificate. Wait ten minutes and reload.
- **Anything else:** send me a screenshot.

**Going from sample to real** happens after steps 1–5. Tell me the new
project's ref and I redeploy with the real settings (`npm run deploy`, which
refuses to run without them). The site moves from sample to real in one go.

→ **Done when:** https://sense.mole.is shows the sample, as above. ✓

## ☐ 7 · Let Mole sign-in come back to the new site · 2 minutes

Needed once the site is on real data (after step 5). Mole V3 only sends
people back to addresses it knows. Add **`https://sense.mole.is/**`** under
**Redirect URLs**:
**https://supabase.com/dashboard/project/czuquiqpsjwpiqmcllbd/auth/url-configuration**

Only add to that list. **Don't change the Site URL.**

→ **Done when:** "Continue with Google" on sense.mole.is lands you on **Your
events**, showing your Loop org's events.

## ☐ 7b · Mole's emails: the sign-in code, and a friendlier look · 20 minutes

Needed once the site is on real data. Mole Sense now signs people in with a
6-digit code from their email (no password to make or forget), using Mole V3's
own sign-in. Mole's emails don't print a code yet, and they are plain, so this
step gives all six a code where it belongs and Mole's look, with Sunny. It
comes after the sender is set up (0a to 0d, done 9 Oct).

**First, Mole V3 must send its own emails.** Supabase won't let you edit the
email templates until a custom email sender (SMTP) is set up: the Magic Link
page shows "Set up custom SMTP to edit templates". Mole V3's launch runbook
already plans this switch to Resend, which Mole V3 uses for its other emails.

**0a.** Use the Resend key Mole V3 already sends its emails with (the one saved
as `RESEND_API_KEY`). Supabase never shows a saved secret again, so copy it from
wherever you keep it (your password manager). If you can't find it, make a new
one at Resend (Sending access is enough): Resend shows a key only once, and the
old one keeps working.
**https://resend.com/api-keys**
**Never paste the key into a chat or a file.**

**0b.** The sender is the one Mole V3 already uses, `Mole <noreply@mole.is>`, so
its domain is already set up. You can check the domain still says **Verified**:
**https://resend.com/domains**

**0c.** On the Magic Link page, press **Set up SMTP**:
**https://supabase.com/dashboard/project/czuquiqpsjwpiqmcllbd/auth/templates**
Fill in: host `smtp.resend.com`, port `465`, username `resend`, password = the
key from 0a, sender email `noreply@mole.is`, sender name `Mole`. Save.

**0d.** In Resend, check the **Emails** list shows the test email Supabase sends:
**https://resend.com/emails**

Then:

**1.** Paste the six new emails. They are Mole's colours with Sunny, one for
each email Supabase sends. **Start with Magic link or OTP and Confirm signup**:
those two carry the sign-in code, so they matter most. The other four are the
same look for the rest.

For each row below: open the link, press **Raw**, select all, copy. Then open
Mole V3's email templates, choose that template **by name**, press **Source**,
select everything in the body, paste, set the **Subject** to the one in the
row, and press **Save**:
**https://supabase.com/dashboard/project/czuquiqpsjwpiqmcllbd/auth/templates**

| Template (its name in Supabase) | Paste this file | Subject |
|---|---|---|
| **Confirm signup** | [confirm-signup.html](https://github.com/theintrovertedcoder/mole-analytics/blob/claude/sleepy-ramanujan-hr1ygm/docs/paste/emails/confirm-signup.html) | `Welcome to Mole: confirm your email` |
| **Magic link or OTP** | [magic-link-or-otp.html](https://github.com/theintrovertedcoder/mole-analytics/blob/claude/sleepy-ramanujan-hr1ygm/docs/paste/emails/magic-link-or-otp.html) | `Your Mole sign-in code` |
| **Invite user** | [invite-user.html](https://github.com/theintrovertedcoder/mole-analytics/blob/claude/sleepy-ramanujan-hr1ygm/docs/paste/emails/invite-user.html) | `You are invited to Mole` |
| **Reset password** | [reset-password.html](https://github.com/theintrovertedcoder/mole-analytics/blob/claude/sleepy-ramanujan-hr1ygm/docs/paste/emails/reset-password.html) | `Reset your Mole password` |
| **Change email address** | [change-email-address.html](https://github.com/theintrovertedcoder/mole-analytics/blob/claude/sleepy-ramanujan-hr1ygm/docs/paste/emails/change-email-address.html) | `Confirm your new Mole email address` |
| **Reauthentication** | [reauthentication.html](https://github.com/theintrovertedcoder/mole-analytics/blob/claude/sleepy-ramanujan-hr1ygm/docs/paste/emails/reauthentication.html) | `Your Mole confirmation code` |

Replace the whole body each time. Each file already has its link or code in it
(`{{ .ConfirmationURL }}`, `{{ .Token }}`), so there is nothing to keep from
the old one.

The pictures load from **https://sense.mole.is/email/**, which is live now.
Press **Preview** after pasting: you should see the Mole logo, a purple band,
and Sunny on a pale yellow circle. If the pictures are missing, that address
isn't answering: tell me.

→ **Done when:** all six show Sunny in **Preview**, and (after steps 1 to 5)
on sense.mole.is you type your email, press **Email me a code**, get an email
with six digits in it, type them, and land on **Your events**. A bad answer is
an email with only a link and no number: Magic link or OTP wasn't saved.

## ☐ 7c · Let the uptime check and the email pictures through Cloudflare · 10 minutes

**What I found (9 Oct).** Cloudflare, which sits in front of sense.mole.is,
answers GitHub's servers with a challenge ("prove you're human"), so the
half-hourly uptime check can't tell whether the site is up. The same could
happen to the pictures in the emails (Sunny, the logo), which Gmail fetches from
`https://sense.mole.is/email/`. People in a browser pass a challenge; robots
don't. The check is **paused** until this is done, so you aren't emailed every
half hour.

**1.** Open the Cloudflare dashboard for mole.is, Security, WAF, Custom rules:
**https://dash.cloudflare.com/e8c3362874d534ce0c1c3d9d1d324f12/mole.is/security/waf/custom-rules**
(I couldn't open it from here, so if it says "not found": go to
https://dash.cloudflare.com, choose **mole.is**, then **Security → WAF →
Custom rules**.)

**2.** Press **Create rule** and fill it in:
- **Rule name:** `Let Mole Sense's uptime check and email pictures through`
- **When incoming requests match:** use **Edit expression** and paste:

      (http.host eq "sense.mole.is") and ((http.user_agent contains "MoleSenseUptime") or (starts_with(http.request.uri.path, "/email/")))

- **Then take action:** **Skip**, and tick every box it offers, including
  **All remaining custom rules**, **All managed rules**, **All Super Bot Fight Mode Rules** (if shown), **Browser Integrity Check** and **Security Level**.
- Press **Deploy**.

That opens only two things: the check (by its name in the request) and the
pictures in `/email/`. Both are public. Anyone can fake the name, and all that
gets them is the public site, which anyone can already open.

**3.** If Cloudflare says a box isn't available on your plan, or the check is
still challenged after step 2: open **Security → Bots**
(**https://dash.cloudflare.com/e8c3362874d534ce0c1c3d9d1d324f12/mole.is/security/bots**).
If **Bot Fight Mode** is on, it can't be skipped by a rule on the free plan.
Turning it off affects all of mole.is, so that's your call: tell me which you
want (turn it off, or leave it on and I'll host the email pictures somewhere
else and stop the uptime check).

**4.** Run the check by hand: press **Run workflow** here:
**https://github.com/theintrovertedcoder/mole-analytics/actions/workflows/uptime.yml**

→ **Done when:** that run is green and ends with **is up**. Tell me, and I'll
turn the half-hourly schedule back on.

Then, once the six emails are pasted (7b), send a real sign-in code to a
**Gmail** address of yours: Gmail fetches the pictures through its own proxy,
which is the case worth seeing with your own eyes. If Sunny is missing there,
tell me and say which email program you used.

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

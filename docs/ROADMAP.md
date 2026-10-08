# Mole Sense — what's wrong, and the road to a proper events platform

Written 8 Oct 2026, against the code at sense.mole.is and the brand in
[sunny-kit](https://github.com/theintrovertedcoder/sunny-kit) (`brand/brand-book.md`,
`brand/loop-brand.md`, `docs/brand.md`, `docs/products.md`).

**Where it stands:** the funnel, charts, zones, sensor pairing and the backend
are built and tested, and sense.mole.is shows them on sample data. Nothing
real runs yet: the backend isn't deployed, PLExyz isn't connected, and only
people with a Mole account can sign in.

Every item has an ID. Overrule or reorder by naming it.

---

## 0 · Decisions only you can make (before the brand pass)

These are brand-owner calls. The kit marks rules like them **TBD** and says
engineers mustn't guess them, so I haven't.

| # | Decision | Why it matters | My recommendation |
|---|---|---|---|
| **D-1** | **Which colour set is canonical?** sunny-kit's design-team export and Mole V3's `brand/` disagree on 24 values: ink `#111111` vs `#16131F`, cool greys vs purple-tinted greys, three status text colours, `brand-purple-text` `#784CDA` vs `#6A3FC7`. Mole Sense copied V3's. | Two Mole products would look subtly different side by side | Pick one and copy it to both repos. V3 moved to `#16131F` on 3 Oct, after the export, so ask the design team to re-export from that. |
| **D-2** | **What is Mole Sense in the product family?** The brand has six surfaces (app, public pages, den, Loop, Events, Spaces) and each has its own main button colour. Mole Sense isn't one of them; today it borrows the app's purple. | Decides the page ground, the main button colour and the sidebar | **A Loop add-on, named by the word "Sense"** like "Loop" is: on `loop-ground`, Loop's sidebar pattern, organisation's name first. It's for organisations, and Loop already holds their events. |
| **D-3** | **The funnel ribbon is a fourth gradient.** The book allows three (glow, pro, placeholder); the purple-to-yellow stream isn't one of them. | The funnel is the screen people will remember | Ask the design team for a sanctioned "flow" gradient, or switch to single-hue purple steps (allowed today, less striking). |
| **D-4** | **Sunny and the funnel on a dark panel.** The dark `board` colours come from V3/Rally, not the design-team export, and how Sunny sits on dark is **TBD**: until decided, the kit puts Sunny on a light card or behind a white die-cut. | Same screen | Decide with D-3. Until then, give Sunny the die-cut border. |
| **D-5** | **What organisers pay for, and how much** | Phases 5–6 depend on it | See `DECISIONS.md`, the last section. |

---

## 1 · What's wrong today

### Brand (fixes, no decisions needed)

| # | Wrong | Fix |
|---|---|---|
| **W-1** | `mole-logo.svg` and `mole-badge.svg` are V3's copies, not byte-identical to sunny-kit's canonical files | Copy `sunny-kit/brand/logos/` over them; add a test that they match |
| **W-2** | The header puts the badge beside "Mole Sense" in bold, which reads as a product logo. The brand says products have no logos and are named by the word | Mole logo, then "Sense" in `micro` caps, then the organisation's name, as Loop's dashboard does |
| **W-3** | Some tap targets are under 44 × 44px: the funnel's ⓘ buttons, rename/delete on zones, the sheet's close button | Grow the hit areas |
| **W-4** | Status pills ("Reporting", "Waiting for approval", "Not allowed") are colour and word with no icon. The book wants an icon too, because success and Loop share one green | Add the icons |
| **W-5** | Motion outside the three brand durations: the ribbon morph (650ms), the goal bar (700ms) | 300ms, the *enter* curve |
| **W-6** | Waiting and empty states use a spinner or an icon, not Sunny | Sunny's `loading`, `thinking`, `sleeping` and `404` moods, on a `brand-yellow-tint` disc |
| **W-7** | Deleting and unpairing use the browser's own `confirm()` box | A proper Mole dialog on `z-modal` |
| **W-8** | `neutral-fg-subtle` is used on the page background (the funnel's footnote, the insights footer); the book allows it on white surfaces only, and wants placeholders in `neutral-fg-disabled` | `neutral-fg-muted` on the page; placeholders as the book says |

### Data: the numbers could be wrong

| # | Wrong | Fix |
|---|---|---|
| **W-9** | **Booth staff count as visitors.** Their phones sit at the stand all day and pass every "stayed" threshold, so a stand with four staff gains four highly engaged visitors per day. The biggest accuracy problem. | Let the organiser or exhibitor register staff devices (via PLExyz), and leave out any one phone present more than N hours |
| **W-10** | **Neighbouring booths double-count.** A phone between two booths can be seen by both sensors | Attribute each moment to the strongest signal, if PLExyz gives signal strength (question 10 in `PLEXYZ_INTEGRATION.md`) |
| **W-11** | We don't know the sensors' range, or how they handle phones that change their Wi-Fi address (MAC randomisation) | Ask reka.re; calibrate at the first real event against a hand count |
| **W-12** | Times are fixed to Malaysia | A time zone per event, once Mole V3 events have one |
| **W-13** | The connection goal is kept only in one browser | Store it with the event, shared by its team |

### Not live yet

| # | Wrong | Fix |
|---|---|---|
| **W-14** | The backend has never been deployed, migration 119 hasn't run, and the V3 branch isn't merged | `YOUR_TURN.md` steps 1–5, then a pull request in Mole V3 |
| **W-15** | The PLExyz connection is built on assumptions | reka.re's API docs (`YOUR_TURN` step 8) |
| **W-16** | Nothing tells us when it breaks: no error tracking, no uptime check | Sentry and an uptime check on `/api/health` |

### Sign-in and access

| # | Wrong | Fix |
|---|---|---|
| **W-17** | Sign-in needs an existing Mole account with a password or Google. There's no sign-up, no "forgot password", and no way in for someone the organiser invites | Phase 1 |
| **W-18** | Who sees what comes only from Loop roles in Mole V3. An organiser can't give an exhibitor access to just their own booth at the organiser's event, and there's no read-only viewer | Phase 3 |

### Scale and housekeeping

| # | Wrong | Fix |
|---|---|---|
| **W-19** | Every report reads every visit. Fine for a day of a few thousand people; slow for a week-long expo | Hourly roll-up tables |
| **W-20** | Each request asks Mole V3 who the user is, up to three times | Cache it for a minute |
| **W-21** | No retention: visits are kept for ever. No rate limits, no audit log of who changed what | Phase 6 |

---

## 2 · The plan

Each phase ends with something an organiser can use. Times assume one of me,
working the way this repo has been built so far.

### Phase 1 · Simple sign-in, live, on brand · ~1 week

| # | What | Done when |
|---|---|---|
| **1.1** | **Sign in with an email code.** Type your email and get a 6-digit code; no password. It creates the Mole account if there isn't one. Google stays. Uses Mole V3's own sign-in, so it's still one Mole account. | Someone with no Mole account is looking at their events within a minute |
| **1.2** | **First-run setup.** A new organiser names their organisation and first event in two screens (creates the Loop organisation in Mole V3 through a new `api_v1` function) | A brand-new organiser reaches "add your first zone" with no help |
| **1.3** | **Invitations.** Invite a teammate by email; they get a link and a code | An invited teammate sees the event, and nothing else |
| **1.4** | **Go live:** W-14, W-16, real-data deploy | sense.mole.is shows real events; the health page is green |
| **1.5** | **Brand pass:** W-1 to W-8, plus D-1 to D-4 once decided | A screen-by-screen check against the kit passes |
| **1.6** | **Staff don't count** (W-9) | A test stand with staff phones shows only the visitors |

### Phase 2 · Floor plans, booths, sensors, logos · ~3 weeks

| # | What | Done when |
|---|---|---|
| **2.1** | **Upload a floor plan** (image or PDF) per event, and set its scale by marking one known distance | The plan shows behind the setup screen at the right size |
| **2.2** | **Draw zones on the plan**: rectangles or outlines for the hall, entrances, booths and rooms, with booth numbers. Replaces today's list | An organiser lays out a 40-booth hall in under 15 minutes |
| **2.3** | **Place sensors on the plan**: drag a paired sensor onto its spot. Its range is drawn as a circle, with warnings where circles overlap (W-10) or leave gaps | Every booth shows whether it's covered |
| **2.4** | **Test a sensor**: a live view of what each sensor sees right now, for set-up day | The person installing can walk past and watch the number move |
| **2.5** | **Exhibitors and booths**: each booth gets an exhibitor (company, logo, category, sponsor tier, contact), typed in or imported from the organiser's spreadsheet | 200 exhibitors imported from one CSV |
| **2.6** | **Logos**: the organisation's own name and logo first on every screen and report, exhibitors' logos on their booths, "Powered by Mole" at the foot, as the Loop rules require. Mole V3's `api_v1` gains the organisation's logo | An organiser's logo is on their dashboard |
| **2.7** | **Heat map**: the floor plan coloured by how busy each zone was, with a time slider to replay the day | "Which corner was dead at 3pm?" answered by looking |
| **2.8** | **Flows**: the most common paths between zones (entrance → booth A → stage) | The top five routes, drawn on the plan |

### Phase 3 · Access and exhibitor analytics · ~2 weeks

| # | What | Done when |
|---|---|---|
| **3.1** | **Roles in Mole Sense**: owner, editor, viewer, and **exhibitor** (one booth only) | Each role sees exactly its share, and the tests attempt the rest, as Mole V3's do |
| **3.2** | **Invite an exhibitor to their booth.** The organiser invites by email; the exhibitor signs in with a code and sees only their booth | An exhibitor can't see another booth's numbers by any route |
| **3.3** | **The exhibitor dashboard**: their funnel; how they compare with the event's typical booth and its top quarter (anonymous); their busiest hours; how long visits lasted (a histogram); returning visitors; leads from their Mole stand page and card taps at the booth | An exhibitor knows if their stand worked, without asking the organiser |
| **3.4** | **Share a view-only link** with a sponsor or a boss, expiring after a set time | Opens with no account; stops working when it expires |
| **3.5** | **Exhibitors who use Mole** see the booth in their own Mole Sense events list too | No second login for an exhibitor already on Mole |

### Phase 4 · Live, and alerts · ~2 weeks

| # | What | Done when |
|---|---|---|
| **4.1** | **Live now**: people in each zone at this moment, updating by itself | The organiser's screen at the venue moves without a reload |
| **4.2** | **Alerts**: a zone over its capacity, a queue at an entrance, a sensor gone quiet or low on battery, a goal reached, and for exhibitors, the stand quiet for half an hour | Each alert reaches the right person within a minute |
| **4.3** | **Where alerts go**: email, plus phone notifications or WhatsApp; quiet hours; who gets which | An organiser chooses in one screen |
| **4.4** | **An alert log**: what fired, when, and who saw it | After the event, "did we know about the queue?" has an answer |

### Phase 5 · Reports, and the reasons to pay · ~2 weeks

| # | What | Done when |
|---|---|---|
| **5.1** | **Post-event report**, as a PDF with the organiser's logo: the whole event, and one per exhibitor or sponsor | An organiser sends 40 sponsor reports in one click |
| **5.2** | **Spreadsheet export**, and a daily summary by email during a multi-day event | |
| **5.3** | **Compare** days, events, and this year against last | |
| **5.4** | **Plans and billing** (D-5): what's free, what organisers pay for, the exhibitor add-on organisers can resell; payment through Stripe, as Mole V3 does | An organiser can start a paid plan alone |
| **5.5** | **Booth pricing evidence**: footfall per spot on the floor plan across past events, for setting next year's prices | |

### Phase 6 · Hardening · ongoing

| # | What |
|---|---|
| **6.1** | Hourly roll-ups (W-19), caching Mole V3 answers (W-20) |
| **6.2** | **PDPA**: a printable venue sign with a QR to a plain-language notice, a retention period with automatic deletion, and a written agreement with reka.re |
| **6.3** | Rate limits, an audit log, a staging copy |
| **6.4** | Bahasa Malaysia; time zones per event (W-12) |

---

## 3 · What I need from you, in order

1. **D-1 to D-4**: the brand decisions, or the go-ahead to ask the design team.
2. `YOUR_TURN.md` steps 1–5, so Phase 1 can go live.
3. **reka.re**: their API, and the answers to W-10 and W-11 (signal strength, range, address randomisation).
4. **One friendly organiser and one exhibitor** for the first real event. W-9 and W-11 can only be checked against a real crowd and a hand count.
5. **D-5**: what to charge for, before Phase 5.

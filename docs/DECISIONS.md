# Decisions

The calls made to get from the prototype to a real product, so work could go
ahead without stopping on each one. **Overrule any of them by naming the line.**

| # | Decision | Why |
|---|---|---|
| **D1** | **A separate product**: own repository, own Supabase project, own deploy | Haziq, 6 Oct. Its data (sensors, visits) has a different owner, different privacy rules and different scale from Mole's. A second project keeps a bug here away from Mole's users. |
| **D2** | **Sign in with the Mole account**: Mole V3's own Supabase auth, no second login | One account, and the person's Loop orgs and events are already there. |
| **D3** | **Mole V3 is read only through `api_v1_*`** (V3 migration 119), never its tables | Another repository reading V3's tables breaks silently on any rename. The four functions are the contract and V3's db tests guard them. |
| **D4** | **V3 decides who sees what.** Every backend request asks V3 who the token is (`/auth/v1/user`) and what they run (`api_v1_*`) | Copying Mole's JWT secret here would put V3's most powerful secret in a second project and keep accepting revoked tokens. |
| **D5** | **No Mole Admin in this product.** `api_v1` leaves out `is_admin`, so staff see only what their own memberships give them | The Mole Admin / Loop line in V3's CLAUDE.md. |
| **D6** | **Who may pair sensors**: an active OWNER or ADMIN of the org whose scope is ORG or EVENTS. **Who may see an event's numbers**: that, or an editor of that event | Mirrors V3's `loop_member_can(…, 'EVENTS')` and `can_manage_event`, minus staff (D5). |
| **D7** | **Zones belong to an event; sensors belong to an org** and are placed in a zone | A sensor moves between events; what it counted stays filed under the zone it was in at the time. |
| **D8** | **A zone with history cannot be deleted**, only renamed | Deleting it would silently change every past report that included it. |
| **D9** | **One sensor, one org at a time**, enforced by a unique index | Two orgs counting the same sensor would both quote its numbers. |
| **D10** | **Visitor ids are stored only as HMAC(secret, event id + raw id)** | Same phone = one visitor across a multi-day event; can't be matched across events or back to the phone. Per calendar day was the first idea and would have split everyone at 8am Malaysia time (UTC midnight). |
| **D11** | **Funnel**: at the event (venue/entrance sensors) → visited (booths) → stayed ≥ threshold → (exhibitor only) left their details | The prototype's four steps, but each one is a number we can actually measure. A step with no sensor says "not measured". |
| **D12** | **"Stayed" means one visit at least the threshold long**, not total time | Two glances are not a conversation. |
| **D13** | **Medians, not means**, for dwell time | One phone on a charger behind the stand for nine hours would wreck a mean. |
| **D14** | **Sample mode runs the real rules on made-up input**, with a banner on every page; a production build missing its settings shows an error, never sample data | The prototype's numbers were fixed ratios; a demo must not show what the product can't produce, and fake numbers on a real site would look real. |
| **D15** | **Times shown in Malaysia time** (`DISPLAY_TIME_ZONE`) | V3 events have no time zone yet; every event so far is in Malaysia. When V3 adds one, it replaces the constant. |
| **D16** | **Insights are computed and need ≥ 20 people**; no staffing advice | The prototype's insights were fixed sentences. Advice comes later, once there is data to test it against. |
| **D17** | **PLExyz behind one adapter** (`_shared/plexyz.ts`) whose HTTP shapes are assumed | Lets everything else be built and tested before reka.re's API docs arrive; only that file changes when they do. |
| **D18** | **Backend deploys from a GitHub Actions button**, not a terminal | Haziq's rule: no terminal commands. The workflow refuses to deploy into Mole V3's project. |
| **D19** | **Light only** | The Mole design tokens have no dark set yet. |
| **D20** | **The name is Mole Sense, at `sense.mole.is`** (Haziq, 8 Oct; "Mole Analytics" until then) | Moles barely see and feel footsteps through the ground, which is how the sensors work, privacy included. "Sense" needs no explaining; "analytics" sounded generic and the address could be wanted for something else. Runners-up: Molehill (sounds trivial: "a mountain out of a molehill"), Mole Footfall (barely Mole). |
| **D21** | **Hosted on Cloudflare** (a Worker serving `dist/`), not Railway | mole.is and the other Mole sites (rally, bingo, arcade, archive, preview) are already there; one place, automatic certificate, no new account. |
| **D22** | **sense.mole.is shows the sample until the backend is live** (8 Oct), with the banner, `noindex`, and no password form | Haziq wanted it live at the new address; the backend needs his accounts first. A sample that took passwords would teach people to type their Mole password into the wrong page. |

## Not decided, and not built

What makes organisers **pay** for this. Analytics alone won't. Ideas raised so
far (6 Oct): booth pricing backed by measured footfall, a leads-and-footfall
pack organisers resell to exhibitors, live crowd and capacity alerts, ready-made
sponsor reports, and an attendee booth trail with Mole cards. Needs its own
pass, with who pays, what it's worth, and how hard each is to build.

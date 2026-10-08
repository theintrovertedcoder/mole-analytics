# Mole Sense — brief

Working notes. The Google AI Studio prototype ("Remix: Mole Analytics v1.1")
is in this repository's history at commit `5294055`. It has been rebuilt as the
real product (8 Oct): see `ARCHITECTURE.md`, `DECISIONS.md` and, for what needs
Haziq, `YOUR_TURN.md`.

## What it is

An events dashboard for organisers and exhibitors: how many people were at the
venue, how many came to a booth, how many stayed, and how many turned into
connections.

- **The top of the funnel comes from PLExyz.** PLExyz is an IoT device built by
  [reka.re](https://reka.re) that detects Wi-Fi devices to measure and monitor
  how people move within a space. Mole Sense reads that data from the
  **PLExyz cloud API** and shows it in the dashboards.
- **The bottom of the funnel comes from Mole V3**, which already records card
  taps, saved contacts, requests and event check-ins.

**Name:** **Mole Sense**, at **sense.mole.is** (8 Oct; it was "Mole Analytics"
until then). Moles barely see; they feel footsteps through the ground, which
is how the sensors work. Tagline: *Feel the crowd.*

## Direction

- **This prototype will be rebuilt into a full product.** It is a separate
  product from Mole V3, with its own repo and deployment.
- **It calls two sets of APIs:** Mole V3 (events, organisations, connections)
  and PLExyz (devices, presence data). It owns its own data only where neither
  of them holds it.
- **It uses Mole's branding.** That means sunny-kit, the design system every
  Mole product follows (8 Oct, `DECISIONS.md` D24): its tokens, fonts, logos
  and Sunny. The prototype's own yellow and "plexyz" purple are not the brand.
- **Analytics alone won't sell it.** We still need to work out what makes
  organisers subscribe. That is a separate piece of work.

## Pairing a device

1. In Mole, an admin scans the **QR code on the PLExyz device**.
2. Mole sends a **pairing request** to the PLExyz cloud for that device.
3. The request appears in the **PLExyz dashboard**, and its owner **allows** it.
4. From then on, the device's data **streams to Mole**.

Mole also does some device management: which booth or space a device is in,
and whether it is healthy (last seen, battery).

## Questions for reka.re

- **Auth:** what credential Mole holds after the pairing is allowed (OAuth,
  a per-device token, a per-tenant API key), and whether it expires or can be
  revoked.
- **Streaming:** how data arrives — webhook, WebSocket/SSE, or polling — and
  how fast. This decides whether it lands in a Supabase edge function or a
  Railway service.
- **Data:** what one record contains — raw detections, or counts, zones and
  dwell already worked out by PLExyz.
- **The QR:** what it encodes — a device ID, a claim token, a URL.
- **Unpairing:** what happens when a device moves to another event or another
  customer.
- **Privacy:** whether device identifiers are hashed or rotated before they
  leave the device. This sets the PDPA position.

## Rules carried over from Mole V3

- PLExyz credentials are **server-side secrets** (edge-function settings),
  never in a `VITE_` variable. The prototype's `vite.config.ts` put
  `GEMINI_API_KEY` into the client bundle. The rebuild removed that, and
  `npm run audit:secrets` checks every build.
- **Mole Admin is separate from customer views.** Device inventory and client
  onboarding are Mole Admin work. Booth and event analytics belong in the Loop
  Dashboard (V3's `events.package` = `HOST` / `EXHIBITOR`). The prototype's
  landing page put both side by side. The rebuild has no admin side at all.
- **Never show a number that isn't true.** The prototype's "Automated
  Insights" and staffing advice are fixed text. They need real data behind them
  or should be left out.

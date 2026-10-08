# PLExyz integration

PLExyz is an IoT sensor by [reka.re](https://reka.re) that detects Wi-Fi
devices, to measure and monitor how people move through a space.

**We have not seen the PLExyz cloud API yet.** Everything below marked
*assumed* is a guess, made so the rest of the product could be built and
tested. All of it lives in one file, `supabase/functions/_shared/plexyz.ts`,
and changing it to the real API changes nothing else.

## The flow (from Haziq, 6 Oct)

1. Someone in the org opens **Sensors → Pair a sensor** and scans the QR on the
   sensor (or types the code under it).
2. Mole asks the PLExyz cloud to pair that sensor with Mole.
3. The request appears in the **PLExyz dashboard**. The sensor's owner allows it.
4. PLExyz tells Mole (webhook), or Mole asks (the **Check again** button).
5. The sensor's data streams to Mole.
6. Unpairing tells PLExyz to stop. Anything a revoked sensor still sends is dropped.

## What we assumed, and the question that settles each

| # | Assumed | Ask reka.re |
|---|---|---|
| 1 | We call PLExyz with **one API key**, `Authorization: Bearer <PLEXYZ_API_KEY>` | How does a partner authenticate? Per-partner key, OAuth client, something else? |
| 2 | `POST /v1/pairing-requests` `{device_code, requester, callback_url}` → `201 {id, status:"pending"}`; `404` unknown code; `409` already paired | Is there a pairing-request API at all, and what does it look like? |
| 3 | `GET /v1/pairing-requests/{id}` → `{status: pending\|approved\|rejected\|expired, device_id, access_token}` | Once allowed, what do we get: a device id, a per-device token, a scope? Does it expire? |
| 4 | The QR holds the bare code, or a URL with `?code=` / `?device=` / `?id=`, or the code as the last path segment | What exactly is in the QR on the sensor? |
| 5 | `DELETE /v1/devices/{id}/pairing` with the device token | How does a partner give a sensor back? |
| 6 | **Push**: PLExyz POSTs to our `plexyz_webhook` | Push (webhook / stream) or pull (we poll)? How fast? If pull only, we add a scheduled poller; the ingest path stays the same. |
| 7 | Webhooks are signed: `X-Plexyz-Signature: sha256=<hex HMAC-SHA256 of the raw body>`, with a delivery id in `X-Plexyz-Delivery` | How are deliveries signed and identified? Do they retry? |
| 8 | Deliveries: `pairing.updated` `{request_id, status, device_id, access_token}`; `presence.sessions` `{device_id, sessions:[{id, visitor, started_at, ended_at}]}`; `device.status` `{device_id, seen_at, battery}` | What does one reading contain? **Sessions** (a visitor's arrival and departure), or raw detections, or counts already worked out? |
| 9 | `visitor` is a stable identifier for one phone during an event | Is it hashed or rotated on the device already? Does it survive MAC randomisation? |
| 10 | — | Can one sensor tell "in the booth" from "walking past" (signal strength, zones)? That would give exhibitors a "walked past" step. |
| 11 | — | Data residency: where is the PLExyz cloud, and what is retained there? |

## If reka.re sends detections, not sessions

The product stores **sessions** (one visitor, one zone, start to end), and the
funnel is built on them. If PLExyz sends raw detections instead, a small step
in the webhook groups them into sessions (a gap of more than a few minutes ends
one) before the existing `ingest_presence`. Nothing downstream changes.

## Privacy

- The raw visitor id is never stored or logged. It becomes
  `HMAC(VISITOR_KEY_SECRET, event id + "|" + raw)`, cut to 32 characters.
- Same phone = one visitor across a multi-day event; a different event can't
  be linked to it, and nobody without the secret can link it back to the phone.
- Before real attendees are counted, this needs the PDPA review that Mole V3's
  privacy work is going through (signage at the venue, retention period).

## Settings

Edge-function secrets in the Mole Analytics project:
`PLEXYZ_API_URL`, `PLEXYZ_API_KEY`, `PLEXYZ_WEBHOOK_SECRET`, `VISITOR_KEY_SECRET`.
Until the first two are set, pairing says plainly that PLExyz isn't connected
and saves nothing. `/functions/v1/api/health` shows `"plexyz": true` once they are.

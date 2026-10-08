-- ─────────────────────────────────────────────────────────────────────────────
-- 20261008000001 · Mole Sense — what this product owns
-- ─────────────────────────────────────────────────────────────────────────────
-- This is the Mole Sense Supabase project, NOT Mole V3's. Events, orgs and
-- people stay in Mole V3 and are read through its api_v1. What lives here is
-- only what neither Mole V3 nor PLExyz holds:
--
--   zones              where the sensors are: a hall, an entrance, a booth
--   devices            PLExyz sensors an org has paired, and their pairing state
--   device_credentials what PLExyz gave us when the pairing was allowed
--   presence_sessions  one person's visit to one zone, start to end
--   webhook_receipts   deliveries already handled, so a retry is harmless
--
-- ── Nobody signs in to this database ───────────────────────────────────────
-- People sign in with their Mole account, which is Mole V3's auth. This
-- project's own auth is unused, so `anon` and `authenticated` here are nobody
-- we know. Every table has RLS on and no policy, and every grant to those two
-- roles is revoked: a request that reaches PostgREST with this project's anon
-- key reads nothing and writes nothing. The edge functions use the service
-- role after checking the Mole login themselves. tests/db/run.mjs attempts the
-- reads and writes as anon and requires each one to fail.
--
-- ── Mole ids are not foreign keys ──────────────────────────────────────────
-- `mole_event_id` and `mole_org_id` point into another database. They are
-- checked against Mole V3 on every request that uses them, never trusted
-- because they are here.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── zones ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.zones (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mole_event_id  UUID NOT NULL,
  mole_org_id    UUID NOT NULL,
  name           TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  kind           TEXT NOT NULL CHECK (kind IN ('venue', 'entrance', 'booth', 'room')),
  created_by     UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zones_event_idx ON public.zones (mole_event_id);

COMMENT ON TABLE public.zones IS
  'A place at an event that sensors watch. Kind decides which funnel step it feeds: venue/entrance → "at the event", booth → "visited" and "stayed".';

-- ── devices ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.devices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mole_org_id       UUID NOT NULL,
  code              TEXT NOT NULL CHECK (code ~ '^[A-Za-z0-9][A-Za-z0-9_-]{3,63}$'),
  label             TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  status            TEXT NOT NULL DEFAULT 'pending_approval'
                    CHECK (status IN ('pending_approval', 'active', 'rejected', 'expired', 'revoked')),
  zone_id           UUID REFERENCES public.zones(id) ON DELETE SET NULL,
  plexyz_request_id TEXT,
  plexyz_device_id  TEXT,
  requested_by      UUID NOT NULL,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at       TIMESTAMPTZ,
  last_seen_at      TIMESTAMPTZ,
  battery           SMALLINT CHECK (battery BETWEEN 0 AND 100)
);
CREATE INDEX IF NOT EXISTS devices_org_idx ON public.devices (mole_org_id);
CREATE UNIQUE INDEX IF NOT EXISTS devices_request_idx
  ON public.devices (plexyz_request_id) WHERE plexyz_request_id IS NOT NULL;

-- One sensor, one org at a time. A second org scanning a sensor that is
-- already paired (or waiting) is refused here even if PLExyz would allow it,
-- because two orgs counting the same sensor would both quote its numbers.
CREATE UNIQUE INDEX IF NOT EXISTS devices_one_live_pairing
  ON public.devices (code) WHERE status IN ('pending_approval', 'active');

-- ── device_credentials ──────────────────────────────────────────────────────
-- Apart from `devices` so that no query that lists devices can return a token
-- by selecting `*`.
CREATE TABLE IF NOT EXISTS public.device_credentials (
  device_id     UUID PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
  access_token  TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── presence_sessions ──────────────────────────────────────────────────────
-- `visitor_key` is never what the sensor saw. The webhook hashes it with a
-- secret and the event id, so the same phone is one visitor for the whole of
-- an event (all three days of it) and a stranger at the next event. Nothing
-- here can be joined back to a phone, a person, or another event.
--
-- Not per calendar day, which was the first idea: a UTC day ends at 8am in
-- Kuala Lumpur, in the middle of the morning rush, and would have counted
-- everybody who was there at 7:55 twice.
--
-- `zone_id` is the zone the device was in WHEN THE SESSION ARRIVED. Moving a
-- sensor to another booth later does not rewrite what it already counted.
-- ON DELETE RESTRICT: a zone with history cannot be deleted, only renamed;
-- deleting it would silently shrink every report that included it.
CREATE TABLE IF NOT EXISTS public.presence_sessions (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  device_id      UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  zone_id        UUID NOT NULL REFERENCES public.zones(id) ON DELETE RESTRICT,
  mole_event_id  UUID NOT NULL,
  visitor_key    TEXT NOT NULL,
  started_at     TIMESTAMPTZ NOT NULL,
  ended_at       TIMESTAMPTZ NOT NULL,
  source_id      TEXT NOT NULL,
  received_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ended_at >= started_at),
  UNIQUE (device_id, source_id)
);
CREATE INDEX IF NOT EXISTS presence_event_start_idx ON public.presence_sessions (mole_event_id, started_at);
CREATE INDEX IF NOT EXISTS presence_zone_start_idx  ON public.presence_sessions (zone_id, started_at);

-- ── webhook_receipts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.webhook_receipts (
  delivery_id  TEXT PRIMARY KEY,
  kind         TEXT NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Fail closed ─────────────────────────────────────────────────────────────
ALTER TABLE public.zones              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_receipts   ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.zones, public.devices, public.device_credentials,
              public.presence_sessions, public.webhook_receipts
  FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- ingest_presence · one delivery of sessions from one device
-- ─────────────────────────────────────────────────────────────────────────────
-- Sessions are filed under the device's zone at the moment they arrive. A
-- device that is not active, or not in a zone, has nowhere to file them; those
-- are counted and dropped rather than kept under no zone, because a session
-- that belongs to no event can never appear in any report and only costs
-- storage. The response says how many, so the webhook log shows it.
CREATE OR REPLACE FUNCTION public.ingest_presence(p_device_id UUID, p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_zone  UUID;
  v_event UUID;
  v_total INTEGER := coalesce(jsonb_array_length(p_rows), 0);
  v_in    INTEGER := 0;
BEGIN
  SELECT d.zone_id, z.mole_event_id INTO v_zone, v_event
    FROM public.devices d
    LEFT JOIN public.zones z ON z.id = d.zone_id
   WHERE d.id = p_device_id AND d.status = 'active';

  IF v_zone IS NULL THEN
    RETURN jsonb_build_object('received', v_total, 'stored', 0, 'dropped_no_zone', v_total);
  END IF;

  WITH ins AS (
    INSERT INTO public.presence_sessions
      (device_id, zone_id, mole_event_id, visitor_key, started_at, ended_at, source_id)
    SELECT p_device_id, v_zone, v_event,
           r->>'visitor_key', (r->>'started_at')::timestamptz, (r->>'ended_at')::timestamptz,
           r->>'source_id'
      FROM jsonb_array_elements(p_rows) r
     WHERE (r->>'ended_at')::timestamptz >= (r->>'started_at')::timestamptz
    ON CONFLICT (device_id, source_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_in FROM ins;

  UPDATE public.devices SET last_seen_at = greatest(coalesce(last_seen_at, '-infinity'), now())
   WHERE id = p_device_id;

  RETURN jsonb_build_object('received', v_total, 'stored', v_in, 'dropped_no_zone', 0);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- presence_report · the numbers on the dashboard
-- ─────────────────────────────────────────────────────────────────────────────
-- The Postgres twin of supabase/functions/_shared/presence.ts. The rules are
-- written out at the top of that file and are not repeated here, because two
-- copies of the prose would drift exactly the way two copies of the arithmetic
-- would. tests/db/run.mjs runs both on the same sessions and fails if any
-- number differs.
CREATE OR REPLACE FUNCTION public.presence_report(
  p_event_id          UUID,
  p_from              TIMESTAMPTZ,
  p_to                TIMESTAMPTZ,
  p_threshold_minutes NUMERIC,
  p_zone_id           UUID,
  p_bucket_seconds    INTEGER
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH z AS (
    SELECT id, kind FROM public.zones WHERE mole_event_id = p_event_id
  ),
  s AS (
    SELECT ps.zone_id, ps.visitor_key, ps.started_at, ps.ended_at,
           extract(epoch FROM ps.ended_at - ps.started_at) AS dwell
      FROM public.presence_sessions ps
      JOIN z ON z.id = ps.zone_id
  ),
  w AS (
    SELECT * FROM s WHERE started_at >= p_from AND started_at < p_to
  ),
  scope AS (
    SELECT id FROM z
     WHERE (p_zone_id IS NOT NULL AND id = p_zone_id)
        OR (p_zone_id IS NULL AND kind = 'booth')
  ),
  sc AS (
    SELECT w.* FROM w JOIN scope ON scope.id = w.zone_id
  ),
  step AS (
    SELECT greatest(p_bucket_seconds,
                    ceil(extract(epoch FROM p_to - p_from) / 400.0)::INTEGER) AS secs
  ),
  buckets AS (
    SELECT b AS bstart, least(b + make_interval(secs => step.secs), p_to) AS bend
      FROM step, generate_series(p_from, p_to, make_interval(secs => step.secs)) b
     WHERE b < p_to
  ),
  traffic AS (
    SELECT b.bstart,
           (SELECT count(DISTINCT s.visitor_key) FROM s
             WHERE (p_zone_id IS NULL OR s.zone_id = p_zone_id)
               AND s.started_at < b.bend AND s.ended_at > b.bstart) AS n
      FROM buckets b
  ),
  zone_rows AS (
    SELECT z.id,
           (SELECT count(DISTINCT w.visitor_key) FROM w WHERE w.zone_id = z.id) AS visitors,
           (SELECT count(DISTINCT w.visitor_key) FROM w
             WHERE w.zone_id = z.id AND w.dwell >= p_threshold_minutes * 60) AS stayed,
           (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY w.dwell)::NUMERIC)
              FROM w WHERE w.zone_id = z.id) AS median_dwell
      FROM z WHERE z.kind IN ('booth', 'room')
  )
  SELECT jsonb_build_object(
    'funnel', jsonb_build_object(
      'venue', CASE WHEN EXISTS (SELECT 1 FROM z WHERE kind IN ('venue', 'entrance'))
                    THEN (SELECT count(DISTINCT visitor_key) FROM w) END,
      'visited', CASE WHEN EXISTS (SELECT 1 FROM scope)
                      THEN (SELECT count(DISTINCT visitor_key) FROM sc) END,
      'stayed', CASE WHEN EXISTS (SELECT 1 FROM scope)
                     THEN (SELECT count(DISTINCT visitor_key) FROM sc
                            WHERE dwell >= p_threshold_minutes * 60) END,
      'medianDwellSeconds', (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY dwell)::NUMERIC)
                               FROM sc)
    ),
    'traffic', coalesce((SELECT jsonb_agg(jsonb_build_object('start', bstart, 'count', n) ORDER BY bstart)
                           FROM traffic), '[]'::jsonb),
    'zones', coalesce((SELECT jsonb_agg(jsonb_build_object(
                         'zoneId', id, 'visitors', visitors, 'stayed', stayed,
                         'medianDwellSeconds', median_dwell)
                         ORDER BY stayed DESC, visitors DESC, id::TEXT COLLATE "C")
                         FROM zone_rows), '[]'::jsonb),
    'sessions', (SELECT count(*) FROM w),
    'firstSeenAt', (SELECT min(started_at) FROM w),
    'lastSeenAt', (SELECT max(ended_at) FROM w)
  );
$$;

REVOKE ALL ON FUNCTION public.ingest_presence(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.presence_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_presence(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.presence_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, UUID, INTEGER)
  TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON public.zones, public.devices, public.device_credentials,
             public.presence_sessions, public.webhook_receipts TO service_role;

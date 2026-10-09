-- ─────────────────────────────────────────────────────────────────────────────
-- Booth staff are not visitors (W-9, roadmap 1.6)
-- ─────────────────────────────────────────────────────────────────────────────
-- A stand's staff sit beside its sensor all day, so every one of them passed
-- every "stayed" threshold: four staff were four highly engaged visitors a day.
-- A phone whose visits to one booth add up to three hours or more over the
-- event is now left out of every number, and the report says how many were.
-- STAFF_HOURS in supabase/functions/_shared/contract.ts is the same 3; the
-- rule is written out in presence.ts, and tests/db/run.mjs holds the two equal.
-- The rest of presence_report() is unchanged from 20261008000001_core.sql.

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
  -- Booth staff (W-9): STAFF_HOURS (3) or more at one booth, over the whole event.
  staff AS (
    SELECT DISTINCT ps.visitor_key
      FROM public.presence_sessions ps
      JOIN z ON z.id = ps.zone_id AND z.kind = 'booth'
     GROUP BY ps.visitor_key, ps.zone_id
    HAVING sum(extract(epoch FROM ps.ended_at - ps.started_at)) >= 3 * 3600
  ),
  s AS (
    SELECT ps.zone_id, ps.visitor_key, ps.started_at, ps.ended_at,
           extract(epoch FROM ps.ended_at - ps.started_at) AS dwell
      FROM public.presence_sessions ps
      JOIN z ON z.id = ps.zone_id
     WHERE NOT EXISTS (SELECT 1 FROM staff WHERE staff.visitor_key = ps.visitor_key)
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
    'lastSeenAt', (SELECT max(ended_at) FROM w),
    'staffLeftOut', (SELECT count(*) FROM staff)
  );
$$;

REVOKE ALL ON FUNCTION public.presence_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.presence_report(UUID, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, UUID, INTEGER)
  TO service_role;

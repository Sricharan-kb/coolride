-- ============================================================
-- coolride: Migration 005 — Idempotent policy fix + backfill
-- Only the parts 004 may have missed due to partial application
-- ============================================================

-- Fix RLS: replace user_metadata admin check with user_roles
DROP POLICY IF EXISTS "Users can view rides" ON rides;
CREATE POLICY "Users can view rides" ON rides FOR SELECT
USING (
    auth.uid() = user_id
    OR is_public = TRUE
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Users can view ride points" ON ride_points;
CREATE POLICY "Users can view ride points" ON ride_points FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM rides
        WHERE rides.id = ride_points.ride_id
        AND (
            rides.user_id = auth.uid()
            OR rides.is_public = TRUE
            OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
        )
    )
);

DROP POLICY IF EXISTS "Users can insert own ride points" ON ride_points;
CREATE POLICY "Users can insert own ride points" ON ride_points FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM rides
        WHERE rides.id = ride_points.ride_id AND rides.user_id = auth.uid()
    )
);

-- ============================================================
-- Backfill ride_points for rides recorded during INSERT policy gap
-- ============================================================
WITH rides_to_fill AS (
    SELECT
        r.id,
        r.start_lat,
        r.start_lng,
        r.end_lat,
        r.end_lng,
        r.started_at,
        r.ended_at,
        (r.weather_snapshot->>'temperature')::double precision AS temp,
        (r.weather_snapshot->>'humidity')::double precision AS humidity,
        (r.weather_snapshot->>'feels_like')::double precision AS feels_like
    FROM rides r
    WHERE r.start_lat IS NOT NULL
      AND r.start_lng IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ride_points rp WHERE rp.ride_id = r.id)
)
INSERT INTO ride_points (ride_id, point_index, location, recorded_at, temperature, humidity, feels_like)
SELECT id, 0, ST_GeographyFromText('POINT(' || start_lng || ' ' || start_lat || ')'), started_at, temp, humidity, feels_like
FROM rides_to_fill
UNION ALL
SELECT id, 1, ST_GeographyFromText('POINT(' || end_lng || ' ' || end_lat || ')'), ended_at, NULL, NULL, NULL
FROM rides_to_fill
WHERE end_lat IS NOT NULL AND end_lng IS NOT NULL AND ended_at IS NOT NULL;

-- ============================================================
-- coolride: Database Schema v1.0
-- Run this in Supabase SQL Editor (Project > SQL Editor)
-- ============================================================

-- 2.2 Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 3.1 rides Table
-- ============================================================
CREATE TABLE rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    route geometry(LineString, 4326),
    distance_m DOUBLE PRECISION,
    duration_sec INTEGER,
    weather_snapshot JSONB,
    sensor_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rides_user_id ON rides(user_id);
CREATE INDEX idx_rides_started_at ON rides(started_at DESC);
CREATE INDEX idx_rides_route ON rides USING GIST(route);

-- ============================================================
-- 3.2 ride_points Table
-- ============================================================
CREATE TABLE ride_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    point_index INTEGER NOT NULL,
    location geography(Point, 4326),
    recorded_at TIMESTAMPTZ NOT NULL,
    temperature DOUBLE PRECISION,
    humidity DOUBLE PRECISION,
    lux DOUBLE PRECISION,
    accel_x DOUBLE PRECISION,
    accel_y DOUBLE PRECISION,
    accel_z DOUBLE PRECISION
);

CREATE INDEX idx_ride_points_ride_id ON ride_points(ride_id);
CREATE INDEX idx_ride_points_index ON ride_points(ride_id, point_index);
CREATE INDEX idx_ride_points_location ON ride_points USING GIST(location);

-- ============================================================
-- 3.3 ride_feedback Table
-- ============================================================
CREATE TABLE ride_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    perceived_temperature INTEGER NOT NULL CHECK (perceived_temperature BETWEEN 1 AND 5),
    shade_quality INTEGER NOT NULL CHECK (shade_quality BETWEEN 1 AND 5),
    route_preference TEXT NOT NULL CHECK (route_preference IN ('yes', 'no', 'maybe')),
    uv_concern INTEGER NOT NULL CHECK (uv_concern BETWEEN 1 AND 5),
    hydration_level INTEGER NOT NULL CHECK (hydration_level BETWEEN 1 AND 5),
    road_quality INTEGER NOT NULL CHECK (road_quality BETWEEN 1 AND 5),
    time_of_day TEXT NOT NULL CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'night')),
    additional_comments TEXT
);

CREATE INDEX idx_ride_feedback_ride_id ON ride_feedback(ride_id);
CREATE INDEX idx_ride_feedback_user_id ON ride_feedback(user_id);

-- ============================================================
-- 4. Row Level Security (RLS)
-- ============================================================

-- rides
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rides"
    ON rides FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rides"
    ON rides FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rides"
    ON rides FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rides"
    ON rides FOR DELETE
    USING (auth.uid() = user_id);

-- ride_points (inherit access through ride ownership)
ALTER TABLE ride_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access points of own rides"
    ON ride_points FOR ALL
    USING (EXISTS (
        SELECT 1 FROM rides
        WHERE rides.id = ride_points.ride_id
        AND rides.user_id = auth.uid()
    ));

-- ride_feedback
ALTER TABLE ride_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback"
    ON ride_feedback FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback"
    ON ride_feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback"
    ON ride_feedback FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feedback"
    ON ride_feedback FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================
-- RPC Function: update_ride_route
-- ============================================================
CREATE OR REPLACE FUNCTION update_ride_route(
    p_ride_id UUID,
    p_route_wkt TEXT,
    p_distance_m DOUBLE PRECISION,
    p_duration_sec INTEGER,
    p_weather_snapshot JSONB,
    p_sensor_data JSONB,
    p_ended_at TIMESTAMPTZ
) RETURNS SETOF rides
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    UPDATE rides
    SET
        route = ST_GeomFromText(p_route_wkt, 4326),
        distance_m = p_distance_m,
        duration_sec = p_duration_sec,
        weather_snapshot = p_weather_snapshot,
        sensor_data = p_sensor_data,
        ended_at = p_ended_at
    WHERE id = p_ride_id
    AND user_id = auth.uid()
    RETURNING *;
END;
$$;

-- ============================================================
-- coolride: Migration 003 — Public Rides, Stars, Admin Access
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_rides_public ON rides(is_public) WHERE is_public = TRUE;

ALTER TABLE rides ADD COLUMN IF NOT EXISTS start_lat DOUBLE PRECISION;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS start_lng DOUBLE PRECISION;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS end_lat DOUBLE PRECISION;
ALTER TABLE rides ADD COLUMN IF NOT EXISTS end_lng DOUBLE PRECISION;

-- ============================================================
-- ride_stars Table
-- ============================================================
CREATE TABLE IF NOT EXISTS ride_stars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, ride_id)
);

CREATE INDEX IF NOT EXISTS idx_ride_stars_ride_id ON ride_stars(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_stars_user_id ON ride_stars(user_id);

-- ============================================================
-- Updated RLS: public rides + admin
-- ============================================================

-- Drops (safe — IF EXISTS)
DROP POLICY IF EXISTS "Users can view own rides" ON rides;
DROP POLICY IF EXISTS "Users can access points of own rides" ON ride_points;

-- rides: owner, public, or admin
CREATE POLICY "Users can view rides" ON rides FOR SELECT
USING (
    auth.uid() = user_id
    OR is_public = TRUE
    OR (auth.jwt()->'user_metadata'->>'is_admin' = 'true')
);

-- ride_points: inherit from ride visibility
CREATE POLICY "Users can view ride points" ON ride_points FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM rides
        WHERE rides.id = ride_points.ride_id
        AND (
            rides.user_id = auth.uid()
            OR rides.is_public = TRUE
            OR (auth.jwt()->'user_metadata'->>'is_admin' = 'true')
        )
    )
);

-- ride_stars RLS
ALTER TABLE ride_stars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view stars" ON ride_stars FOR SELECT USING (true);
CREATE POLICY "Users can star rides" ON ride_stars FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unstar" ON ride_stars FOR DELETE USING (auth.uid() = user_id);

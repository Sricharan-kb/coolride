-- ============================================================
-- coolride: Migration 004 — Admin Roles, RLS hardening, spatial_ref_sys
-- ============================================================

-- user_roles table (only service_role can write)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user'
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role (safe: they see what they already have)
CREATE POLICY "Users can read own role" ON user_roles FOR SELECT
USING (user_id = auth.uid());

-- Revoke write access from API roles — only service_role can insert/update/delete
REVOKE INSERT, UPDATE, DELETE ON user_roles FROM anon, authenticated;

-- TODO: Set admin users manually after running this migration:
-- INSERT INTO user_roles (user_id, role) VALUES ('<admin-user-uuid>', 'admin');

-- ============================================================
-- Fix RLS: replace user_metadata admin check with user_roles
-- ============================================================

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

-- Restore INSERT policy dropped by migration 003
CREATE POLICY "Users can insert own ride points" ON ride_points FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM rides
        WHERE rides.id = ride_points.ride_id AND rides.user_id = auth.uid()
    )
);

-- ============================================================
-- Hide PostGIS spatial_ref_sys from API
-- ============================================================
REVOKE ALL ON spatial_ref_sys FROM anon, authenticated;

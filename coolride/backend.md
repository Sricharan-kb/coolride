# Backend Agent Instructions (DeepSeek V4 pro)

- **Target Model:** DeepSeek V4 pro
- **Version:** 1.0 | 2026-06-19
- **Read:** SPEC.md before starting

---

## 1. Project Context

Coolride is a mobile-first PWA for Chennai cyclists. The backend is **Supabase** (BaaS — PostgreSQL + PostGIS + Auth + Edge Functions). This document defines the backend schema, Edge Functions, RLS policies, and the exact API contract the frontend depends on.

---

## 2. Supabase Project Setup

### 2.1 Create Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project named `coolride`
3. Choose region closest to Chennai (Mumbai: `ap-south-1`)
4. Save the project URL and anon key

### 2.2 Enable PostGIS
```sql
-- Run in Supabase SQL Editor
CREATE EXTENSION IF NOT EXISTS postgis;
```

---

## 3. Database Schema

### 3.1 `rides` Table

```sql
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
```

### 3.2 `ride_points` Table

```sql
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
```

### 3.3 `ride_feedback` Table

```sql
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
```

---

## 4. Row Level Security (RLS)

Enable RLS on all three tables and create policies so users can only access their own data:

```sql
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
```

---

## 5. Edge Function: Weather Proxy

### 5.1 Purpose
Proxy WeatherAPI.com to hide the API key from the frontend.

### 5.2 File: `supabase/functions/weather/index.ts`

```typescript
// supabase/functions/weather/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WEATHERAPI_KEY = Deno.env.get("WEATHERAPI_KEY");
const WEATHERAPI_BASE = "https://api.weatherapi.com/v1/current.json";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");

  if (!lat || !lon) {
    return new Response(
      JSON.stringify({ error: "lat and lon are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const apiUrl = `${WEATHERAPI_BASE}?key=${WEATHERAPI_KEY}&q=${lat},${lon}&aqi=no`;

  const response = await fetch(apiUrl);
  const data = await response.json();

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: data.error?.message || "Weather fetch failed" }),
      { status: response.status, headers: { "Content-Type": "application/json" } }
    );
  }

  const result = {
    temperature: data.current.temp_c,
    humidity: data.current.humidity,
    feels_like: data.current.feelslike_c,
    description: data.current.condition.text,
    icon: "https:" + data.current.condition.icon,
  };

  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
```

### 5.3 Environment Variable
Set in Supabase Dashboard → Settings → Edge Functions → Secrets:

```
WEATHERAPI_KEY=your_weatherapi_key
```

A reference template exists at `backend/supabase/functions/weather/.env.example`. Do NOT commit the actual key.

Get a free API key at [weatherapi.com](https://www.weatherapi.com).

### 5.4 Deploy
```bash
npx supabase functions deploy weather --project-ref your-project-ref
```

---

## 6. Frontend Contract (Exact API Shapes)

The frontend expects these EXACT response shapes. Any deviation will break the app.

### 6.1 Create Ride
```typescript
// Request
const { data, error } = await supabase
  .from('rides')
  .insert({
    user_id: userId,
    started_at: new Date().toISOString(),
  })
  .select()
  .single();

// Response shape
{
  id: "uuid",
  user_id: "uuid",
  started_at: "2026-06-19T10:30:00Z",
  ended_at: null,
  route: null,
  distance_m: null,
  duration_sec: null,
  weather_snapshot: null,
  sensor_data: null,
  created_at: "2026-06-19T10:30:00Z"
}
```

### 6.2 End Ride (Update + Insert Points)
```typescript
// 1. Build route LineString: ST_MakeLine from all points
// 2. Update rides record
const { data: ride, error } = await supabase
  .from('rides')
  .update({
    ended_at: endTime,
    route: linestring,     // constructed via Supabase SQL or raw query
    distance_m: computedDistance,
    duration_sec: computedDuration,
    weather_snapshot: weatherJson,
    sensor_data: sensorJson,
  })
  .eq('id', rideId)
  .select()
  .single();

// 3. Batch insert ride_points
const { error: pointsError } = await supabase
  .from('ride_points')
  .insert(pointsArray);  // array of 50-2000 objects
```

**Note on route geometry:** The frontend will construct the LineString using a raw SQL call since the Supabase JS client doesn't natively support PostGIS geometry insertion. Use `supabase.rpc()` or a direct query:

```typescript
// Build route from coordinates
const coords = routePoints.map(p => `${p.lng} ${p.lat}`).join(',');
const { data } = await supabase.rpc('update_ride_route', {
  p_ride_id: rideId,
  p_route_wkt: `LINESTRING(${coords})`,
  p_distance_m: distanceMeters,
  p_duration_sec: durationSeconds,
  p_weather_snapshot: weatherSnapshot,
  p_sensor_data: sensorData,
  p_ended_at: endTime
});
```

The backend MUST create this RPC function:

```sql
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
```

### 6.3 List Rides (for RideHistory)
```typescript
const { data: rides, error } = await supabase
  .from('rides')
  .select('id, started_at, ended_at, distance_m, duration_sec')
  .eq('user_id', userId)
  .order('started_at', { ascending: false });

// Response shape (array)
[{
  id: "uuid",
  started_at: "2026-06-19T10:30:00Z",
  ended_at: "2026-06-19T11:05:00Z",
  distance_m: 4200,
  duration_sec: 2100,
}]
```

### 6.4 Get Single Ride (for details + timeline)
```typescript
const { data: ride } = await supabase
  .from('rides')
  .select('*')
  .eq('id', rideId)
  .single();

const { data: points } = await supabase
  .from('ride_points')
  .select('*')
  .eq('ride_id', rideId)
  .order('point_index', { ascending: true });
```

### 6.5 Submit Feedback
```typescript
const { error } = await supabase
  .from('ride_feedback')
  .insert({
    ride_id: rideId,
    user_id: userId,
    perceived_temperature: 4,
    shade_quality: 2,
    route_preference: 'yes',
    uv_concern: 4,
    hydration_level: 3,
    road_quality: 3,
    time_of_day: 'afternoon',
    additional_comments: 'Very hot near the bridge section'
  });
```

### 6.6 Weather Edge Function
```typescript
// Response shape (MUST match exactly)
interface WeatherResponse {
  temperature: number;
  humidity: number;
  feels_like: number;
  description: string;
  icon: string;
}
```

---

## 7. Auth Configuration

### 7.1 Supabase Dashboard Settings
- **Auth → Providers → Email:** Enabled
- **Auth → Email → Confirm email:** Optional for Stage 1 (disable for easier dev testing)
- **Auth → Settings → Site URL:** `http://localhost:5173`

### 7.2 Auto-Created `auth.users` Table
Supabase creates this automatically. No manual schema needed.

---

## 8. Deliverables Checklist

- [ ] Supabase project created with Mumbai region
- [ ] PostGIS extension enabled
- [ ] `rides` table created with indexes
- [ ] `ride_points` table created with indexes
- [ ] `ride_feedback` table created with constraints
- [ ] RLS policies on all 3 tables
- [ ] `update_ride_route` RPC function created
- [ ] Weather Edge Function deployed
- [ ] `WEATHERAPI_KEY` secret set
- [ ] Email auth provider configured
- [ ] Site URL set to localhost
- [ ] SQL migration file saved as `supabase/migrations/001_schema.sql`

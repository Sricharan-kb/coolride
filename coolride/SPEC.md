# coolride - Specification v1.0

- **Created:** 2026-06-19
- **Stage:** 1 MVP
- **App Name:** coolride

---

## 1. Overview

Mobile-first PWA for cyclists in Chennai to record rides with GPS tracking, collect real-time weather and sensor data, and provide post-ride feedback on heat and shade comfort.

## 2. Core Features (Stage 1)

### 2.1 Authentication
- Supabase email/password login and registration
- Persistent session
- Row Level Security on all tables

### 2.2 Ride Recording
- Start / Stop / Pause controls
- GPS position captured every 5 seconds via browser Geolocation API
- Route stored as PostGIS `GEOMETRY(LineString, 4326)`
- Computed metrics: distance (km), duration (min), avg speed (km/h)

### 2.3 Live Map
- Leaflet with OpenStreetMap tiles (free, no API key)
- Light and dark tile layers
- Current location dot with heading
- Recorded route polyline updating in real-time

### 2.4 Weather Widget
- Current temperature (°C), humidity (%), feels-like (°C), description, icon
- Fetched from WeatherAPI.com via Supabase Edge Function proxy
- Updates every 30 seconds during a ride
- Displayed as a floating widget (top-right on mobile)

### 2.5 Sensor Data Collection (Read-Only)
- **ALS** (Ambient Light Sensor API): luminance in lux
- **Accelerometer** (DeviceMotion API): x, y, z acceleration in m/s²
- Displayed live, stored per GPS point for post-ride analysis

### 2.6 Post-Ride Feedback Survey
Shown immediately as a modal when the rider stops the ride. 8 questions:

| # | Question | Field | Type |
|---|----------|-------|------|
| 1 | Perceived temperature | `perceived_temperature` | 1-5 (Cool → Hot) |
| 2 | Shade quality | `shade_quality` | 1-5 (Sunny → Shady) |
| 3 | Prefer a shadier route? | `route_preference` | yes / no / maybe |
| 4 | UV exposure concern | `uv_concern` | 1-5 (Low → High) |
| 5 | Hydration adequacy | `hydration_level` | 1-5 (No → Yes) |
| 6 | Road surface quality | `road_quality` | 1-5 (Poor → Great) |
| 7 | Time of day | `time_of_day` | Auto: morning / afternoon / evening / night |
| 8 | Additional comments | `additional_comments` | Free text |

### 2.7 Ride Timeline Scrubber (Post-Ride Only)
After the ride ends (and survey is submitted), the rider can:
- View the route on the map
- Drag a horizontal slider to scrub along the route
- See a card displaying conditions at each scrubbed point:
  - Timestamp, temperature, humidity, lux, location coordinates

### 2.8 Ride History
- Profile tab shows a simple list of past rides
- Each ride: date, distance, duration
- Tap a ride to view its details, map, and timeline scrubber
- Tap to fill feedback if not submitted

---

## 3. UI / UX Design

### 3.1 Design Philosophy
- **Simple, minimalistic, raw aesthetic**
- **NO AI slop**: no generic card designs, no gradients, no artificial decoration
- Light mode (default) + Dark mode (toggle + system preference)
- Mobile-first (375px breakpoint base)

### 3.2 Color Palette

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| Background | `#FFFFFF` | `#0A0A0A` |
| Surface | `#F5F5F5` | `#1A1A1A` |
| Primary (Go/Start) | `emerald-600` `#059669` | `emerald-400` `#34D399` |
| Danger (Stop) | `red-600` `#DC2626` | `red-400` `#F87171` |
| Text Primary | `gray-900` `#111827` | `gray-100` `#F3F4F6` |
| Text Muted | `gray-500` `#6B7280` | `gray-400` `#9CA3AF` |
| Border | `gray-200` `#E5E7EB` | `gray-800` `#1F2937` |

### 3.3 Layout
```
┌────────────────────────────────────────┐
│               Map (full width)         │
│                          ┌───────────┐ │
│                          │  Weather   │ │
│                          │  34°C 62%  │ │
│                          └───────────┘ │
│  ┌──────────────┐                     │
│  │ Live Stats   │                     │
│  │ 4.2km  22min │                     │
│  └──────────────┘                     │
│              ┌─────────────────────┐   │
│              │   ▶ START RIDE      │   │
│              └─────────────────────┘   │
├────────────────────────────────────────┤
│  🗺️ Map    │  📊 Ride   │  👤 Profile  │
└────────────────────────────────────────┘
```

### 3.4 Navigation
- Bottom tab bar (fixed)
- Tabs: **Map** (home), **Ride** (current ride stats), **Profile** (settings + history)

---

## 4. Data Model

### 4.1 `rides`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key, auto-generated |
| `user_id` | `uuid` | FK to `auth.users` |
| `started_at` | `timestamptz` | Ride start timestamp |
| `ended_at` | `timestamptz` | Ride end (null while active) |
| `route` | `geometry(LineString, 4326)` | Full GPS path |
| `distance_m` | `float` | Total distance in meters |
| `duration_sec` | `int` | Total duration in seconds |
| `weather_snapshot` | `jsonb` | `{temp, humidity, feels_like, description}` |
| `sensor_data` | `jsonb` | `{avg_lux, avg_accel_magnitude}` |

### 4.2 `ride_points`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key |
| `ride_id` | `uuid` | FK to `rides`, CASCADE delete |
| `point_index` | `int` | Sequential order (0, 1, 2...) |
| `location` | `geography(Point, 4326)` | Lat/lon |
| `recorded_at` | `timestamptz` | Timestamp of this point |
| `temperature` | `float` | °C at this point |
| `humidity` | `float` | % at this point |
| `lux` | `float` | Ambient light sensor reading |
| `accel_x` | `float` | Accelerometer X |
| `accel_y` | `float` | Accelerometer Y |
| `accel_z` | `float` | Accelerometer Z |

### 4.3 `ride_feedback`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key |
| `ride_id` | `uuid` | FK to `rides` |
| `user_id` | `uuid` | FK to `auth.users` |
| `submitted_at` | `timestamptz` | Auto timestamp |
| `perceived_temperature` | `int` | 1-5 |
| `shade_quality` | `int` | 1-5 |
| `route_preference` | `text` | yes / no / maybe |
| `uv_concern` | `int` | 1-5 |
| `hydration_level` | `int` | 1-5 |
| `road_quality` | `int` | 1-5 |
| `time_of_day` | `text` | morning / afternoon / evening / night |
| `additional_comments` | `text` | Free text |

---

## 5. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript + TailwindCSS |
| Map | Leaflet + OpenStreetMap |
| Backend (BaaS) | Supabase (PostgreSQL 15 + PostGIS + Auth) |
| Serverless | Supabase Edge Functions (TypeScript / Deno) |
| Weather API | WeatherAPI.com (Current Weather Data) |
| Sensors | Web APIs: Geolocation, AmbientLightSensor, DeviceMotionEvent |

### 5.1 Environment Variables

| Variable | Location | Source |
|----------|----------|--------|
| `VITE_SUPABASE_URL` | `frontend/.env` | Supabase Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | `frontend/.env` | Supabase Dashboard → Settings → API → anon/public |
| `WEATHERAPI_KEY` | Supabase Edge Function Secrets | [weatherapi.com](https://www.weatherapi.com) free tier |

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public — shipped to the browser. RLS policies enforce data isolation.
- `WEATHERAPI_KEY` is private — stored in Supabase's secret manager, never reaches the browser.
- Copy `frontend/.env.example` to `frontend/.env` and fill values for local development.

---

## 6. API / Edge Functions

### 6.1 Weather Proxy
```
GET /functions/v1/weather?lat=13.0827&lon=80.2707

Response (from WeatherAPI.com):
{
  "temperature": 34.2,
  "humidity": 62,
  "feels_like": 37.8,
  "description": "partly cloudy",
  "icon": "//cdn.weatherapi.com/weather/64x64/day/116.png"
}
```

### 6.2 Auth (Supabase Built-in)
- `supabase.auth.signUp()` → registration
- `supabase.auth.signInWithPassword()` → login
- `supabase.auth.signOut()` → logout
- `supabase.auth.onAuthStateChange()` → session listener

### 6.3 Database (Supabase REST / JS Client)
- `supabase.from('rides').insert(...)` → create ride
- `supabase.from('rides').update(...)` → end ride
- `supabase.from('rides').select(...)` → list rides
- `supabase.from('ride_points').insert(...)` → batch insert points
- `supabase.from('ride_feedback').insert(...)` → submit survey

---

## 7. File Structure

```
coolride/
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── Auth/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── RegisterForm.tsx
│   │   │   ├── Map/
│   │   │   │   └── RideMap.tsx
│   │   │   ├── Ride/
│   │   │   │   ├── RideControls.tsx
│   │   │   │   ├── LiveStats.tsx
│   │   │   │   ├── RideFeedbackModal.tsx
│   │   │   │   └── RideTimeline.tsx
│   │   │   ├── Weather/
│   │   │   │   └── WeatherWidget.tsx
│   │   │   └── Profile/
│   │   │       └── RideHistory.tsx
│   │   ├── hooks/
│   │   │   ├── useGeolocation.ts
│   │   │   ├── useSensors.ts
│   │   │   └── useWeather.ts
│   │   ├── lib/
│   │   │   └── supabase.ts
│   │   └── types/
│   │       └── index.ts
│   └── public/
│       └── favicon.svg
├── backend/
│   └── supabase/
│       ├── functions/
│       │   └── weather/
│       │       └── index.ts
│       └── migrations/
│           └── 001_schema.sql
├── SPEC.md
├── frontend.md
├── backend.md
└── review.md
```

---

## 8. Non-Goals (Stage 1)

- No NDVI shade data overlay
- No route optimization or cooler route suggestions
- No offline support / full PWA install
- No social features
- No admin dashboard
- No real-time WS sync between backend and frontend (REST only in Stage 1)

---

## 9. Success Criteria

1. User can register and log in
2. User can start, pause, resume, and stop a ride
3. GPS route is recorded and displayed on the map in real-time
4. Weather is fetched and displayed during the ride
5. ALS and accelerometer data displays live
6. Post-ride feedback modal appears and saves to DB
7. Ride timeline scrubber works for completed rides
8. Ride history list shows all past rides with basic details

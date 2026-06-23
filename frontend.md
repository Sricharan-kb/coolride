# Frontend Agent Instructions (GLM 5.2)

- **Target Model:** GLM 5.2
- **Version:** 1.0 | 2026-06-19
- **Read:** SPEC.md before starting

---

## 1. Project Context

Coolride is a mobile-first PWA for Chennai cyclists. Stage 1 records GPS rides, fetches weather, collects sensor data, and captures post-ride feedback. This document is the instruction set for the frontend agent.

---

## 2. Design Rules — NO AI SLOP

These are hard constraints. The reviewer will reject code that violates them.

### 2.1 Visual Identity
- **Simple, minimalistic, raw aesthetic**
- **No generic "card" components** with shadows, rounded corners, borders everywhere
- **No gradient backgrounds** (solid colors only)
- **No artificial decoration** (no hero sections, no icon-heavy layouts, no "modern" cliches)
- Use thin, subtle borders only where necessary for form inputs
- Spacing should be generous but not excessive

### 2.2 Color Palette

```
Light Mode:
  bg-main:     bg-white (#FFFFFF)
  bg-surface:  bg-gray-50 (#F9FAFB)
  text-primary: text-gray-900 (#111827)
  text-muted:  text-gray-500 (#6B7280)
  primary:     text-emerald-600 / bg-emerald-600
  danger:      text-red-600 / bg-red-600
  border:      border-gray-200

Dark Mode:
  bg-main:     bg-zinc-950 (#0A0A0A)
  bg-surface:  bg-zinc-900 (#18181B)
  text-primary: text-zinc-100 (#F4F4F5)
  text-muted:  text-zinc-400 (#A1A1AA)
  primary:     text-emerald-400 / bg-emerald-400
  danger:      text-red-400 / bg-red-400
  border:      border-zinc-800
```

### 2.3 Typography
- System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- No custom web fonts
- Single weight hierarchy: regular for body, medium for headings
- Font sizes: base 16px, scale using Tailwind's `text-sm`, `text-base`, `text-lg`, `text-xl`

### 2.4 Dark Mode
- TailwindCSS `class` strategy — toggle adds `dark` class to `<html>`
- ALL components must have dark variants
- Use `dark:` prefix consistently (e.g., `bg-white dark:bg-zinc-950`)

### 2.5 Coding Standards
- No over-abstraction — do not create layers that aren't needed
- No `useMemo` / `useCallback` unless performance profiling proves it necessary
- Minimal comments — code must be self-documenting
- Descriptive variable/function names — never `data`, `item`, `handleClick`
- TypeScript strict mode — no `any` types
- No barrel exports (index.ts re-exporting everything) — import directly from file
- No default exports — use named exports only

---

## 3. Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| React | 18.x | UI framework |
| Vite | 5.x | Build tool |
| TypeScript | 5.x | Type safety |
| TailwindCSS | 3.x | Utility-first CSS |
| Leaflet (react-leaflet) | latest | Map rendering (free, OSM tiles) |
| @supabase/supabase-js | latest | Auth + DB client |

---

## 4. Component Specifications

Each component section describes: purpose, props, states (loading/empty/error/active), and specific markup notes.

### 4.1 `App.tsx`

Root component. Responsibilities:
- Initialize Supabase client
- Track auth state (`onAuthStateChange`)
- If not authenticated → render `AuthScreen` (toggle between Login/Register)
- If authenticated → render main layout with bottom tabs

**States:**
- `loading` — full-screen spinner (minimal, just one rotating circle)
- `unauthenticated` — auth forms
- `authenticated` — main app

**No Router needed for Stage 1** — use React state to switch views.

### 4.2 `LoginForm.tsx`

- Email input + password input + "Log in" button
- Link: "No account? Register" (switches to RegisterForm)
- Error state: show Supabase auth error below the form in red text
- Loading state: button shows "Logging in..." + disabled

### 4.3 `RegisterForm.tsx`

- Email input + password input + "Create account" button
- Link: "Have an account? Log in" (switches to LoginForm)
- Same error/loading patterns as LoginForm

### 4.4 `RideMap.tsx`

**Purpose:** Leaflet map component using OpenStreetMap tiles. Displays basemap, live location, recorded route.

**Props:**
```typescript
interface RideMapProps {
  currentPosition: [number, number] | null; // [lat, lng]
  route: [number, number][];                // array of [lat, lng]
  isRiding: boolean;
  scrubPosition?: [number, number] | null;  // for timeline scrubber
}
```

**Behavior:**
- Center map on user location on mount
- Show blue circle marker for current position (pulsing CSS animation when riding)
- Draw route as a polyline (emerald color, 4px weight)
- Fit bounds to route + current position
- Toggle between light/dark tiles based on `dark` class:
  - Light: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
  - Dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- Use `react-leaflet` with `MapContainer`, `TileLayer`, `Polyline`, `CircleMarker`, `Marker`
- Default zoom: 15, max zoom: 19

**Dependencies:** `leaflet`, `react-leaflet`, `@types/leaflet`
**No API key needed** — OpenStreetMap tiles are free.

### 4.5 `RideControls.tsx`

**Purpose:** Floating action buttons to control ride state.

**States & Display:**
- **Idle** (no ride started): Large emerald "▶ START RIDE" button (centered at bottom)
- **Recording** (ride active): Two buttons side by side
  - ⏸ PAUSE (amber)
  - ⏹ STOP (red)
- **Paused**: Two buttons side by side
  - ▶ RESUME (emerald)
  - ⏹ STOP (red)

**Props:**
```typescript
interface RideControlsProps {
  rideState: 'idle' | 'recording' | 'paused';
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}
```

### 4.6 `LiveStats.tsx`

**Purpose:** Bottom sheet showing current ride metrics.

**Display:**
- Distance (km, 1 decimal)
- Duration (min:sec format)
- Current speed (km/h)
- Last recorded point preview: temp, humidity, lux

**Props:**
```typescript
interface LiveStatsProps {
  distance: number;
  duration: number;  // seconds
  currentSpeed: number;
  lastTemp: number | null;
  lastHumidity: number | null;
  lastLux: number | null;
  isVisible: boolean;
}
```

### 4.7 `WeatherWidget.tsx`

**Purpose:** Floating widget in top-right corner showing current weather.

**Display:**
- Weather icon (from WeatherAPI.com)
- Temperature + humidity on one line
- Feels-like below (smaller, muted)

**Props:**
```typescript
interface WeatherWidgetProps {
  temperature: number | null;
  humidity: number | null;
  feelsLike: number | null;
  description: string | null;
  icon: string | null;
}
```

**States:**
- `null/loading` — show "—" placeholders, no spinner
- `error` — show "Weather unavailable" in muted text

### 4.8 `RideFeedbackModal.tsx`

**Purpose:** Full-screen modal shown immediately after ride stops. Cannot be dismissed without submitting.

**8 Survey Questions:**

1. **Perceived temperature:** 5 buttons in a row labeled 1-5, subtitle "How hot did it feel?"
2. **Shade quality:** 5 buttons labeled 1-5, subtitle "How shaded was your route?"
3. **Route preference:** 3 buttons: "Yes" / "Maybe" / "No", subtitle "Would you prefer a shadier route?"
4. **UV concern:** 5 buttons labeled 1-5, subtitle "How concerned about UV exposure?"
5. **Hydration:** 5 buttons labeled 1-5, subtitle "Did you feel adequately hydrated?"
6. **Road quality:** 5 buttons labeled 1-5, subtitle "How was the road surface?"
7. **Time of day:** Auto-computed (no UI): based on `started_at` hour:
   - 5-11 → morning, 12-16 → afternoon, 17-19 → evening, 20-4 → night
8. **Comments:** Textarea (2 rows), "Anything else?"

**Submit button** at bottom: "Submit Feedback" → inserts to `ride_feedback` → closes modal → shows timeline

### 4.9 `RideTimeline.tsx`

**Purpose:** Post-ride scrubber to explore conditions along the route.

**Layout:**
```
┌────────────────────────────────────────┐
│              Map (with route)          │
│                      ● (scrub marker)   │
├────────────────────────────────────────┤
│ ───●───────────────────────────────    │
│ Start                       End        │
├────────────────────────────────────────┤
│  Point 12/42   10:32 AM               │
│  🌡 34°C  💧 62%  ☀ 12,400 lux       │
│  📍 13.0827°N, 80.2707°E              │
└────────────────────────────────────────┘
```

**Props:**
```typescript
interface RideTimelineProps {
  points: RidePoint[];  // from ride_points table
  route: [number, number][];
}

interface RidePoint {
  point_index: number;
  location: { lat: number; lng: number };
  recorded_at: string;
  temperature: number | null;
  humidity: number | null;
  lux: number | null;
}
```

**Behavior:**
- HTML range input for the slider (styled to match dark/light mode)
- On scrub → move map marker + update info card
- Show percentage below timeline (e.g., "28%")

### 4.10 `RideHistory.tsx`

**Purpose:** Profile tab showing list of completed rides.

**Display:** Simple vertical list. Each item shows:
- Date (e.g., "19 Jun 2026")
- Time (e.g., "10:30 AM - 11:05 AM")  
- Distance + Duration (e.g., "4.2 km · 35 min")
- Tappable → opens detail view with map + timeline

**Empty state:** "No rides yet. Start your first ride!"

---

## 5. Hooks

### 5.1 `useGeolocation(isTracking: boolean)`

```typescript
return {
  position: { lat: number; lng: number } | null,
  error: string | null,
  accuracy: number | null
}
```

- Uses `navigator.geolocation.watchPosition` when tracking
- Options: `enableHighAccuracy: true, maximumAge: 0, timeout: 10000`
- Clears watch on cleanup

### 5.2 `useSensors(isTracking: boolean)`

```typescript
return {
  lux: number | null,
  acceleration: { x: number; y: number; z: number } | null,
  alsSupported: boolean,
  accelSupported: boolean
}
```

- ALS: `navigator.ambientLight` API (try/catch — not all browsers support)
- Accelerometer: `window.DeviceMotionEvent` listener
- Both should fail gracefully — show "not supported" message if unavailable
- Request permission for DeviceMotion on iOS 13+ (`DeviceMotionEvent.requestPermission()`)

### 5.3 `useWeather(lat: number | null, lng: number | null)`

```typescript
return {
  weather: WeatherData | null,
  loading: boolean,
  error: string | null
}
```

- Fetches from Supabase Edge Function: `GET /functions/v1/weather?lat=X&lon=Y`
- Polls every 30 seconds when `lat` and `lng` are non-null
- Skips fetch if position hasn't changed > 100m since last fetch

---

## 6. Library: `supabase.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

---

## 7. Environment Variables

Copy `frontend/.env.example` to `frontend/.env` (do NOT commit `.env`):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

| Variable | Source |
|----------|--------|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon/public |

Both are accessed in code as `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY`.

---

## 8. TypeScript Types (matches backend contract)

```typescript
// types/index.ts

export interface Ride {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  route: GeoJSON.LineString | null;
  distance_m: number | null;
  duration_sec: number | null;
  weather_snapshot: WeatherData | null;
  sensor_data: { avg_lux: number | null; avg_accel_magnitude: number | null } | null;
}

export interface RidePoint {
  id: string;
  ride_id: string;
  point_index: number;
  location: { lat: number; lng: number };
  recorded_at: string;
  temperature: number | null;
  humidity: number | null;
  lux: number | null;
  accel_x: number | null;
  accel_y: number | null;
  accel_z: number | null;
}

export interface RideFeedback {
  id: string;
  ride_id: string;
  user_id: string;
  submitted_at: string;
  perceived_temperature: number;
  shade_quality: number;
  route_preference: 'yes' | 'no' | 'maybe';
  uv_concern: number;
  hydration_level: number;
  road_quality: number;
  time_of_day: string;
  additional_comments: string | null;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  feels_like: number;
  description: string;
  icon: string;
}
```

---

## 9. Implementation Order

Build components in this order (each step must pass review before moving on):

1. Project scaffold: `npm create vite`, install dependencies, TailwindCSS config, dark mode setup
2. `lib/supabase.ts` + `.env` + `types/index.ts`
3. `LoginForm.tsx` + `RegisterForm.tsx` + `App.tsx` auth gating
4. `RideMap.tsx` with Leaflet (no route yet, just current location)
5. `useGeolocation.ts`
6. `RideControls.tsx` + ride state machine in App.tsx
7. `useWeather.ts` + `WeatherWidget.tsx`
8. `useSensors.ts` + display readings
9. `LiveStats.tsx` (distance, duration, speed computation)
10. Save ride to Supabase on stop (route + ride_points batch insert)
11. `RideFeedbackModal.tsx` + submit to `ride_feedback` table
12. `RideTimeline.tsx` with scrubber
13. `RideHistory.tsx` (Profile tab)
14. Tab navigation (Map / Ride / Profile)
15. Dark mode toggle
16. Final review pass

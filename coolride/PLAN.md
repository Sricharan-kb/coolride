# CoolRide Implementation Plan — Speed, Timeline & Map Fixes

## Issues Summary

| Issue | Current Behavior | Desired Behavior |
|-------|-----------------|------------------|
| Speed shows 3 km/hr stationary | Average speed since start accumulates GPS drift | Instantaneous GPS speed (0 when stationary) |
| History map doesn't zoom | Static routes don't trigger fitBounds | Auto-zoom to show full route |
| Timeline map too small | `h-48` (192px) tiny strip | `flex-1` map dominating the view |
| No speed/weather per point | `RidePoint` missing `speed_kmh` and `feels_like` | Show speed, temp, feels_like, humidity at each slider position |

---

## 1. Backend Schema Migration

**File:** `coolride/backend/supabase/migrations/002_add_speed_feelslike.sql`

```sql
ALTER TABLE ride_points
ADD COLUMN IF NOT EXISTS speed_kmh DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS feels_like DOUBLE PRECISION;
```

**Run in:** Supabase Dashboard → SQL Editor

---

## 2. Frontend Types

**File:** `coolride/frontend/src/types/index.ts`

Add to `RidePoint`:
```typescript
export interface RidePoint {
  id: string
  ride_id: string
  point_index: number
  location: { lat: number; lng: number }
  recorded_at: string
  temperature: number | null
  humidity: number | null
  feels_like: number | null      // NEW
  speed_kmh: number | null       // NEW
  lux: number | null             // keep for backend, hide from UI
  accel_x: number | null         // keep for backend, hide from UI
  accel_y: number | null         // keep for backend, hide from UI
  accel_z: number | null         // keep for backend, hide from UI
}
```

---

## 3. useGeolocation Hook — Expose Speed & Accuracy

**File:** `coolride/frontend/src/hooks/useGeolocation.ts`

Add `speed` and `accuracy` to return:
```typescript
interface GeolocationState {
  position: { lat: number; lng: number } | null
  error: string | null
  accuracy: number | null
  speed: number | null       // NEW — GPS instantaneous speed in m/s
}
```

In `handlePosition`:
```typescript
setSpeed(pos.coords.speed)  // m/s, null if unavailable
```

---

## 4. useRideRecorder Hook — Core Changes

**File:** `coolride/frontend/src/hooks/useRideRecorder.ts`

### A. Speed calculation (replace average with instantaneous)
- Primary: `position.coords.speed` (m/s from GPS chip) → `* 3.6` → km/h
- Fallback: If `speed` is null, use distance/time between this point and previous, but apply GPS accuracy threshold (ignore movement < accuracy radius)
- Return `currentSpeed` as instantaneous, not average

### B. Capture `feels_like` from weather at each sample
```typescript
const point: BufferedPoint = {
  lat: position.lat,
  lng: position.lng,
  recorded_at: new Date().toISOString(),
  temperature: weather?.temperature ?? null,
  humidity: weather?.humidity ?? null,
  feels_like: weather?.feels_like ?? null,  // NEW
  speed_kmh: gpsSpeed,                       // NEW
  lux,
  accel_x: acceleration?.x ?? null,
  accel_y: acceleration?.y ?? null,
  accel_z: acceleration?.z ?? null,
}
```

### C. Persist new fields to database
```typescript
const ridePoints = points.map((p, i) => ({
  ride_id: rideId,
  point_index: i,
  location: `POINT(${p.lng} ${p.lat})`,
  recorded_at: p.recorded_at,
  temperature: p.temperature,
  humidity: p.humidity,
  feels_like: p.feels_like,     // NEW
  speed_kmh: p.speed_kmh,       // NEW
  lux: p.lux,
  accel_x: p.accel_x,
  accel_y: p.accel_y,
  accel_z: p.accel_z,
}))
```

### D. Build timeline points with new fields
```typescript
setTimelinePoints(
  points.map((p, i) => ({
    id: '',
    ride_id: rideId,
    point_index: i,
    location: { lat: p.lat, lng: p.lng },
    recorded_at: p.recorded_at,
    temperature: p.temperature,
    humidity: p.humidity,
    feels_like: p.feels_like,     // NEW
    speed_kmh: p.speed_kmh,       // NEW
    lux: p.lux,
    accel_x: p.accel_x,
    accel_y: p.accel_y,
    accel_z: p.accel_z,
  }))
)
```

---

## 5. App.tsx — Live Stats Update

**File:** `coolride/frontend/src/App.tsx`

### Remove sensor display blocks
Delete lux and accelerometer display from Ride tab.

### Update LiveStats
```tsx
<LiveStats
  distance={recorder.distanceKm}
  duration={recorder.durationSeconds}
  currentSpeed={recorder.currentSpeed}  // now instantaneous GPS speed
  lastTemp={recorder.lastPoint?.temperature ?? null}
  lastHumidity={recorder.lastPoint?.humidity ?? null}
  lastLux={null}  // hide from UI
  isVisible={recorder.rideState !== 'idle'}
/>
```

### Add GPS status indicator
In Ride tab, show:
- `GPS Locked` (green) when position available
- `GPS Searching...` (gray) when no position
- `GPS Error: <msg>` (red) when geoError

---

## 6. RideMap.tsx — Zoom Fix

**File:** `coolride/frontend/src/components/Map/RideMap.tsx`

**Problem:** `useMap()` returns before Leaflet initializes → `fitBounds` silently fails for static routes.

**Fix:** Wrap `fitBounds` in `map.whenReady()`:
```typescript
useEffect(() => {
  const validRoute = route.filter(
    ([lat, lng]) =>
      typeof lat === 'number' &&
      !isNaN(lat) &&
      typeof lng === 'number' &&
      !isNaN(lng)
  )

  if (validRoute.length > 1) {
    map.whenReady(() => {
      const bounds = L.latLngBounds(validRoute.map(([lat, lng]) => [lat, lng]))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 })
    })
  }
}, [route, map])
```

---

## 7. RideTimeline.tsx — Bigger Map + Per-Point Details

**File:** `coolride/frontend/src/components/Ride/RideTimeline.tsx`

### New layout
```
┌──────────────────────────────┐  ← flex-1 map (~70% height)
│                              │
│      [full route map]        │
│                              │
└──────────────────────────────┘
┌──────────────────────────────┐  ← compact bottom bar (~30%)
│ Start ○──────────────○ End   │  ← slider
│ Point 3/12 · 2:34pm          │
│ 12.5 km/h                    │  ← speed at this point
│ 32°C · Feels 36°C · 78%      │  ← weather at this point
│ 13.0827°N, 80.2707°E         │  ← coordinates
└──────────────────────────────┘
```

### Changes
- Map container: `h-48` → `flex-1`
- Remove lux display
- Add speed display: `{current.speed_kmh?.toFixed(1) ?? '—'} km/h`
- Add feels_like: `Feels {current.feels_like?.toFixed(0) ?? '—'}°C`
- Keep: temperature, humidity, coordinates

---

## 8. RideHistory.tsx — Fetch & Transform New Fields

**File:** `coolride/frontend/src/components/Profile/RideHistory.tsx`

### Transform new fields from database
```typescript
return {
  id: String(p.id ?? ''),
  ride_id: p.ride_id,
  point_index: p.point_index,
  location: loc,
  recorded_at: p.recorded_at,
  temperature: typeof p.temperature === 'number' ? p.temperature : null,
  humidity: typeof p.humidity === 'number' ? p.humidity : null,
  feels_like: typeof p.feels_like === 'number' ? p.feels_like : null,  // NEW
  speed_kmh: typeof p.speed_kmh === 'number' ? p.speed_kmh : null,     // NEW
  lux: typeof p.lux === 'number' ? p.lux : null,
  accel_x: typeof p.accel_x === 'number' ? p.accel_x : null,
  accel_y: typeof p.accel_y === 'number' ? p.accel_y : null,
  accel_z: typeof p.accel_z === 'number' ? p.accel_z : null,
}
```

---

## 9. Execution Order

1. **Backend:** Run SQL migration in Supabase Dashboard
2. **Frontend Types:** Update `RidePoint` interface
3. **useGeolocation.ts:** Expose `speed` and `accuracy`
4. **useRideRecorder.ts:** Add speed + feels_like capture and persist
5. **RideMap.tsx:** Fix `fitBounds` with `whenReady()`
6. **RideTimeline.tsx:** Bigger map, add speed/feels_like display
7. **RideHistory.tsx:** Transform new fields from database
8. **App.tsx:** Update LiveStats, remove sensor UI, add GPS status
9. **Commit, push, redeploy**

---

## Speed Fallback Decision

When `position.coords.speed` is `null` (older phones), use **GPS accuracy threshold**:
- If movement between two points < GPS accuracy radius → speed = 0
- If movement >= accuracy → distance ÷ time

This eliminates drift. Agreed.

---

## Testing Checklist

- [ ] Start ride while stationary → speed shows `0.0 km/h`
- [ ] Start walking → speed updates to actual walking pace
- [ ] Stop ride → timeline shows full route, map zooms to fit
- [ ] Submit feedback → Ride tab shows timeline with Close button
- [ ] Profile → Ride History → select ride → shows big map with slider
- [ ] Slide through points → shows speed, temperature, feels_like, humidity per point
- [ ] Start new ride → old timeline clears automatically

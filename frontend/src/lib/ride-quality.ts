import type { RidePoint } from '../types/index'

export interface RoughPoint {
  index: number
  lat: number
  lng: number
  jerk: number
  jounce: number
  roughness: number
  label: string
  distanceKm: number
}

const JERK_BAD = 3.0
const JOUNCE_BAD = 6.0

export function computeRoughness(jerk: number, jounce: number): number {
  return Math.min(jerk / JERK_BAD + jounce / JOUNCE_BAD, 5)
}

export function classifyRoughness(roughness: number): string {
  if (roughness < 1) return 'smooth'
  if (roughness < 2) return 'minor vibration'
  if (roughness < 3) return 'rough patch'
  if (roughness < 4) return 'pothole'
  return 'severe damage'
}

export function intensityColor(roughness: number): string {
  if (roughness < 1) return '#22c55e'
  if (roughness < 2) return '#84cc16'
  if (roughness < 3) return '#eab308'
  if (roughness < 4) return '#f97316'
  return '#ef4444'
}

export function findRoughPoints(
  points: RidePoint[],
  threshold = 2,
): RoughPoint[] {
  const results: RoughPoint[] = []
  const valid = points.filter(
    (p) =>
      p.accel_x != null &&
      p.accel_y != null &&
      p.accel_z != null &&
      p.recorded_at != null,
  )
  if (valid.length < 2) return results

  const mags: number[] = []
  const jerks: number[] = []

  for (let i = 0; i < valid.length; i++) {
    const p = valid[i]
    const mag = Math.sqrt(
      (p.accel_x ?? 0) ** 2 + (p.accel_y ?? 0) ** 2 + (p.accel_z ?? 0) ** 2,
    )
    mags.push(mag)
    if (i > 0) {
      const dt =
        (new Date(p.recorded_at).getTime() -
          new Date(valid[i - 1].recorded_at).getTime()) /
        1000
      const jerk = dt > 0 ? Math.abs(mag - mags[i - 1]) / dt : 0
      jerks.push(jerk)
    } else {
      jerks.push(0)
    }
  }

  let cumDist = 0
  for (let i = 1; i < jerks.length; i++) {
    const dt =
      (new Date(valid[i].recorded_at).getTime() -
        new Date(valid[i - 1].recorded_at).getTime()) /
      1000
    const jounce = dt > 0 ? Math.abs(jerks[i] - jerks[i - 1]) / dt : 0
    const roughness = computeRoughness(jerks[i], jounce)

    const p = valid[i]
    const prev = valid[i - 1]
    const dlng = ((p.location.lng - prev.location.lng) * Math.PI) / 180
    const dlat = ((p.location.lat - prev.location.lat) * Math.PI) / 180
    const a =
      Math.sin(dlat / 2) ** 2 +
      Math.cos((prev.location.lat * Math.PI) / 180) *
        Math.cos((p.location.lat * Math.PI) / 180) *
        Math.sin(dlng / 2) ** 2
    cumDist += 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    if (roughness >= threshold) {
      results.push({
        index: points.indexOf(valid[i]),
        lat: valid[i].location.lat,
        lng: valid[i].location.lng,
        jerk: Math.round(jerks[i] * 100) / 100,
        jounce: Math.round(jounce * 100) / 100,
        roughness: Math.round(roughness * 10) / 10,
        label: classifyRoughness(roughness),
        distanceKm: cumDist / 1000,
      })
    }
  }
  return results
}

export function computeJerkSeries(points: RidePoint[]): {
  distanceKm: number[]
  accelMagnitude: number[]
  jerk: number[]
} {
  const result = {
    distanceKm: [] as number[],
    accelMagnitude: [] as number[],
    jerk: [] as number[],
  }
  const valid = points.filter(
    (p) =>
      p.accel_x != null &&
      p.accel_y != null &&
      p.accel_z != null &&
      p.recorded_at != null,
  )
  if (valid.length < 2) return result

  let cumDist = 0
  for (let i = 0; i < valid.length; i++) {
    const p = valid[i]
    const mag = Math.sqrt(
      (p.accel_x ?? 0) ** 2 + (p.accel_y ?? 0) ** 2 + (p.accel_z ?? 0) ** 2,
    )
    result.accelMagnitude.push(mag)

    if (i > 0) {
      const prev = valid[i - 1]
      const dlng =
        ((p.location.lng - prev.location.lng) * Math.PI) / 180
      const dlat =
        ((p.location.lat - prev.location.lat) * Math.PI) / 180
      const a =
        Math.sin(dlat / 2) ** 2 +
        Math.cos((prev.location.lat * Math.PI) / 180) *
          Math.cos((p.location.lat * Math.PI) / 180) *
          Math.sin(dlng / 2) ** 2
      cumDist += 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const dt =
        (new Date(p.recorded_at).getTime() -
          new Date(prev.recorded_at).getTime()) /
        1000
      const j = dt > 0 ? Math.abs(mag - result.accelMagnitude[i - 1]) / dt : 0
      result.jerk.push(j)
    } else {
      result.jerk.push(0)
    }
    result.distanceKm.push(cumDist / 1000)
  }
  return result
}

export function computeAccelSeries(points: RidePoint[]): {
  distanceKm: number[]
  accelX: number[]
  accelY: number[]
  accelZ: number[]
} {
  const result = {
    distanceKm: [] as number[],
    accelX: [] as number[],
    accelY: [] as number[],
    accelZ: [] as number[],
  }
  const valid = points.filter(
    (p) =>
      p.accel_x != null &&
      p.accel_y != null &&
      p.accel_z != null &&
      p.recorded_at != null,
  )
  if (valid.length < 2) return result

  let cumDist = 0
  for (let i = 0; i < valid.length; i++) {
    const p = valid[i]
    result.accelX.push(p.accel_x ?? 0)
    result.accelY.push(p.accel_y ?? 0)
    result.accelZ.push(p.accel_z ?? 0)

    if (i > 0) {
      const prev = valid[i - 1]
      const dlng =
        ((p.location.lng - prev.location.lng) * Math.PI) / 180
      const dlat =
        ((p.location.lat - prev.location.lat) * Math.PI) / 180
      const a =
        Math.sin(dlat / 2) ** 2 +
        Math.cos((prev.location.lat * Math.PI) / 180) *
          Math.cos((p.location.lat * Math.PI) / 180) *
          Math.sin(dlng / 2) ** 2
      cumDist += 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }
    result.distanceKm.push(cumDist / 1000)
  }
  return result
}

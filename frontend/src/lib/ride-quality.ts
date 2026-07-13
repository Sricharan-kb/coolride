import type { RidePoint } from '../types/index'

export interface JerkPoint {
  index: number
  lat: number
  lng: number
  jerk: number
  jounce: number
  distanceKm: number
}

const MIN_JERK = 1.0

export function findJerkPoints(
  points: RidePoint[],
  minJerk = MIN_JERK,
): JerkPoint[] {
  const results: JerkPoint[] = []
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

    if (jerks[i] >= minJerk) {
      results.push({
        index: points.indexOf(valid[i]),
        lat: valid[i].location.lat,
        lng: valid[i].location.lng,
        jerk: Math.round(jerks[i] * 100) / 100,
        jounce: Math.round(jounce * 100) / 100,
        distanceKm: cumDist / 1000,
      })
    }
  }
  return results
}

export function exportJerkCSV(points: JerkPoint[], filename: string): void {
  const header = 'rank,jerk_m_s3,jounce_m_s4,lat,lng,distance_km'
  const rows = points
    .sort((a, b) => b.jerk - a.jerk)
    .map((p, i) =>
      [i + 1, p.jerk, p.jounce, p.lat, p.lng, p.distanceKm].join(','),
    )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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

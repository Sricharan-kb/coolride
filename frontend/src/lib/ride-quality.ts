import type { RidePoint } from '../types/index'

export interface JerkPoint {
  index: number
  lat: number
  lng: number
  zJerk: number
  xJerk: number
  yJerk: number
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

  const zJerk: number[] = []
  const xJerk: number[] = []
  const yJerk: number[] = []

  for (let i = 0; i < valid.length; i++) {
    if (i > 0) {
      const p = valid[i]
      const prev = valid[i - 1]
      const dt =
        (new Date(p.recorded_at).getTime() -
          new Date(prev.recorded_at).getTime()) /
        1000
      const dz = dt > 0 ? Math.abs((p.accel_z ?? 0) - (prev.accel_z ?? 0)) / dt : 0
      const dx = dt > 0 ? Math.abs((p.accel_x ?? 0) - (prev.accel_x ?? 0)) / dt : 0
      const dy = dt > 0 ? Math.abs((p.accel_y ?? 0) - (prev.accel_y ?? 0)) / dt : 0
      zJerk.push(dz)
      xJerk.push(dx)
      yJerk.push(dy)
    } else {
      zJerk.push(0)
      xJerk.push(0)
      yJerk.push(0)
    }
  }

  let cumDist = 0
  for (let i = 1; i < zJerk.length; i++) {
    const dt =
      (new Date(valid[i].recorded_at).getTime() -
        new Date(valid[i - 1].recorded_at).getTime()) /
      1000
    const jounce = dt > 0 ? Math.abs(zJerk[i] - zJerk[i - 1]) / dt : 0

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

    if (zJerk[i] >= minJerk) {
      results.push({
        index: points.indexOf(valid[i]),
        lat: valid[i].location.lat,
        lng: valid[i].location.lng,
        zJerk: Math.round(zJerk[i] * 100) / 100,
        xJerk: Math.round(xJerk[i] * 100) / 100,
        yJerk: Math.round(yJerk[i] * 100) / 100,
        jounce: Math.round(jounce * 100) / 100,
        distanceKm: cumDist / 1000,
      })
    }
  }
  return results
}

export function exportJerkCSV(points: JerkPoint[], filename: string): void {
  const header = 'rank,z_jerk_m_s3,x_jerk_m_s3,y_jerk_m_s3,jounce_m_s4,lat,lng,distance_km'
  const rows = points
    .sort((a, b) => b.zJerk - a.zJerk)
    .map((p, i) =>
      [i + 1, p.zJerk, p.xJerk, p.yJerk, p.jounce, p.lat, p.lng, p.distanceKm].join(','),
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
      const dlng = ((p.location.lng - prev.location.lng) * Math.PI) / 180
      const dlat = ((p.location.lat - prev.location.lat) * Math.PI) / 180
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

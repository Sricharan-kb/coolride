import { useState, useEffect, useRef, useCallback } from 'react'
import type { WeatherData, RidePoint } from '../types/index'
import { supabase } from '../lib/supabase'
import { haversineDistance } from '../lib/geo'
import { useGeolocation } from './useGeolocation'
import { useSensors } from './useSensors'
import { useWeather } from './useWeather'
import type { RideState } from '../components/Ride/RideControls'

// Internal buffered sample captured during a ride. Persisted to ride_points on stop.
interface BufferedPoint {
  lat: number
  lng: number
  recorded_at: string
  temperature: number | null
  humidity: number | null
  feels_like: number | null
  speed_kmh: number | null
  lux: number | null
  accel_x: number | null
  accel_y: number | null
  accel_z: number | null
}

interface UseRideRecorderArgs {
  userId: string
}

/**
 * Owns the active-ride subsystem: the ride state machine, GPS/sensor/weather
 * sampling, live stats, and persistence.
 */
export function useRideRecorder({ userId }: UseRideRecorderArgs) {
  const [rideState, setRideState] = useState<RideState>('idle')
  const [rideId, setRideId] = useState<string | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackRideId, setFeedbackRideId] = useState<string | null>(null)
  const [feedbackStartedAt, setFeedbackStartedAt] = useState('')
  const [showTimeline, setShowTimeline] = useState(false)
  const [timelinePoints, setTimelinePoints] = useState<RidePoint[] | null>(null)
  const [timelineRoute, setTimelineRoute] = useState<[number, number][] | null>(null)
  const [tick, setTick] = useState(0)
  const [ridesRefreshKey, setRidesRefreshKey] = useState(0)

  // Preserved final ride stats (available after ride ends)
  const [lastRideDistanceKm, setLastRideDistanceKm] = useState(0)
  const [lastRideDurationSec, setLastRideDurationSec] = useState(0)
  const [lastRideAvgSpeed, setLastRideAvgSpeed] = useState(0)
  const [lastRideIsPublic, setLastRideIsPublic] = useState(false)

  const isTracking = rideState === 'recording'
  const { position, smoothedPosition, error: geoError } = useGeolocation(isTracking)
  const { lux, acceleration } = useSensors(isTracking)
  const { weather, error: weatherError } = useWeather(
    isTracking && position ? position.lat : null,
    isTracking && position ? position.lng : null
  )

  const routeRef = useRef<[number, number][]>([])
  const pointsRef = useRef<BufferedPoint[]>([])
  const distanceRef = useRef(0)
  const startTimeRef = useRef<number | null>(null)
  const pausedDurationRef = useRef(0)
  const pauseStartRef = useRef<number | null>(null)
  const lastCaptureRef = useRef(0)
  const lastWeatherRef = useRef<WeatherData | null>(null)

  // Capture a GPS + sensor + weather sample at most every 5s while recording.
  useEffect(() => {
    if (!isTracking || !position) return

    const now = Date.now()
    if (now - lastCaptureRef.current < 5000) return
    lastCaptureRef.current = now

    const prevLength = pointsRef.current.length
    let segmentM = 0
    if (prevLength > 0) {
      const prev = pointsRef.current[prevLength - 1]
      segmentM = haversineDistance(prev.lat, prev.lng, position.lat, position.lng)
      distanceRef.current += segmentM
    }

    // Calculate speed from distance/time with 10m threshold to eliminate drift
    let speedKmh: number | null = null
    if (prevLength > 0) {
      const thresholdM = 10
      const elapsedSec = (now - new Date(pointsRef.current[prevLength - 1].recorded_at).getTime()) / 1000
      if (elapsedSec > 0) {
        if (segmentM < thresholdM) {
          speedKmh = 0
        } else {
          speedKmh = (segmentM / elapsedSec) * 3.6
        }
      }
    } else {
      speedKmh = 0
    }

    const point: BufferedPoint = {
      lat: position.lat,
      lng: position.lng,
      recorded_at: new Date().toISOString(),
      temperature: weather?.temperature ?? null,
      humidity: weather?.humidity ?? null,
      feels_like: weather?.feels_like ?? null,
      speed_kmh: speedKmh,
      lux,
      accel_x: acceleration?.x ?? null,
      accel_y: acceleration?.y ?? null,
      accel_z: acceleration?.z ?? null,
    }

    pointsRef.current.push(point)
    routeRef.current.push([position.lat, position.lng])

    if (weather) {
      lastWeatherRef.current = weather
    }

    setTick((t) => t + 1)
  }, [position, isTracking, weather, lux, acceleration])

  // 1s UI refresh tick while recording (drives live stat updates).
  useEffect(() => {
    if (rideState === 'recording' && tick > 0) {
      const id = setInterval(() => setTick((t) => t + 1), 1000)
      return () => clearInterval(id)
    }
  }, [rideState, tick])

  const start = useCallback(async (): Promise<boolean> => {
    if (!userId) return false

    const { data, error } = await supabase
      .from('rides')
      .insert({ user_id: userId, started_at: new Date().toISOString() })
      .select('id, started_at')
      .single()

    if (error || !data) return false

    setRideId(data.id)
    routeRef.current = []
    pointsRef.current = []
    distanceRef.current = 0
    startTimeRef.current = Date.now()
    pausedDurationRef.current = 0
    pauseStartRef.current = null
    lastCaptureRef.current = 0
    lastWeatherRef.current = null
    setShowTimeline(false)
    setTimelinePoints(null)
    setTimelineRoute(null)
    setFeedbackRideId(data.id)
    setFeedbackStartedAt(data.started_at)
    setRideState('recording')
    return true
  }, [userId])

  const pause = useCallback(() => {
    setRideState('paused')
    pauseStartRef.current = Date.now()
  }, [])

  const resume = useCallback(() => {
    if (pauseStartRef.current !== null) {
      pausedDurationRef.current += Date.now() - pauseStartRef.current
      pauseStartRef.current = null
    }
    setRideState('recording')
  }, [])

  const stop = useCallback(async () => {
    if (!rideId) return

    setRideState('idle')
    const endedAt = new Date().toISOString()
    const totalMs = startTimeRef.current
      ? Date.now() - startTimeRef.current - pausedDurationRef.current
      : 0
    const durationSec = Math.round(totalMs / 1000)
    const distanceM = Math.round(distanceRef.current)

    const points = pointsRef.current
    let avgLux: number | null = null
    let luxStdDev: number | null = null
    let shadeProfile: string | null = null
    let avgAccelMagnitude: number | null = null

    const luxVals = points.filter((p) => p.lux !== null).map((p) => p.lux as number)
    if (luxVals.length > 0) {
      const sum = luxVals.reduce((s, v) => s + v, 0)
      avgLux = sum / luxVals.length
      const variance = luxVals.reduce((s, v) => s + (v - avgLux!) ** 2, 0) / luxVals.length
      luxStdDev = Math.sqrt(variance)

      // Derive shade profile from avg lux + variation
      if (avgLux >= 10000) {
        shadeProfile = 'extreme_heat'
      } else if (avgLux >= 2200) {
        shadeProfile = luxStdDev > 500 ? 'intermittent_shade' : 'open_sunny'
      } else if (avgLux >= 1000) {
        shadeProfile = luxStdDev > 500 ? 'intermittent_shade' : 'light_cover'
      } else if (avgLux >= 500) {
        shadeProfile = luxStdDev > 300 ? 'light_cover' : 'fully_shaded'
      } else {
        shadeProfile = luxStdDev > 200 ? 'light_cover' : 'fully_shaded'
      }
    }

    const accelVals = points
      .filter((p) => p.accel_x !== null && p.accel_y !== null && p.accel_z !== null)
      .map((p) => Math.sqrt((p.accel_x as number) ** 2 + (p.accel_y as number) ** 2 + (p.accel_z as number) ** 2))
    if (accelVals.length > 0) {
      avgAccelMagnitude = accelVals.reduce((s, v) => s + v, 0) / accelVals.length
    }

    const isPublic = distanceM >= 1500
    const firstPoint = points.length > 0 ? points[0] : null
    const lastPoint = points.length > 0 ? points[points.length - 1] : null

    const sensorData = {
      avg_lux: avgLux,
      lux_std_dev: luxStdDev,
      shade_profile: shadeProfile,
      avg_accel_magnitude: avgAccelMagnitude,
    }

    const routeCoords = routeRef.current as [number, number][]
    let routeWkt: string | null = null
    if (routeCoords.length >= 2) {
      const wktCoords = routeCoords.map(([lat, lng]) => `${lng} ${lat}`).join(', ')
      routeWkt = `LINESTRING(${wktCoords})`
    }

    if (routeWkt) {
      const { error: rpcError } = await supabase.rpc('update_ride_route', {
        p_ride_id: rideId,
        p_route_wkt: routeWkt,
        p_distance_m: distanceM,
        p_duration_sec: durationSec,
        p_weather_snapshot: lastWeatherRef.current ?? {},
        p_sensor_data: sensorData,
        p_ended_at: endedAt,
      })
      if (rpcError) {
        console.error('Failed to persist route via RPC:', rpcError.message)
      }
    } else {
      const { error: fallbackError } = await supabase
        .from('rides')
        .update({
          ended_at: endedAt,
          distance_m: distanceM,
          duration_sec: durationSec,
          weather_snapshot: lastWeatherRef.current ?? {},
          sensor_data: sensorData,
        })
        .eq('id', rideId)
      if (fallbackError) {
        console.error('Failed to update ride:', fallbackError.message)
      }
    }

    const { error: extraError } = await supabase
      .from('rides')
      .update({
        is_public: isPublic,
        start_lat: firstPoint?.lat ?? null,
        start_lng: firstPoint?.lng ?? null,
        end_lat: lastPoint?.lat ?? null,
        end_lng: lastPoint?.lng ?? null,
      })
      .eq('id', rideId)
    if (extraError) {
      console.error('Failed to update ride extras:', extraError.message)
    }

    const ridePoints = points.map((p, i) => ({
      ride_id: rideId,
      point_index: i,
      location: `POINT(${p.lng} ${p.lat})`,
      recorded_at: p.recorded_at,
      temperature: p.temperature,
      humidity: p.humidity,
      feels_like: p.feels_like,
      speed_kmh: p.speed_kmh,
      lux: p.lux,
      accel_x: p.accel_x,
      accel_y: p.accel_y,
      accel_z: p.accel_z,
    }))

    if (ridePoints.length > 0) {
      const { error: pointsError } = await supabase.from('ride_points').insert(ridePoints)
      if (pointsError) {
        console.error('Failed to insert ride points:', pointsError.message)
      }
    }

    setTimelinePoints(
      points.map((p, i) => ({
        id: '',
        ride_id: rideId,
        point_index: i,
        location: { lat: p.lat, lng: p.lng },
        recorded_at: p.recorded_at,
        temperature: p.temperature,
        humidity: p.humidity,
        feels_like: p.feels_like,
        speed_kmh: p.speed_kmh,
        lux: p.lux,
        accel_x: p.accel_x,
        accel_y: p.accel_y,
        accel_z: p.accel_z,
      }))
    )
    setTimelineRoute(routeCoords)

    // Preserve final stats for summary card
    const finalDistanceKm = distanceRef.current / 1000
    const finalDurationSec = durationSec
    const finalAvgSpeed = finalDurationSec > 0 ? (finalDistanceKm / (finalDurationSec / 3600)) : 0
    setLastRideDistanceKm(finalDistanceKm)
    setLastRideDurationSec(finalDurationSec)
    setLastRideAvgSpeed(finalAvgSpeed)
    setLastRideIsPublic(isPublic)

    setShowFeedback(true)
  }, [rideId])

  const completeFeedback = useCallback(() => {
    setShowFeedback(false)
    setRidesRefreshKey((k) => k + 1)
  }, [])

  const viewTimeline = useCallback(() => {
    setShowTimeline(true)
  }, [])

  const closeTimeline = useCallback(() => {
    setShowTimeline(false)
    setTimelinePoints(null)
    setTimelineRoute(null)
  }, [])

  const reset = useCallback(() => {
    setRideState('idle')
    setRideId(null)
    setFeedbackRideId(null)
    setShowFeedback(false)
    setShowTimeline(false)
    setTimelinePoints(null)
    setTimelineRoute(null)
    setLastRideDistanceKm(0)
    setLastRideDurationSec(0)
    setLastRideAvgSpeed(0)
    setLastRideIsPublic(false)
  }, [])

  const durationSeconds =
    rideState === 'idle'
      ? 0
      : startTimeRef.current
        ? Math.floor(
            (Date.now() -
              startTimeRef.current -
              pausedDurationRef.current -
              (pauseStartRef.current !== null ? Date.now() - pauseStartRef.current : 0)) /
              1000
          )
        : 0

  const distanceKm = distanceRef.current / 1000

  const lastPoint =
    pointsRef.current.length > 0 ? pointsRef.current[pointsRef.current.length - 1] : null

  // Live speed: use last captured point's calculated speed
  const currentSpeed = lastPoint?.speed_kmh ?? 0

  return {
    rideState,
    rideId,
    position,
    smoothedPosition,
    geoError,
    weather,
    weatherError,
    lux,
    acceleration,
    distanceKm,
    durationSeconds,
    currentSpeed,
    lastPoint,
    route: routeRef.current,
    showFeedback,
    feedbackRideId,
    feedbackStartedAt,
    showTimeline,
    timelinePoints,
    timelineRoute,
    ridesRefreshKey,
    lastRideDistanceKm,
    lastRideDurationSec,
    lastRideAvgSpeed,
    lastRideIsPublic,
    start,
    pause,
    resume,
    stop,
    completeFeedback,
    viewTimeline,
    closeTimeline,
    reset,
  }
}

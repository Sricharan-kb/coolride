import { useState, useEffect, useRef, useCallback } from 'react'
import type { WeatherData, RidePoint } from './types/index'
import { supabase } from './lib/supabase'
import { haversineDistance } from './lib/geo'
import { LoginForm } from './components/Auth/LoginForm'
import { RegisterForm } from './components/Auth/RegisterForm'
import { RideMap } from './components/Map/RideMap'
import { RideControls } from './components/Ride/RideControls'
import type { RideState } from './components/Ride/RideControls'
import { LiveStats } from './components/Ride/LiveStats'
import { WeatherWidget } from './components/Weather/WeatherWidget'
import { RideFeedbackModal } from './components/Ride/RideFeedbackModal'
import { RideTimeline } from './components/Ride/RideTimeline'
import { RideHistory } from './components/Profile/RideHistory'
import { useGeolocation } from './hooks/useGeolocation'
import { useSensors } from './hooks/useSensors'
import { useWeather } from './hooks/useWeather'

type Tab = 'map' | 'ride' | 'profile'
type AuthView = 'login' | 'register'

interface BufferedPoint {
  lat: number
  lng: number
  recorded_at: string
  temperature: number | null
  humidity: number | null
  lux: number | null
  accel_x: number | null
  accel_y: number | null
  accel_z: number | null
}

export function App() {
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState<{ user: { id: string; email: string } } | null>(null)
  const [authView, setAuthView] = useState<AuthView>('login')
  const [activeTab, setActiveTab] = useState<Tab>('map')
  const [rideState, setRideState] = useState<RideState>('idle')
  const [rideId, setRideId] = useState<string | null>(null)
  const [ridesRefreshKey, setRidesRefreshKey] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackRideId, setFeedbackRideId] = useState<string | null>(null)
  const [feedbackStartedAt, setFeedbackStartedAt] = useState('')
  const [showTimeline, setShowTimeline] = useState(false)
  const [timelinePoints, setTimelinePoints] = useState<RidePoint[] | null>(null)
  const [timelineRoute, setTimelineRoute] = useState<[number, number][] | null>(null)
  const [tick, setTick] = useState(0)
  const [isDark, setIsDark] = useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  const isTracking = rideState === 'recording'
  const { position, error: geoError } = useGeolocation(isTracking)
  const { lux, acceleration } = useSensors(isTracking)
  const { weather } = useWeather(
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

  const userId = session?.user?.id ?? ''

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(
        currentSession?.user
          ? { user: { id: currentSession.user.id, email: currentSession.user.email ?? '' } }
          : null
      )
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!isTracking || !position) return

    const now = Date.now()
    if (now - lastCaptureRef.current < 5000) return
    lastCaptureRef.current = now

    const prevLength = pointsRef.current.length
    if (prevLength > 0) {
      const prev = pointsRef.current[prevLength - 1]
      distanceRef.current += haversineDistance(prev.lat, prev.lng, position.lat, position.lng)
    }

    const point: BufferedPoint = {
      lat: position.lat,
      lng: position.lng,
      recorded_at: new Date().toISOString(),
      temperature: weather?.temperature ?? null,
      humidity: weather?.humidity ?? null,
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

  useEffect(() => {
    if (rideState === 'recording' && tick > 0) {
      const id = setInterval(() => setTick((t) => t + 1), 1000)
      return () => clearInterval(id)
    }
  }, [rideState, tick])

  const handleStart = useCallback(async () => {
    if (!session) return

    const { data, error } = await supabase
      .from('rides')
      .insert({
        user_id: session.user.id,
        started_at: new Date().toISOString(),
      })
      .select('id, started_at')
      .single()

    if (error || !data) return

    setRideId(data.id)
    routeRef.current = []
    pointsRef.current = []
    distanceRef.current = 0
    startTimeRef.current = Date.now()
    pausedDurationRef.current = 0
    pauseStartRef.current = null
    lastCaptureRef.current = 0
    lastWeatherRef.current = null
    setFeedbackRideId(data.id)
    setFeedbackStartedAt(data.started_at)
    setRideState('recording')
    setActiveTab('map')
  }, [session])

  const handlePause = useCallback(() => {
    setRideState('paused')
    pauseStartRef.current = Date.now()
  }, [])

  const handleResume = useCallback(() => {
    if (pauseStartRef.current !== null) {
      pausedDurationRef.current += Date.now() - pauseStartRef.current
      pauseStartRef.current = null
    }
    setRideState('recording')
  }, [])

  const handleStop = useCallback(async () => {
    if (!rideId || !session) return

    setRideState('idle')
    const endedAt = new Date().toISOString()
    const totalMs = startTimeRef.current
      ? Date.now() - startTimeRef.current - pausedDurationRef.current
      : 0
    const durationSec = Math.round(totalMs / 1000)
    const distanceM = Math.round(distanceRef.current)

    const points = pointsRef.current
    let avgLux: number | null = null
    let avgAccelMagnitude: number | null = null

    const luxVals = points.filter((p) => p.lux !== null).map((p) => p.lux as number)
    if (luxVals.length > 0) {
      avgLux = luxVals.reduce((s, v) => s + v, 0) / luxVals.length
    }

    const accelVals = points
      .filter((p) => p.accel_x !== null && p.accel_y !== null && p.accel_z !== null)
      .map((p) => Math.sqrt((p.accel_x as number) ** 2 + (p.accel_y as number) ** 2 + (p.accel_z as number) ** 2))
    if (accelVals.length > 0) {
      avgAccelMagnitude = accelVals.reduce((s, v) => s + v, 0) / accelVals.length
    }

    const { error: updateError } = await supabase
      .from('rides')
      .update({
        ended_at: endedAt,
        distance_m: distanceM,
        duration_sec: durationSec,
        weather_snapshot: lastWeatherRef.current,
        sensor_data: {
          avg_lux: avgLux,
          avg_accel_magnitude: avgAccelMagnitude,
        },
      })
      .eq('id', rideId)

    if (updateError) {
      console.error('Failed to update ride:', updateError.message)
    }

    const ridePoints = points.map((p, i) => ({
      ride_id: rideId,
      point_index: i,
      location: { lat: p.lat, lng: p.lng },
      recorded_at: p.recorded_at,
      temperature: p.temperature,
      humidity: p.humidity,
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

    const routeCoords = routeRef.current as [number, number][]
    setTimelinePoints(
      ridePoints.map((p) => ({
        id: '',
        ride_id: rideId,
        point_index: p.point_index,
        location: p.location,
        recorded_at: p.recorded_at,
        temperature: p.temperature,
        humidity: p.humidity,
        lux: p.lux,
        accel_x: p.accel_x,
        accel_y: p.accel_y,
        accel_z: p.accel_z,
      }))
    )
    setTimelineRoute(routeCoords)
    setShowFeedback(true)
  }, [rideId, session])

  const handleFeedbackSubmit = useCallback(() => {
    setShowFeedback(false)
    setShowTimeline(true)
    setActiveTab('ride')
    setRidesRefreshKey((k) => k + 1)
  }, [])

  const handleToggleDarkMode = useCallback(() => {
    const root = document.documentElement
    if (root.classList.contains('dark')) {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setIsDark(false)
    } else {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setIsDark(true)
    }
  }, [])

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setRideState('idle')
    setRideId(null)
    setShowFeedback(false)
    setShowTimeline(false)
  }, [])

  const durationSeconds =
    rideState === 'idle'
      ? 0
      : startTimeRef.current
        ? Math.floor(
            (Date.now() -
              startTimeRef.current -
              pausedDurationRef.current -
              (pauseStartRef.current !== null
                ? Date.now() - pauseStartRef.current
                : 0)) /
              1000
          )
        : 0

  const distanceKm = distanceRef.current / 1000
  const currentSpeed =
    durationSeconds > 0 ? (distanceRef.current / durationSeconds) * 3.6 : 0

  const lastPoint =
    pointsRef.current.length > 0
      ? pointsRef.current[pointsRef.current.length - 1]
      : null

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center px-4">
        {authView === 'login' ? (
          <LoginForm onSwitchToRegister={() => setAuthView('register')} />
        ) : (
          <RegisterForm onSwitchToLogin={() => setAuthView('login')} />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 flex flex-col">
      <div className="flex-1 relative min-h-0">
        {activeTab === 'map' && !showTimeline && (
          <div className="absolute inset-0">
            <RideMap
              currentPosition={
                position ? [position.lat, position.lng] : null
              }
              route={routeRef.current}
              isRiding={isTracking}
            />
            <div className="absolute top-3 right-3 z-[1000]">
              <WeatherWidget
                temperature={weather?.temperature ?? null}
                humidity={weather?.humidity ?? null}
                feelsLike={weather?.feels_like ?? null}
                description={weather?.description ?? null}
                icon={weather?.icon ?? null}
              />
            </div>
            <div className="absolute bottom-24 left-0 right-0 z-[1000]">
              <LiveStats
                distance={distanceKm}
                duration={durationSeconds}
                currentSpeed={currentSpeed}
                lastTemp={lastPoint?.temperature ?? null}
                lastHumidity={lastPoint?.humidity ?? null}
                lastLux={lastPoint?.lux ?? null}
                isVisible={rideState !== 'idle'}
              />
            </div>
            <div className="absolute bottom-16 left-0 right-0 flex justify-center z-[1000]">
              <RideControls
                rideState={rideState}
                onStart={handleStart}
                onPause={handlePause}
                onResume={handleResume}
                onStop={handleStop}
              />
            </div>
            {geoError && (
              <div className="absolute top-3 left-3 z-[1000] bg-white dark:bg-zinc-900 px-3 py-1 text-sm text-red-600 dark:text-red-400">
                {geoError}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ride' && !showTimeline && (
          <div className="h-full overflow-y-auto p-4">
            {rideState !== 'idle' ? (
              <div>
                <h2 className="text-lg font-medium text-gray-900 dark:text-zinc-100 mb-4">
                  Current Ride
                </h2>
                <LiveStats
                  distance={distanceKm}
                  duration={durationSeconds}
                  currentSpeed={currentSpeed}
                  lastTemp={lastPoint?.temperature ?? null}
                  lastHumidity={lastPoint?.humidity ?? null}
                  lastLux={lastPoint?.lux ?? null}
                  isVisible
                />
                {lux !== null && (
                  <div className="mt-3 text-sm text-gray-500 dark:text-zinc-400">
                    Light: {lux.toFixed(0)} lux
                  </div>
                )}
                {acceleration && (
                  <div className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                    Accel: {acceleration.x.toFixed(1)},{' '}
                    {acceleration.y.toFixed(1)}, {acceleration.z.toFixed(1)} m/s²
                  </div>
                )}
                <div className="mt-6 flex justify-center">
                  <RideControls
                    rideState={rideState}
                    onStart={handleStart}
                    onPause={handlePause}
                    onResume={handleResume}
                    onStop={handleStop}
                  />
                </div>
              </div>
            ) : showTimeline && timelinePoints && timelineRoute ? (
              <div className="h-full">
                <RideTimeline points={timelinePoints} route={timelineRoute} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-sm text-gray-500 dark:text-zinc-400 gap-3">
                <p>No active ride</p>
                <button
                  onClick={() => setActiveTab('map')}
                  className="text-emerald-600 dark:text-emerald-400 underline"
                >
                  Go to Map to start
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="h-full overflow-y-auto">
            {showTimeline && timelinePoints && timelineRoute ? (
              <div className="h-full">
                <button
                  onClick={() => {
                    setShowTimeline(false)
                    setTimelinePoints(null)
                    setTimelineRoute(null)
                  }}
                  className="px-4 py-2 text-sm text-gray-500 dark:text-zinc-400 underline"
                >
                  Back to history
                </button>
                <RideTimeline points={timelinePoints} route={timelineRoute} />
              </div>
            ) : (
              <RideHistory
                userId={userId}
                isDark={isDark}
                onToggleDarkMode={handleToggleDarkMode}
                onLogout={handleLogout}
                refreshKey={ridesRefreshKey}
              />
            )}
          </div>
        )}
      </div>

      {!showFeedback && (
        <nav className="flex-shrink-0 border-t border-gray-200 dark:border-zinc-800 flex">
          {(['map', 'ride', 'profile'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-medium ${
                activeTab === tab
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-zinc-400'
              }`}
            >
              {tab === 'map' ? 'Map' : tab === 'ride' ? 'Ride' : 'Profile'}
            </button>
          ))}
        </nav>
      )}

      {showFeedback && feedbackRideId && (
        <RideFeedbackModal
          rideId={feedbackRideId}
          userId={userId}
          startedAt={feedbackStartedAt}
          onSubmit={handleFeedbackSubmit}
        />
      )}
    </div>
  )
}

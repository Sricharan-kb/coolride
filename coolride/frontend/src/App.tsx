import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import type { RidePoint } from './types/index'
import { LoginForm } from './components/Auth/LoginForm'
import { RegisterForm } from './components/Auth/RegisterForm'
import { RideMap } from './components/Map/RideMap'
import { RideControls } from './components/Ride/RideControls'
import { LiveStats } from './components/Ride/LiveStats'
import { WeatherWidget } from './components/Weather/WeatherWidget'
import { RideFeedbackModal } from './components/Ride/RideFeedbackModal'
import { RideTimeline } from './components/Ride/RideTimeline'
import { RideSummaryCard } from './components/Ride/RideSummaryCard'
import { RideHistory } from './components/Profile/RideHistory'
import { UserProfile } from './components/Profile/UserProfile'
import { useRideRecorder } from './hooks/useRideRecorder'

type Tab = 'map' | 'profile'
type ProfileView = 'profile' | 'rides'
type AuthView = 'login' | 'register'

export function App() {
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState<{ user: { id: string; email: string } } | null>(null)
  const [authView, setAuthView] = useState<AuthView>('login')
  const [activeTab, setActiveTab] = useState<Tab>('map')
  const [profileView, setProfileView] = useState<ProfileView>('profile')
  const [isDark, setIsDark] = useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  // For viewing past rides from history
  const [pastRide, setPastRide] = useState<{
    rideId: string
    points: RidePoint[]
    route: [number, number][]
  } | null>(null)

  // Post-ride summary card
  const [showSummary, setShowSummary] = useState(false)

  const userId = session?.user?.id ?? ''
  const recorder = useRideRecorder({ userId })

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

  const handleStart = useCallback(async () => {
    if (!session) return
    const ok = await recorder.start()
    if (ok) setActiveTab('map')
  }, [session, recorder])

  const handleFeedbackSubmit = useCallback(() => {
    recorder.completeFeedback()
    setShowSummary(true)
  }, [recorder])

  const handleViewDetails = useCallback(() => {
    setShowSummary(false)
  }, [])

  const handleCloseSummary = useCallback(() => {
    setShowSummary(false)
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
    setProfileView('profile')
    recorder.reset()
  }, [recorder])

  const handleSelectPastRide = useCallback(
    (rideId: string, points: RidePoint[], route: [number, number][]) => {
      setPastRide({ rideId, points, route })
      setActiveTab('map')
    },
    []
  )

  const handleClosePastRide = useCallback(() => {
    setPastRide(null)
    setActiveTab('profile')
    setProfileView('rides')
  }, [])

  const avgSpeedKmh =
    recorder.durationSeconds > 0
      ? (recorder.distanceKm / (recorder.durationSeconds / 3600))
      : 0

  if (authLoading) {
    return (
      <div className="h-[100dvh] bg-white dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="h-[100dvh] bg-white dark:bg-zinc-950 flex flex-col items-center justify-center px-4">
        {authView === 'login' ? (
          <LoginForm onSwitchToRegister={() => setAuthView('register')} />
        ) : (
          <RegisterForm onSwitchToLogin={() => setAuthView('login')} />
        )}
      </div>
    )
  }

  return (
    <div className="h-[100dvh] bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 flex flex-col">
      {/* Content area */}
      <div className="flex-1 min-h-0 relative">

        {/* MAP TAB */}
        {activeTab === 'map' && (
          <div className="absolute inset-0">
            {/* Mode: Viewing past ride */}
            {pastRide ? (
              <RideTimeline
                points={pastRide.points}
                route={pastRide.route}
                onClose={handleClosePastRide}
                title="Past Ride"
              />
            ) : /* Mode: Post-ride timeline */ recorder.showTimeline && recorder.timelinePoints && recorder.timelineRoute ? (
              <RideTimeline
                points={recorder.timelinePoints}
                route={recorder.timelineRoute}
                onClose={recorder.closeTimeline}
                title="Ride Summary"
              />
            ) : (
              <>
                {/* Map always visible */}
                <RideMap
                  currentPosition={recorder.position ? [recorder.position.lat, recorder.position.lng] : null}
                  route={recorder.route}
                  isRiding={recorder.rideState === 'recording'}
                />

                {/* Weather widget (top-right) */}
                <div className="absolute top-3 right-3 z-[1000]">
                  <WeatherWidget
                    temperature={recorder.weather?.temperature ?? null}
                    humidity={recorder.weather?.humidity ?? null}
                    feelsLike={recorder.weather?.feels_like ?? null}
                    description={recorder.weather?.description ?? null}
                    icon={recorder.weather?.icon ?? null}
                    error={recorder.weatherError}
                  />
                </div>

                {/* GPS Error (top-left) */}
                {recorder.geoError && (
                  <div className="absolute top-3 left-3 z-[1000] bg-white dark:bg-zinc-900 px-3 py-1 text-sm text-red-600 dark:text-red-400 rounded-full shadow">
                    {recorder.geoError}
                  </div>
                )}

                {/* Live stats (bottom, above controls) */}
                {recorder.rideState !== 'idle' && (
                  <div className="absolute bottom-20 left-0 right-0 z-[1000]">
                    <LiveStats
                      distance={recorder.distanceKm}
                      duration={recorder.durationSeconds}
                      currentSpeed={recorder.currentSpeed}
                      lastTemp={recorder.lastPoint?.temperature ?? null}
                      lastHumidity={recorder.lastPoint?.humidity ?? null}
                      lastLux={null}
                      isVisible
                    />
                  </div>
                )}

                {/* Ride controls (bottom) */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center z-[1000]">
                  <RideControls
                    rideState={recorder.rideState}
                    onStart={handleStart}
                    onPause={recorder.pause}
                    onResume={recorder.resume}
                    onStop={recorder.stop}
                  />
                </div>

                {/* Post-ride summary card */}
                {showSummary && (
                  <RideSummaryCard
                    distanceKm={recorder.distanceKm}
                    durationSec={recorder.durationSeconds}
                    avgSpeedKmh={avgSpeedKmh}
                    weatherSnapshot={recorder.weather}
                    onViewDetails={handleViewDetails}
                    onClose={handleCloseSummary}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="h-full overflow-y-auto">
            {profileView === 'rides' ? (
              <RideHistory
                userId={userId}
                refreshKey={recorder.ridesRefreshKey}
                activeRideId={recorder.rideId}
                onBack={() => setProfileView('profile')}
                onSelectRide={handleSelectPastRide}
              />
            ) : (
              <UserProfile
                userId={userId}
                email={session?.user?.email ?? ''}
                isDark={isDark}
                onToggleDarkMode={handleToggleDarkMode}
                onLogout={handleLogout}
                onViewRideHistory={() => setProfileView('rides')}
              />
            )}
          </div>
        )}

        {/* Feedback modal */}
        {recorder.showFeedback && recorder.feedbackRideId && (
          <RideFeedbackModal
            rideId={recorder.feedbackRideId}
            userId={userId}
            startedAt={recorder.feedbackStartedAt}
            onSubmit={handleFeedbackSubmit}
          />
        )}
      </div>

      {/* Bottom nav */}
      <nav className="flex-shrink-0 border-t border-gray-200 dark:border-zinc-800 flex h-14 bg-white dark:bg-zinc-950">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 flex items-center justify-center text-sm font-medium ${
            activeTab === 'map'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-gray-500 dark:text-zinc-400'
          }`}
        >
          Map
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex items-center justify-center text-sm font-medium ${
            activeTab === 'profile'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-gray-500 dark:text-zinc-400'
          }`}
        >
          Profile
        </button>
      </nav>
    </div>
  )
}

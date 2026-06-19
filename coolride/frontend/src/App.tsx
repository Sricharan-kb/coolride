import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import { LoginForm } from './components/Auth/LoginForm'
import { RegisterForm } from './components/Auth/RegisterForm'
import { RideMap } from './components/Map/RideMap'
import { RideControls } from './components/Ride/RideControls'
import { LiveStats } from './components/Ride/LiveStats'
import { WeatherWidget } from './components/Weather/WeatherWidget'
import { RideFeedbackModal } from './components/Ride/RideFeedbackModal'
import { RideTimeline } from './components/Ride/RideTimeline'
import { RideHistory } from './components/Profile/RideHistory'
import { UserProfile } from './components/Profile/UserProfile'
import { useRideRecorder } from './hooks/useRideRecorder'

type Tab = 'map' | 'ride' | 'profile'
type AuthView = 'login' | 'register'

export function App() {
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState<{ user: { id: string; email: string } } | null>(null)
  const [authView, setAuthView] = useState<AuthView>('login')
  const [activeTab, setActiveTab] = useState<Tab>('map')
  const [showRideHistory, setShowRideHistory] = useState(false)
  const [isDark, setIsDark] = useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

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
    setActiveTab('ride')
  }, [recorder])

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
    setShowRideHistory(false)
    recorder.reset()
  }, [recorder])

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
        {activeTab === 'map' && (
          <div className="absolute inset-0">
            <RideMap
              currentPosition={recorder.position ? [recorder.position.lat, recorder.position.lng] : null}
              route={recorder.route}
              isRiding={recorder.rideState === 'recording'}
            />
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
            <div className="absolute bottom-24 left-0 right-0 z-[1000]">
              <LiveStats
                distance={recorder.distanceKm}
                duration={recorder.durationSeconds}
                currentSpeed={recorder.currentSpeed}
                lastTemp={recorder.lastPoint?.temperature ?? null}
                lastHumidity={recorder.lastPoint?.humidity ?? null}
                lastLux={recorder.lastPoint?.lux ?? null}
                isVisible={recorder.rideState !== 'idle'}
              />
            </div>
            <div className="absolute bottom-16 left-0 right-0 flex justify-center z-[1000]">
              <RideControls
                rideState={recorder.rideState}
                onStart={handleStart}
                onPause={recorder.pause}
                onResume={recorder.resume}
                onStop={recorder.stop}
              />
            </div>
            {recorder.geoError && (
              <div className="absolute top-3 left-3 z-[1000] bg-white dark:bg-zinc-900 px-3 py-1 text-sm text-red-600 dark:text-red-400">
                {recorder.geoError}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ride' && (
          <div className="h-full overflow-y-auto p-4">
            {recorder.showTimeline && recorder.timelinePoints && recorder.timelineRoute ? (
              <div className="h-full">
                <RideTimeline points={recorder.timelinePoints} route={recorder.timelineRoute} />
              </div>
            ) : recorder.rideState !== 'idle' ? (
              <div>
                <h2 className="text-lg font-medium text-gray-900 dark:text-zinc-100 mb-4">
                  Current Ride
                </h2>
                <LiveStats
                  distance={recorder.distanceKm}
                  duration={recorder.durationSeconds}
                  currentSpeed={recorder.currentSpeed}
                  lastTemp={recorder.lastPoint?.temperature ?? null}
                  lastHumidity={recorder.lastPoint?.humidity ?? null}
                  lastLux={recorder.lastPoint?.lux ?? null}
                  isVisible
                />
                {recorder.lux != null && (
                  <div className="mt-3 text-sm text-gray-500 dark:text-zinc-400">
                    Light: {recorder.lux.toFixed(0)} lux
                  </div>
                )}
                {recorder.acceleration && (
                  <div className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                    Accel: {recorder.acceleration.x?.toFixed(1) ?? '—'},{' '}
                    {recorder.acceleration.y?.toFixed(1) ?? '—'}, {recorder.acceleration.z?.toFixed(1) ?? '—'} m/s²
                  </div>
                )}
                <div className="mt-6 flex justify-center">
                  <RideControls
                    rideState={recorder.rideState}
                    onStart={handleStart}
                    onPause={recorder.pause}
                    onResume={recorder.resume}
                    onStop={recorder.stop}
                  />
                </div>
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
            {recorder.showTimeline && recorder.timelinePoints && recorder.timelineRoute ? (
              <div className="h-full">
                <button
                  onClick={recorder.closeTimeline}
                  className="px-4 py-2 text-sm text-gray-500 dark:text-zinc-400 underline"
                >
                  Back to history
                </button>
                <RideTimeline points={recorder.timelinePoints} route={recorder.timelineRoute} />
              </div>
            ) : showRideHistory ? (
              <RideHistory
                userId={userId}
                refreshKey={recorder.ridesRefreshKey}
                onBack={() => setShowRideHistory(false)}
              />
            ) : (
              <UserProfile
                userId={userId}
                email={session?.user?.email ?? ''}
                isDark={isDark}
                onToggleDarkMode={handleToggleDarkMode}
                onLogout={handleLogout}
                onViewRideHistory={() => setShowRideHistory(true)}
              />
            )}
          </div>
        )}

        {recorder.showFeedback && recorder.feedbackRideId && (
          <RideFeedbackModal
            rideId={recorder.feedbackRideId}
            userId={userId}
            startedAt={recorder.feedbackStartedAt}
            onSubmit={handleFeedbackSubmit}
          />
        )}
      </div>

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
    </div>
  )
}

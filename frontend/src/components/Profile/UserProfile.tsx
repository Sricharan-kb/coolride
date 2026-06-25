import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface UserProfileProps {
  userId: string
  email: string
  isDark: boolean
  onToggleDarkMode: () => void
  onLogout: () => void
  onViewRideHistory: () => void
}

function getInitial(email: string): string {
  const username = email.split('@')[0] || ''
  return username.charAt(0).toUpperCase()
}

export function UserProfile({
  userId,
  email,
  isDark,
  onToggleDarkMode,
  onLogout,
  onViewRideHistory,
}: UserProfileProps) {
  const [totalRides, setTotalRides] = useState(0)
  const [totalDistanceKm, setTotalDistanceKm] = useState(0)
  const [totalHours, setTotalHours] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('rides')
          .select('distance_m, duration_sec')
          .eq('user_id', userId)

        if (cancelled || error || !data) return

        const rides = data.length
        const distKm = data.reduce((s, r) => s + ((r.distance_m as number) || 0), 0) / 1000
        const hrs = data.reduce((s, r) => s + ((r.duration_sec as number) || 0), 0) / 3600

        setTotalRides(rides)
        setTotalDistanceKm(distKm)
        setTotalHours(hrs)
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStats()
    return () => { cancelled = true }
  }, [userId])

  const avgDistanceKm = totalRides > 0 ? totalDistanceKm / totalRides : 0
  const avgDurationHrs = totalRides > 0 ? totalHours / totalRides : 0

  return (
    <div className="p-4">
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-full bg-emerald-600 dark:bg-emerald-400 flex items-center justify-center mb-3">
          <span className="text-2xl font-bold text-white dark:text-zinc-950">
            {getInitial(email)}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-zinc-400">{email}</p>
      </div>

      <div className="mb-8">
        <h3 className="text-sm font-medium text-gray-500 dark:text-zinc-400 mb-3">
          Statistics
        </h3>
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-6 h-6 border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-gray-200 dark:border-zinc-800 px-3 py-2">
              <div className="text-lg font-medium text-gray-900 dark:text-zinc-100">
                {totalRides}
              </div>
              <div className="text-xs text-gray-500 dark:text-zinc-400">Total Rides</div>
            </div>
            <div className="border border-gray-200 dark:border-zinc-800 px-3 py-2">
              <div className="text-lg font-medium text-gray-900 dark:text-zinc-100">
                {totalDistanceKm.toFixed(1)} km
              </div>
              <div className="text-xs text-gray-500 dark:text-zinc-400">Total Distance</div>
            </div>
            <div className="border border-gray-200 dark:border-zinc-800 px-3 py-2">
              <div className="text-lg font-medium text-gray-900 dark:text-zinc-100">
                {totalHours.toFixed(1)} hrs
              </div>
              <div className="text-xs text-gray-500 dark:text-zinc-400">Total Time</div>
            </div>
            <div className="border border-gray-200 dark:border-zinc-800 px-3 py-2">
              <div className="text-lg font-medium text-gray-900 dark:text-zinc-100">
                {avgDistanceKm.toFixed(1)} km
              </div>
              <div className="text-xs text-gray-500 dark:text-zinc-400">Avg Distance</div>
            </div>
            <div className="border border-gray-200 dark:border-zinc-800 px-3 py-2 col-span-2">
              <div className="text-lg font-medium text-gray-900 dark:text-zinc-100">
                {avgDurationHrs.toFixed(1)} hrs
              </div>
              <div className="text-xs text-gray-500 dark:text-zinc-400">Avg Duration</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-900 dark:text-zinc-100">Dark mode</span>
          <button
            onClick={onToggleDarkMode}
            className="relative w-12 h-6 rounded-full bg-gray-200 dark:bg-zinc-700 transition-colors duration-300"
            aria-label="Toggle dark mode"
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-zinc-900 shadow flex items-center justify-center transition-transform duration-300 ${
                isDark ? 'translate-x-6' : 'translate-x-0'
              }`}
            >
              <svg
                className="w-3 h-3 transition-transform duration-300"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                {isDark ? (
                  <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z" />
                ) : (
                  <path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z" />
                )}
              </svg>
            </span>
          </button>
        </div>

        <button
          onClick={onViewRideHistory}
          className="w-full text-left border border-gray-200 dark:border-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
        >
          My Rides
        </button>

        <button
          onClick={onLogout}
          className="w-full border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
        >
          Log Out
        </button>
      </div>
    </div>
  )
}

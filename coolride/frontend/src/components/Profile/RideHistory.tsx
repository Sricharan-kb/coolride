import { useState, useEffect } from 'react'
import type { Ride, RidePoint } from '../../types/index'
import { supabase } from '../../lib/supabase'
import { RideTimeline } from '../Ride/RideTimeline'

interface RideHistoryProps {
  userId: string
  isDark: boolean
  onToggleDarkMode: () => void
  onLogout: () => void
  refreshKey: number
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTimeRange(start: string, end: string | null): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (!end) return fmt(start)
  return `${fmt(start)} - ${fmt(end)}`
}

function formatDistanceKm(meters: number | null): string {
  if (meters === null) return '—'
  return `${(meters / 1000).toFixed(1)} km`
}

function formatDurationMin(seconds: number | null): string {
  if (seconds === null) return '—'
  const mins = Math.round(seconds / 60)
  return `${mins} min`
}

export function RideHistory({
  userId,
  isDark,
  onToggleDarkMode,
  onLogout,
  refreshKey,
}: RideHistoryProps) {
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null)
  const [selectedPoints, setSelectedPoints] = useState<RidePoint[] | null>(null)
  const [pointsLoading, setPointsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const fetchRides = async () => {
      try {
        const { data, error } = await supabase
          .from('rides')
          .select('*')
          .eq('user_id', userId)
          .order('started_at', { ascending: false })

        if (cancelled) return
        if (!error && data) {
          setRides(
            data.filter(
              (r): r is Ride =>
                typeof r.id === 'string' &&
                typeof r.user_id === 'string' &&
                typeof r.started_at === 'string'
            )
          )
        }
      } catch {
        if (!cancelled) {
          setRides([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchRides()

    return () => {
      cancelled = true
    }
  }, [userId, refreshKey])

  const handleSelectRide = async (rideId: string) => {
    setSelectedRideId(rideId)
    setSelectedPoints(null)
    setPointsLoading(true)

    try {
      const { data, error } = await supabase
        .from('ride_points')
        .select('*')
        .eq('ride_id', rideId)
        .order('point_index', { ascending: true })

      if (error) {
        setSelectedPoints([])
        return
      }
      if (data) {
        setSelectedPoints(
          data.filter(
            (p): p is RidePoint =>
              typeof p.ride_id === 'string' &&
              typeof p.point_index === 'number' &&
              p.location != null
          )
        )
      }
    } catch {
      setSelectedPoints([])
    } finally {
      setPointsLoading(false)
    }
  }

  const handleBack = () => {
    setSelectedRideId(null)
    setSelectedPoints(null)
  }

  if (selectedRideId && selectedPoints) {
    const ride = rides.find((r) => r.id === selectedRideId)
    const routeCoords: [number, number][] = selectedPoints.map((p) => [
      p.location.lat,
      p.location.lng,
    ])

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
          <button
            onClick={handleBack}
            className="text-sm text-gray-500 dark:text-zinc-400 underline"
          >
            Back
          </button>
          <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
            {ride ? formatDate(ride.started_at) : ''}
          </span>
          <span className="w-10" />
        </div>
        <div className="flex-1">
          <RideTimeline points={selectedPoints} route={routeCoords} />
        </div>
      </div>
    )
  }

  if (pointsLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-zinc-100">
          Rides
        </h2>
        <div className="flex items-center gap-3">
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
          <button
            onClick={onLogout}
            className="text-sm text-red-600 dark:text-red-400 underline"
          >
            Log out
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && rides.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          No rides yet. Start your first ride!
        </p>
      )}

      {!loading && rides.length > 0 && (
        <div className="flex flex-col gap-3">
          {rides.map((ride) => (
            <button
              key={ride.id}
              onClick={() => handleSelectRide(ride.id)}
              className="text-left border-b border-gray-200 dark:border-zinc-800 pb-3"
            >
              <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                {formatDate(ride.started_at)}
              </div>
              <div className="text-xs text-gray-500 dark:text-zinc-400">
                {formatTimeRange(ride.started_at, ride.ended_at)}
              </div>
              <div className="text-xs text-gray-500 dark:text-zinc-400">
                {formatDistanceKm(ride.distance_m)} ·{' '}
                {formatDurationMin(ride.duration_sec)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

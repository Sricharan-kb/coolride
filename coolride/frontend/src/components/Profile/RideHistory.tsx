import { useState, useEffect } from 'react'
import type { Ride, RidePoint } from '../../types/index'
import { supabase } from '../../lib/supabase'
import { RideTimeline } from '../Ride/RideTimeline'

interface RideHistoryProps {
  userId: string
  refreshKey: number
  onBack: () => void
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
  refreshKey,
  onBack,
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
        <button
          onClick={onBack}
          className="text-sm text-gray-500 dark:text-zinc-400 underline"
        >
          Back
        </button>
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

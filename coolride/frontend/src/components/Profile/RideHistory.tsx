import { useState, useEffect } from 'react'
import type { Ride, RidePoint } from '../../types/index'
import { supabase } from '../../lib/supabase'

interface RideHistoryProps {
  userId: string
  refreshKey: number
  activeRideId: string | null
  onBack: () => void
  onSelectRide: (rideId: string, points: RidePoint[], route: [number, number][]) => void
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
  if (!end) return `${fmt(start)} — ongoing`
  return `${fmt(start)} — ${fmt(end)}`
}

function formatDistanceKm(meters: number | null | undefined): string {
  if (meters == null) return '—'
  return `${(meters / 1000).toFixed(1)} km`
}

function formatDurationMin(seconds: number | null): string {
  if (seconds == null) return '—'
  const mins = Math.round(seconds / 60)
  return `${mins} min`
}

// Supabase PostGIS returns location as GeoJSON: { type: "Point", coordinates: [lng, lat] }
interface GeoJSONPoint {
  type: 'Point'
  coordinates: [number, number]
}

function parseLocation(raw: unknown): { lat: number; lng: number } | null {
  const geo = raw as GeoJSONPoint | undefined
  if (
    geo &&
    geo.type === 'Point' &&
    Array.isArray(geo.coordinates) &&
    geo.coordinates.length === 2 &&
    typeof geo.coordinates[0] === 'number' &&
    typeof geo.coordinates[1] === 'number'
  ) {
    return { lat: geo.coordinates[1], lng: geo.coordinates[0] }
  }
  const direct = raw as { lat?: number; lng?: number } | undefined
  if (direct && typeof direct.lat === 'number' && typeof direct.lng === 'number') {
    return { lat: direct.lat, lng: direct.lng }
  }
  return null
}

export function RideHistory({
  userId,
  refreshKey,
  activeRideId,
  onBack,
  onSelectRide,
}: RideHistoryProps) {
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

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
        if (!cancelled) setRides([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchRides()
    return () => { cancelled = true }
  }, [userId, refreshKey])

  const handleSelectRide = async (rideId: string) => {
    try {
      const { data, error } = await supabase
        .from('ride_points')
        .select('*')
        .eq('ride_id', rideId)
        .order('point_index', { ascending: true })

      if (error || !data) return

      const transformed: RidePoint[] = data
        .map((p): RidePoint | null => {
          const loc = parseLocation(p.location)
          if (!loc || typeof p.ride_id !== 'string' || typeof p.point_index !== 'number') {
            return null
          }
          return {
            id: String(p.id ?? ''),
            ride_id: p.ride_id,
            point_index: p.point_index,
            location: loc,
            recorded_at: p.recorded_at,
            temperature: typeof p.temperature === 'number' ? p.temperature : null,
            humidity: typeof p.humidity === 'number' ? p.humidity : null,
            feels_like: typeof p.feels_like === 'number' ? p.feels_like : null,
            speed_kmh: typeof p.speed_kmh === 'number' ? p.speed_kmh : null,
            lux: typeof p.lux === 'number' ? p.lux : null,
            accel_x: typeof p.accel_x === 'number' ? p.accel_x : null,
            accel_y: typeof p.accel_y === 'number' ? p.accel_y : null,
            accel_z: typeof p.accel_z === 'number' ? p.accel_z : null,
          }
        })
        .filter((p): p is RidePoint => p !== null)

      const routeCoords: [number, number][] = transformed
        .map((p) => [p.location.lat, p.location.lng] as [number, number])
        .filter(([lat, lng]) => typeof lat === 'number' && typeof lng === 'number')

      onSelectRide(rideId, transformed, routeCoords)
    } catch {
      // ignore
    }
  }

  const handleDelete = async (rideId: string) => {
    try {
      await supabase.from('ride_points').delete().eq('ride_id', rideId)
      await supabase.from('rides').delete().eq('id', rideId)
      setRides((prev) => prev.filter((r) => r.id !== rideId))
      setDeleteConfirmId(null)
    } catch {
      // ignore
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <h2 className="text-lg font-medium text-gray-900 dark:text-zinc-100">
          My Rides
        </h2>
        <button
          onClick={onBack}
          className="text-sm text-gray-500 dark:text-zinc-400 underline"
        >
          Back
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && rides.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-sm text-gray-500 dark:text-zinc-400 gap-3">
            <p>No rides yet. Start your first ride!</p>
            <button
              onClick={onBack}
              className="text-emerald-600 dark:text-emerald-400 underline"
            >
              Go to Map
            </button>
          </div>
        )}

        {!loading && rides.length > 0 && (
          <div className="flex flex-col gap-3">
            {rides.map((ride) => {
              const isActive = ride.id === activeRideId && !ride.ended_at
              const isDeleting = deleteConfirmId === ride.id

              return (
                <div
                  key={ride.id}
                  className="relative border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => handleSelectRide(ride.id)}
                    className="w-full text-left p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-zinc-100">
                        {formatDate(ride.started_at)}
                      </span>
                      {isActive && (
                        <span className="text-xs font-medium text-white bg-emerald-500 px-2 py-0.5 rounded-full">
                          LIVE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-zinc-400">
                      {formatTimeRange(ride.started_at, ride.ended_at)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                      {formatDistanceKm(ride.distance_m)} ·{' '}
                      {formatDurationMin(ride.duration_sec)}
                    </div>
                  </button>

                  {/* Delete button */}
                  {!isActive && (
                    <div className="px-3 pb-2">
                      {isDeleting ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-600 dark:text-zinc-300">Delete this ride?</span>
                          <button
                            onClick={() => handleDelete(ride.id)}
                            className="text-red-600 dark:text-red-400 underline"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-gray-500 dark:text-zinc-400 underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(ride.id)}
                          className="text-xs text-red-500 dark:text-red-400 hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

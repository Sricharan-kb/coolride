import { useState, useEffect } from 'react'
import type { Ride, RidePoint } from '../../types/index'
import { supabase } from '../../lib/supabase'
import { parseLocation } from '../../lib/geo'
import { downloadGPX } from '../../lib/gpx'

interface RideHistoryProps {
  userId: string
  refreshKey: number
  activeRideId: string | null
  isAdmin: boolean
  onBack: () => void
  onSelectRide: (rideId: string, points: RidePoint[], route: [number, number][], sourceTab?: 'profile' | 'explore') => void
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

export function RideHistory({
  userId,
  refreshKey,
  activeRideId,
  isAdmin,
  onBack,
  onSelectRide,
}: RideHistoryProps) {
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const fetchRides = async () => {
      try {
        setError(null)
        let query = supabase.from('rides').select('*').order('started_at', { ascending: false })
        if (!isAdmin) {
          query = query.eq('user_id', userId)
        }
        const { data, error } = await query

        if (cancelled) return
        if (error) {
          setError('Failed to load rides: ' + error.message)
          setRides([])
        } else if (data) {
          setRides(
            data.filter(
              (r): r is Ride =>
                typeof r.id === 'string' &&
                typeof r.user_id === 'string' &&
                typeof r.started_at === 'string'
            )
          )
        }
      } catch (err) {
        console.error('Failed to fetch rides:', err)
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
      setError(null)
      const { data, error } = await supabase
        .from('ride_points')
        .select('*')
        .eq('ride_id', rideId)
        .order('point_index', { ascending: true })

      if (error) {
        setError('Failed to load ride points')
        return
      }

      const rows = data ?? []

      const transformed: RidePoint[] = rows
        .map((p): RidePoint | null => {
          const loc = parseLocation(p.location)
          if (!loc || typeof p.ride_id !== 'string' || typeof p.point_index !== 'number' || typeof p.recorded_at !== 'string') {
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

      onSelectRide(rideId, transformed, routeCoords, 'profile')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Failed to load ride points:', err)
      setError('Failed to load ride points: ' + msg)
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

  const handleExportRide = async (rideId: string) => {
    const { data: rows } = await supabase
      .from('ride_points')
      .select('*')
      .eq('ride_id', rideId)
      .order('point_index', { ascending: true })

    if (!rows || rows.length === 0) return

    const points: RidePoint[] = rows
      .map((p): RidePoint | null => {
        const loc = parseLocation(p.location)
        if (!loc) return null
        return {
          id: String(p.id ?? ''),
          ride_id: p.ride_id,
          point_index: p.point_index as number,
          location: loc,
          recorded_at: p.recorded_at as string,
          temperature: null,
          humidity: null,
          feels_like: null,
          speed_kmh: null,
          lux: null,
          accel_x: null,
          accel_y: null,
          accel_z: null,
        }
      })
      .filter((p): p is RidePoint => p !== null)

    const ride = rides.find((r) => r.id === rideId)
    const name = ride ? formatDate(ride.started_at) : 'ride'
    downloadGPX(points, name)
  }

  const handleShareRide = (ride: Ride) => {
    const dist = formatDistanceKm(ride.distance_m)
    const dur = formatDurationMin(ride.duration_sec)
    const temp = ride.weather_snapshot?.temperature
    const text = temp
      ? `I rode ${dist} in ${dur} at ${temp}°C on coolride`
      : `I rode ${dist} in ${dur} on coolride`

    if (navigator.share) {
      navigator.share({ title: 'coolride — My Ride', text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).catch(() => {})
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
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-500 dark:text-red-400 underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

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
              const isOwnRide = (ride as Ride & { user_id: string }).user_id === userId

              return (
                <div
                  key={ride.id}
                  className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => handleSelectRide(ride.id)}
                    className="w-full text-left p-3.5"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                        {formatDate(ride.started_at)}
                      </span>
                      {isActive && (
                        <span className="text-xs font-medium text-white bg-emerald-500 px-2 py-0.5 rounded-full">
                          LIVE
                        </span>
                      )}
                      {(ride as Ride & { is_public: boolean }).is_public && (
                        <span className="text-xs text-gray-500 dark:text-zinc-400 border border-gray-300 dark:border-zinc-600 px-1.5 py-0.5 rounded-full">
                          public
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-zinc-400">
                      {formatTimeRange(ride.started_at, ride.ended_at)}
                    </div>
                    <div className="text-sm font-medium text-gray-800 dark:text-zinc-200 mt-1">
                      {formatDistanceKm(ride.distance_m)} · {formatDurationMin(ride.duration_sec)}
                    </div>
                    {ride.weather_snapshot && (
                      <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                        {ride.weather_snapshot.temperature}°C · {ride.weather_snapshot.description}
                      </div>
                    )}
                  </button>

                  {!isActive && (
                    <div className="flex border-t border-gray-200 dark:border-zinc-700 divide-x divide-gray-200 dark:divide-zinc-700">
                      <button
                        onClick={() => handleSelectRide(ride.id)}
                        className="flex-1 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-1"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        View
                      </button>
                      <button
                        onClick={() => handleExportRide(ride.id)}
                        className="flex-1 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-1"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Export
                      </button>
                      <button
                        onClick={() => handleShareRide(ride)}
                        className="flex-1 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center gap-1"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="18" cy="5" r="3" />
                          <circle cx="6" cy="12" r="3" />
                          <circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                        Share
                      </button>
                      {isOwnRide && (
                        isDeleting ? (
                          <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs">
                            <button
                              onClick={() => handleDelete(ride.id)}
                              className="text-red-600 dark:text-red-400 font-medium underline"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-gray-500 dark:text-zinc-400 underline"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(ride.id)}
                            className="flex-1 py-2.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 flex items-center justify-center gap-1"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Delete
                          </button>
                        )
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

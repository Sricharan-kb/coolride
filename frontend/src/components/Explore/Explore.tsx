import { useState, useEffect } from 'react'
import type { Ride, RidePoint } from '../../types/index'
import { supabase } from '../../lib/supabase'
import { parseLocation } from '../../lib/geo'

interface ExploreProps {
  userId: string
  onSelectRide: (rideId: string, points: RidePoint[], route: [number, number][], rideName: string, sourceTab?: 'profile' | 'explore') => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
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

function getGoogleMapsUrl(firstLat: number, firstLng: number, lastLat: number, lastLng: number): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${firstLat},${firstLng}&destination=${lastLat},${lastLng}`
}

export function Explore({ userId, onSelectRide }: ExploreProps) {
  const [rides, setRides] = useState<(Ride & { star_count: number; user_starred: boolean })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    const fetchPublicRides = async () => {
      try {
        const { data, error } = await supabase
          .from('rides')
          .select('*')
          .eq('is_public', true)
          .order('started_at', { ascending: false })
          .limit(50)

        if (cancelled) return
        if (!error && data) {
          const rideIds = data.map((r) => r.id)

          // Fetch star counts
          const starCounts: Record<string, number> = {}
          if (rideIds.length > 0) {
            const { data: stars } = await supabase
              .from('ride_stars')
              .select('ride_id')
              .in('ride_id', rideIds)

            if (stars) {
              for (const s of stars) {
                starCounts[s.ride_id] = (starCounts[s.ride_id] || 0) + 1
              }
            }
          }

          // Fetch user's own stars
          const userStarred: Set<string> = new Set()
          if (rideIds.length > 0) {
            const { data: myStars } = await supabase
              .from('ride_stars')
              .select('ride_id')
              .eq('user_id', userId)
              .in('ride_id', rideIds)

            if (myStars) {
              for (const s of myStars) {
                userStarred.add(s.ride_id)
              }
            }
          }

          setRides(
            data
              .filter(
                (r): r is Ride =>
                  typeof r.id === 'string' &&
                  typeof r.user_id === 'string' &&
                  typeof r.started_at === 'string'
              )
              .map((r) => ({
                ...r,
                star_count: starCounts[r.id] || 0,
                user_starred: userStarred.has(r.id),
              }))
          )
        }
      } catch {
        if (!cancelled) setRides([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPublicRides()
    return () => { cancelled = true }
  }, [userId])

  const handleSelectRide = async (ride: Ride & { star_count: number; user_starred: boolean }) => {
    setError(null)
    try {
      const { data, error } = await supabase
        .from('ride_points')
        .select('*')
        .eq('ride_id', ride.id)
        .order('point_index', { ascending: true })

      if (error) {
        setError('Failed to load ride data')
        return
      }

      const rows = data ?? []

      const points = rows
        .map((p) => {
          const loc = parseLocation(p.location)
          if (!loc) return null

          return {
            id: String(p.id ?? ''),
            ride_id: p.ride_id,
            point_index: p.point_index as number,
            location: { lat: loc.lat, lng: loc.lng },
            recorded_at: p.recorded_at as string,
            temperature: typeof p.temperature === 'number' ? p.temperature : null,
            humidity: typeof p.humidity === 'number' ? p.humidity : null,
            feels_like: typeof p.feels_like === 'number' ? p.feels_like : null,
            speed_kmh: typeof p.speed_kmh === 'number' ? p.speed_kmh : null,
            lux: null,
            accel_x: null,
            accel_y: null,
            accel_z: null,
          } as RidePoint
        })
        .filter((p): p is RidePoint => p !== null)

      const route = points
        .map((p) => [p.location.lat, p.location.lng] as [number, number])
        .filter(([lat, lng]) => typeof lat === 'number' && typeof lng === 'number')

      const rideDate = formatDate(ride.started_at)
      onSelectRide(ride.id, points, route, rideDate, 'explore')
    } catch {
      setError('Something went wrong')
    }
  }

  const handleToggleStar = async (rideId: string, currentlyStarred: boolean) => {
    if (currentlyStarred) {
      await supabase.from('ride_stars').delete().eq('ride_id', rideId).eq('user_id', userId)
      setRides((prev) =>
        prev.map((r) =>
          r.id === rideId
            ? { ...r, star_count: Math.max(0, r.star_count - 1), user_starred: false }
            : r
        )
      )
    } else {
      const { error } = await supabase.from('ride_stars').insert({ ride_id: rideId, user_id: userId })
      if (error) return
      setRides((prev) =>
        prev.map((r) =>
          r.id === rideId
            ? { ...r, star_count: r.star_count + 1, user_starred: true }
            : r
        )
      )
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <h2 className="text-lg font-medium text-gray-900 dark:text-zinc-100">
          Explore
        </h2>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
          Public rides from the community
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-emerald-600 dark:border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="mb-3 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {!loading && rides.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-zinc-400 text-center mt-8">
            No public rides yet. Start recording to share yours!
          </p>
        )}

        {!loading && rides.length > 0 && (
          <div className="flex flex-col gap-3">
            {rides.map((ride) => (
              <div
                key={ride.id}
                className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => handleSelectRide(ride)}
                  className="w-full text-left p-3.5"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
                      {formatDate(ride.started_at)}
                    </span>
                    {ride.user_id === userId && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Your ride</span>
                    )}
                  </div>
                  <div className="text-sm font-medium text-gray-800 dark:text-zinc-200">
                    {formatDistanceKm(ride.distance_m)} · {formatDurationMin(ride.duration_sec)}
                  </div>
                  {ride.weather_snapshot && (
                    <div className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                      {ride.weather_snapshot.temperature}°C · {ride.weather_snapshot.description}
                    </div>
                  )}
                </button>

                <div className="flex items-center border-t border-gray-200 dark:border-zinc-700 divide-x divide-gray-200 dark:divide-zinc-700">
                  <button
                    onClick={() => handleToggleStar(ride.id, ride.user_starred)}
                    className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1 ${
                      ride.user_starred
                        ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950'
                        : 'text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={ride.user_starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    {ride.star_count || 0}
                  </button>

                  {ride.sensor_data?.shade_profile && (
                    <span className="flex-1 py-2.5 text-xs text-gray-500 dark:text-zinc-400 flex items-center justify-center capitalize">
                      {ride.sensor_data.shade_profile.replace(/_/g, ' ')}
                    </span>
                  )}

                  <a
                    href={ride.start_lat != null && ride.start_lng != null
                      ? getGoogleMapsUrl(ride.start_lat, ride.start_lng, ride.end_lat ?? ride.start_lat, ride.end_lng ?? ride.start_lng)
                      : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1 ${
                      ride.start_lat != null
                        ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950'
                        : 'text-gray-400 dark:text-zinc-500 cursor-default'
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                    Route
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

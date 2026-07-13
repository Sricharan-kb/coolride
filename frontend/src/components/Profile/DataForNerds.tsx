import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { parseLocation } from '../../lib/geo'
import type { Ride, RidePoint } from '../../types/index'
import { AccelGraph } from '../Ride/AccelGraph'
import { RoughPointMarkers } from '../Ride/RoughPointMarkers'
import { ChennaiHeatmap } from '../Explore/ChennaiHeatmap'

interface DataForNerdsProps {
  onBack: () => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DataForNerds({ onBack }: DataForNerdsProps) {
  const [rides, setRides] = useState<(Ride & { email?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null)
  const [points, setPoints] = useState<RidePoint[] | null>(null)
  const [pointsLoading, setPointsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const fetchRides = async () => {
      try {
        const { data } = await supabase
          .from('rides')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(100)

        if (cancelled || !data) return

        const withEmails: (Ride & { email?: string })[] = []

        for (const r of data) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', r.user_id)
            .maybeSingle()
          withEmails.push({ ...r, email: profile?.email ?? undefined })
        }

        setRides(withEmails)
      } catch {
        if (!cancelled) setRides([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchRides()
    return () => { cancelled = true }
  }, [])

  const handleSelectRide = useCallback(async (rideId: string) => {
    setSelectedRideId(rideId)
    setPoints(null)
    setPointsLoading(true)

    try {
      const { data } = await supabase
        .from('ride_points')
        .select('*')
        .eq('ride_id', rideId)
        .order('point_index', { ascending: true })

      if (!data) {
        setPoints([])
        return
      }

      const transformed: RidePoint[] = data
        .map((p): RidePoint | null => {
          const loc = parseLocation(p.location)
          if (!loc || typeof p.ride_id !== 'string' || typeof p.recorded_at !== 'string') return null
          return {
            id: String(p.id ?? ''),
            ride_id: p.ride_id,
            point_index: (p as { point_index: number }).point_index ?? 0,
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

      setPoints(transformed)
    } catch {
      setPoints([])
    } finally {
      setPointsLoading(false)
    }
  }, [])

  const hasAccel = points != null && points.some((p) => p.accel_x != null)

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <h2 className="text-lg font-medium text-gray-900 dark:text-zinc-100">
          Data for Nerds
        </h2>
        <button
          onClick={onBack}
          className="text-sm text-gray-500 dark:text-zinc-400 underline"
        >
          Back
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-purple-600 dark:border-purple-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Ride picker */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">
                Select a ride to view accelerometer data
              </label>
              <select
                value={selectedRideId ?? ''}
                onChange={(e) => {
                  const id = e.target.value
                  if (id) handleSelectRide(id)
                  else {
                    setSelectedRideId(null)
                    setPoints(null)
                  }
                }}
                className="w-full border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-3 py-2 text-sm outline-none focus:border-purple-600 dark:focus:border-purple-400"
              >
                <option value="">-- choose a ride --</option>
                {rides.map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatDate(r.started_at)}
                    {r.email ? ` — ${r.email}` : ''}
                    {' '}({r.distance_m != null ? (r.distance_m / 1000).toFixed(1) + 'km' : '—'})
                  </option>
                ))}
              </select>
            </div>

            {/* Loading */}
            {pointsLoading && (
              <div className="flex items-center justify-center h-20">
                <div className="w-5 h-5 border-2 border-purple-600 dark:border-purple-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Ride data */}
            {!pointsLoading && points != null && (
              <>
                {!hasAccel && (
                  <div className="text-sm text-gray-500 dark:text-zinc-400 text-center py-8">
                    No accelerometer data for this ride. Record on a phone with motion sensors.
                  </div>
                )}

                {hasAccel && (
                  <div className="space-y-3">
                    <AccelGraph points={points} />
                    <RoughPointMarkers
                      points={points}
                      rideName={formatDate(
                        rides.find((r) => r.id === selectedRideId)?.started_at ?? '',
                      )}
                    />
                  </div>
                )}
              </>
            )}

            {/* Heatmap */}
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-zinc-700">
              <h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                City-wide heatmap data
              </h3>
              <ChennaiHeatmap visible />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

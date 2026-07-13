import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { parseLocation } from '../../lib/geo'
import { findJerkPoints } from '../../lib/ride-quality'
import type { RidePoint } from '../../types/index'

interface ChennaiHeatmapProps {
  visible: boolean
}

export function ChennaiHeatmap({ visible }: ChennaiHeatmapProps) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!visible || ready) return

    let cancelled = false
    setLoading(true)

    const fetchData = async () => {
      try {
        const { data } = await supabase
          .from('rides')
          .select('id')
          .eq('is_public', true)
          .order('started_at', { ascending: false })
          .limit(80)

        if (cancelled || !data) return

        const allPoints: RidePoint[] = []

        for (const ride of data) {
          const { data: pts } = await supabase
            .from('ride_points')
            .select('point_index, recorded_at, location, accel_x, accel_y, accel_z')
            .eq('ride_id', ride.id)
            .not('accel_x', 'is', null)
            .order('point_index', { ascending: true })

          if (pts) {
            for (const p of pts) {
              const loc = parseLocation(p.location)
              if (!loc) continue
              allPoints.push({
                id: '',
                ride_id: ride.id,
                point_index: (p as { point_index: number }).point_index,
                location: loc,
                recorded_at: p.recorded_at,
                temperature: null,
                humidity: null,
                feels_like: null,
                speed_kmh: null,
                lux: null,
                accel_x: p.accel_x ?? null,
                accel_y: p.accel_y ?? null,
                accel_z: p.accel_z ?? null,
              })
            }
          }
        }

        const rough = findJerkPoints(allPoints, 1.0)
        setCount(rough.length)
      } catch {
        if (!cancelled) setCount(0)
      } finally {
        if (!cancelled) {
          setLoading(false)
          setReady(true)
        }
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [visible, ready])

  if (!visible) return null

  return (
    <div className="px-4 py-2 border-b border-gray-200 dark:border-zinc-700 bg-orange-50/50 dark:bg-orange-950/20">
      {loading ? (
        <div className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          Analyzing road quality data...
        </div>
      ) : (
        <div className="text-xs">
          <span className="text-gray-600 dark:text-zinc-300 font-medium">
            Road quality heatmap:{' '}
          </span>
          <span className="text-gray-900 dark:text-zinc-100">
            {count} rough patches detected
          </span>
          <span className="text-gray-500 dark:text-zinc-400 ml-1">
            across recent public rides
          </span>
          {count > 0 && (
            <span className="text-gray-400 dark:text-zinc-500 ml-1">
              (map overlay coming soon)
            </span>
          )}
        </div>
      )}
    </div>
  )
}

import { useMemo } from 'react'
import type { RidePoint } from '../../types/index'
import { findJerkPoints, exportJerkCSV } from '../../lib/ride-quality'

interface RoughPointMarkersProps {
  points: RidePoint[]
  rideName?: string
}

const TOP_N = 5

export function RoughPointMarkers({ points, rideName = 'ride' }: RoughPointMarkersProps) {
  const jerkPoints = useMemo(
    () => findJerkPoints(points, 1.0).sort((a, b) => b.jerk - a.jerk),
    [points],
  )

  if (jerkPoints.length === 0) return null

  const top = jerkPoints.slice(0, TOP_N)
  const rest = jerkPoints.slice(TOP_N)

  const handleDownload = () => {
    exportJerkCSV(jerkPoints, `jerk-data-${rideName.replace(/\s+/g, '-')}.csv`)
  }

  return (
    <div className="mx-1 mb-2">
      <div className="text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">
        Top {Math.min(TOP_N, jerkPoints.length)} jerks by m/s³
      </div>
      {top.map((jp, rank) => (
        <div
          key={jp.index}
          className="flex items-center gap-2 px-2 py-1.5 text-xs border-b border-gray-100 dark:border-zinc-800"
        >
          <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-zinc-300 flex-shrink-0">
            {rank + 1}
          </span>
          <span className="text-gray-900 dark:text-zinc-100 font-medium tabular-nums">
            {jp.jerk} m/s³
          </span>
          <span className="text-gray-400 dark:text-zinc-500 tabular-nums">
            jounce {jp.jounce} m/s⁴
          </span>
          <span className="text-gray-500 dark:text-zinc-400 tabular-nums">
            {jp.lat.toFixed(4)}, {jp.lng.toFixed(4)}
          </span>
          <span className="text-gray-400 dark:text-zinc-500 ml-auto tabular-nums">
            {jp.distanceKm.toFixed(2)} km
          </span>
        </div>
      ))}

      {rest.length > 0 && (
        <>
          <div className="text-xs font-medium text-gray-500 dark:text-zinc-400 mt-3 mb-1">
            All detections ({jerkPoints.length} above 1.0 m/s³)
          </div>
          {rest.map((jp) => (
            <div
              key={jp.index}
              className="flex items-center gap-2 px-2 py-0.5 text-xs"
            >
              <span className="text-gray-500 dark:text-zinc-400 tabular-nums">
                {jp.jerk} m/s³
              </span>
              <span className="text-gray-400 dark:text-zinc-500 tabular-nums">
                jounce {jp.jounce} m/s⁴
              </span>
              <span className="text-gray-400 dark:text-zinc-500 tabular-nums">
                {jp.lat.toFixed(4)}, {jp.lng.toFixed(4)}
              </span>
              <span className="text-gray-400 dark:text-zinc-500 ml-auto tabular-nums">
                {jp.distanceKm.toFixed(2)} km
              </span>
            </div>
          ))}
        </>
      )}

      <button
        onClick={handleDownload}
        className="mt-2 w-full py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-zinc-700 rounded hover:bg-gray-50 dark:hover:bg-zinc-800"
      >
        Download CSV ({jerkPoints.length} points)
      </button>
    </div>
  )
}

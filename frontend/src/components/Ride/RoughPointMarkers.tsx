import { useMemo } from 'react'
import type { RidePoint } from '../../types/index'
import { findRoughPoints, intensityColor } from '../../lib/ride-quality'

interface RoughPointMarkersProps {
  points: RidePoint[]
}

const TOP_N = 5

export function RoughPointMarkers({ points }: RoughPointMarkersProps) {
  const allRough = useMemo(
    () => findRoughPoints(points, 2).sort((a, b) => b.jerk - a.jerk),
    [points],
  )

  if (allRough.length === 0) return null

  const top = allRough.slice(0, TOP_N)
  const rest = allRough.slice(TOP_N)

  return (
    <div className="mx-1 mb-2">
      {/* Top N */}
      <div className="text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">
        Top {Math.min(TOP_N, allRough.length)} sudden jerks by intensity
      </div>
      {top.map((rp, rank) => (
        <div
          key={rp.index}
          className="flex items-center gap-2 px-2 py-1.5 text-xs border-b border-gray-100 dark:border-zinc-800"
        >
          <span className="w-5 h-5 rounded-full bg-gray-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-zinc-300 flex-shrink-0">
            {rank + 1}
          </span>
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: intensityColor(rp.roughness) }}
          />
          <span className="text-gray-900 dark:text-zinc-100 capitalize font-medium">
            {rp.label}
          </span>
          <span className="text-gray-500 dark:text-zinc-400">
            {rp.lat.toFixed(4)}, {rp.lng.toFixed(4)}
          </span>
          <span className="text-gray-400 dark:text-zinc-500">
            {rp.distanceKm.toFixed(2)}km
          </span>
          <span className="text-gray-400 dark:text-zinc-500 ml-auto text-right">
            <span className="text-gray-600 dark:text-zinc-300 font-medium">{rp.roughness}/5</span>
            <br />
            <span className="text-[10px]">jerk {rp.jerk} · jounce {rp.jounce}</span>
          </span>
        </div>
      ))}

      {/* Remaining */}
      {rest.length > 0 && (
        <>
          <div className="text-xs font-medium text-gray-500 dark:text-zinc-400 mt-3 mb-1">
            All detections ({allRough.length} total)
          </div>
          {rest.map((rp) => (
            <div
              key={rp.index}
              className="flex items-center gap-2 px-2 py-0.5 text-xs"
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: intensityColor(rp.roughness) }}
              />
              <span className="text-gray-500 dark:text-zinc-400 capitalize">
                {rp.label}
              </span>
              <span className="text-gray-400 dark:text-zinc-500">
                {rp.lat.toFixed(4)}, {rp.lng.toFixed(4)}
              </span>
              <span className="text-gray-400 dark:text-zinc-500 ml-auto">
                {rp.roughness}/5 · {rp.distanceKm.toFixed(2)}km
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

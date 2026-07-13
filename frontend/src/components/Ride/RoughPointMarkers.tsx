import { useMemo } from 'react'
import type { RidePoint } from '../../types/index'
import { findRoughPoints, intensityColor } from '../../lib/ride-quality'

interface RoughPointMarkersProps {
  points: RidePoint[]
}

export function RoughPointMarkers({ points }: RoughPointMarkersProps) {
  const roughPoints = useMemo(() => findRoughPoints(points, 2), [points])

  if (roughPoints.length === 0) return null

  return (
    <div className="mx-1 mb-2">
      <div className="text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">
        Rough patches ({roughPoints.length}) along ride route
      </div>
      <div className="flex flex-col gap-1">
        {roughPoints.map((rp) => (
          <div
            key={rp.index}
            className="flex items-center gap-2 px-2 py-1 rounded text-xs"
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: intensityColor(rp.roughness) }}
            />
            <span className="text-gray-900 dark:text-zinc-100 capitalize">
              {rp.label}
            </span>
            <span className="text-gray-400 dark:text-zinc-500">
              {rp.lat.toFixed(4)}, {rp.lng.toFixed(4)}
            </span>
            <span className="text-gray-400 dark:text-zinc-500 ml-auto">
              {rp.roughness}/5
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

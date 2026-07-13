import { useState } from 'react'
import type { RidePoint } from '../../types/index'
import { RideMap } from '../Map/RideMap'
import { downloadGPX } from '../../lib/gpx'

interface RideTimelineProps {
  points: RidePoint[]
  route: [number, number][]
  onClose?: () => void
  title?: string
  rideName?: string
}

export function RideTimeline({ points, route, onClose, title = 'Ride Details', rideName }: RideTimelineProps) {
  const [index, setIndex] = useState(0)
  const total = points.length
  const current = points[index]
  const scrubPosition: [number, number] | null = current
    ? [current.location.lat, current.location.lng]
    : null
  const percentage = total > 1 ? Math.round((index / (total - 1)) * 100) : 0

  // Guard: no GPS data
  if (total === 0) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-gray-100 dark:bg-zinc-900">
        <div className="text-center">
          <p className="text-gray-500 dark:text-zinc-400 mb-4">No GPS data available for this ride</p>
          {onClose && (
            <button
              onClick={onClose}
              className="text-sm text-emerald-600 dark:text-emerald-400 underline"
            >
              Go back
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <RideMap
          currentPosition={null}
          route={route}
          isRiding={false}
          scrubPosition={scrubPosition}
        />
      </div>

      {/* Close button (top-left) */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 left-3 z-[1001] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-3 py-1.5 text-sm text-gray-700 dark:text-zinc-300 rounded-full shadow"
        >
          Close
        </button>
      )}

      {/* Title (top-center) */}
      {title && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1001] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-gray-900 dark:text-zinc-100 rounded-full shadow">
          {title}
        </div>
      )}

      {/* Fixed bottom sheet overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-t border-gray-200 dark:border-zinc-700 px-4 py-3 z-[1000]">
        {/* Slider */}
        <div className="flex justify-between text-xs text-gray-500 dark:text-zinc-400 mb-2">
          <span>Start</span>
          <span>{percentage}%</span>
          <span>End</span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(total - 1, 0)}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="w-full h-1 appearance-none bg-gray-200 dark:bg-zinc-800 accent-emerald-600 dark:accent-emerald-400"
        />

        {/* Point details */}
        {current && (
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-sm text-gray-900 dark:text-zinc-100">
              <span>Point {index + 1}/{total}</span>
              <span>
                {new Date(current.recorded_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              {current.speed_kmh != null
                ? `${current.speed_kmh.toFixed(1)} km/h`
                : '— km/h'}
            </div>
            <div className="text-sm text-gray-500 dark:text-zinc-400">
              {current.temperature != null && `${current.temperature.toFixed(0)}°C`}
              {current.feels_like != null && ` · Feels ${current.feels_like.toFixed(0)}°C`}
              {current.humidity != null && ` · ${current.humidity}%`}
            </div>
            <div className="text-xs text-gray-500 dark:text-zinc-400">
              {current.location?.lat?.toFixed(4) ?? '—'}°N,{' '}
              {current.location?.lng?.toFixed(4) ?? '—'}°E
            </div>
          </div>
        )}

        {/* Export GPX */}
        <button
          onClick={() => downloadGPX(points, rideName || 'ride')}
          className="mt-2 w-full py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-zinc-700 rounded"
        >
          Export GPX
        </button>
      </div>
    </div>
  )
}

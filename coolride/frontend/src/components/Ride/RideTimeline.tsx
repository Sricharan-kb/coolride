import { useState } from 'react'
import type { RidePoint } from '../../types/index'
import { RideMap } from '../Map/RideMap'

interface RideTimelineProps {
  points: RidePoint[]
  route: [number, number][]
}

export function RideTimeline({ points, route }: RideTimelineProps) {
  const [index, setIndex] = useState(0)
  const total = points.length
  const current = points[index]
  const scrubPosition: [number, number] | null = current
    ? [current.location.lat, current.location.lng]
    : null
  const percentage = total > 0 ? Math.round((index / (total - 1)) * 100) : 0

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <RideMap
          currentPosition={null}
          route={route}
          isRiding={false}
          scrubPosition={scrubPosition}
        />
      </div>

      <div className="flex-shrink-0 px-4 py-3 bg-white dark:bg-zinc-950 border-t border-gray-200 dark:border-zinc-800">
        <div className="flex justify-between text-xs text-gray-500 dark:text-zinc-400 mb-2">
          <span>Start</span>
          <span>{percentage}%</span>
          <span>End</span>
        </div>
        <input
          type="range"
          min={0}
          max={total - 1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="w-full h-1 appearance-none bg-gray-200 dark:bg-zinc-800 accent-emerald-600 dark:accent-emerald-400 mb-3"
        />

        {current && (
          <div className="space-y-1">
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
      </div>
    </div>
  )
}

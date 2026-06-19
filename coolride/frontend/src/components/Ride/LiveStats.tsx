interface LiveStatsProps {
  distance: number
  duration: number
  currentSpeed: number
  lastTemp: number | null
  lastHumidity: number | null
  lastLux: number | null
  isVisible: boolean
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function LiveStats({
  distance,
  duration,
  currentSpeed,
  lastTemp,
  lastHumidity,
  lastLux,
  isVisible,
}: LiveStatsProps) {
  if (!isVisible) return null

  return (
    <div className="bg-white dark:bg-zinc-900 px-3 py-2 border-t border-gray-200 dark:border-zinc-800">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500 dark:text-zinc-400">Distance</span>
        <span className="text-gray-900 dark:text-zinc-100 font-medium">
          {distance.toFixed(1)} km
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500 dark:text-zinc-400">Duration</span>
        <span className="text-gray-900 dark:text-zinc-100 font-medium">
          {formatDuration(duration)}
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500 dark:text-zinc-400">Speed</span>
        <span className="text-gray-900 dark:text-zinc-100 font-medium">
          {currentSpeed.toFixed(1)} km/h
        </span>
      </div>
      {(lastTemp !== null || lastHumidity !== null || lastLux !== null) && (
        <div className="flex justify-between text-sm mt-1 pt-1 border-t border-gray-100 dark:border-zinc-800">
          <span className="text-gray-500 dark:text-zinc-400">
            {lastTemp !== null && `${lastTemp.toFixed(0)}°C`}
            {lastHumidity !== null && ` · ${lastHumidity}%`}
            {lastLux !== null && ` · ${lastLux.toFixed(0)} lx`}
          </span>
        </div>
      )}
    </div>
  )
}

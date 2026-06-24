import type { WeatherData } from '../../types/index'

interface RideSummaryCardProps {
  distanceKm: number
  durationSec: number
  avgSpeedKmh: number
  weatherSnapshot: WeatherData | null
  isPublic: boolean
  onTogglePublic: () => void
  onViewDetails: () => void
  onClose: () => void
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function RideSummaryCard({
  distanceKm,
  durationSec,
  avgSpeedKmh,
  weatherSnapshot,
  isPublic,
  onTogglePublic,
  onViewDetails,
  onClose,
}: RideSummaryCardProps) {
  return (
    <div className="absolute inset-0 z-[1000] flex items-center justify-center p-4 bg-black/30">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 w-full max-w-sm">
        <h2 className="text-lg font-medium text-gray-900 dark:text-zinc-100 mb-4 text-center">
          Ride Completed!
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {distanceKm.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 dark:text-zinc-400">km</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatDuration(durationSec)}
            </div>
            <div className="text-xs text-gray-500 dark:text-zinc-400">duration</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {avgSpeedKmh.toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 dark:text-zinc-400">km/h avg</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {weatherSnapshot?.temperature?.toFixed(0) ?? '—'}
            </div>
            <div className="text-xs text-gray-500 dark:text-zinc-400">°C</div>
          </div>
        </div>

        {weatherSnapshot && (
          <div className="flex items-center justify-center gap-2 mb-4 text-sm text-gray-600 dark:text-zinc-300">
            {weatherSnapshot.icon && (
              <img src={weatherSnapshot.icon} alt="" className="w-8 h-8" />
            )}
            <span>{weatherSnapshot.description}</span>
          </div>
        )}

        <div className="flex items-center justify-between mb-4 px-2 py-2 bg-gray-50 dark:bg-zinc-800 rounded">
          <span className="text-sm text-gray-700 dark:text-zinc-300">
            Share this route publicly
          </span>
          <button
            onClick={onTogglePublic}
            className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
              isPublic ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-600'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                isPublic ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-gray-700 dark:text-zinc-300 bg-gray-100 dark:bg-zinc-800 rounded-lg"
          >
            Close
          </button>
          <button
            onClick={onViewDetails}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-emerald-600 dark:bg-emerald-500 rounded-lg"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  )
}

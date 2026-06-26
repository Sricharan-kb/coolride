interface WeatherWidgetProps {
  temperature: number | null
  humidity: number | null
  feelsLike: number | null
  description: string | null
  icon: string | null
  error?: string | null
}

export function WeatherWidget({
  temperature,
  humidity,
  feelsLike,
  description,
  icon,
  error,
}: WeatherWidgetProps) {
  if (temperature == null && humidity == null) {
    return (
      <div className="bg-white/90 dark:bg-zinc-900/90 px-3 py-2 text-sm text-gray-500 dark:text-zinc-400">
        {error ?? 'Weather unavailable'}
      </div>
    )
  }

  return (
    <div className="bg-white/90 dark:bg-zinc-900/90 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        {icon && (
          <img
            src={icon.startsWith('//') ? `https:${icon}` : icon}
            alt={description ?? ''}
            className="w-8 h-8"
          />
        )}
        <div>
          <div className="text-gray-900 dark:text-zinc-100 font-medium">
            {temperature != null ? `${temperature.toFixed(0)}°C` : '—'}
            {humidity != null ? ` · ${humidity}%` : ''}
          </div>
          {feelsLike != null && (
            <div className="text-xs text-gray-500 dark:text-zinc-400">
              Feels {feelsLike.toFixed(0)}°C
            </div>
          )}
        </div>
      </div>
      {description && (
        <div className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 capitalize">
          {description}
        </div>
      )}
    </div>
  )
}

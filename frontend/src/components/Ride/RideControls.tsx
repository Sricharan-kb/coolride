export type RideState = 'idle' | 'recording' | 'paused'

interface RideControlsProps {
  rideState: RideState
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

export function RideControls({
  rideState,
  onStart,
  onPause,
  onResume,
  onStop,
}: RideControlsProps) {
  const fabBase =
    'rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform font-medium select-none'

  if (rideState === 'idle') {
    return (
      <button
        onClick={onStart}
        className={`${fabBase} w-16 h-16 bg-emerald-600 dark:bg-emerald-400 text-white dark:text-zinc-950 text-lg`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5.14v14l11-7-11-7z" />
        </svg>
      </button>
    )
  }

  if (rideState === 'recording') {
    return (
      <div className="flex gap-4">
        <button
          onClick={onPause}
          className={`${fabBase} w-14 h-14 bg-amber-500 text-white dark:text-zinc-950`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        </button>
        <button
          onClick={onStop}
          className={`${fabBase} w-14 h-14 bg-red-600 dark:bg-red-400 text-white dark:text-zinc-950`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-4">
      <button
        onClick={onResume}
        className={`${fabBase} w-14 h-14 bg-emerald-600 dark:bg-emerald-400 text-white dark:text-zinc-950`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5.14v14l11-7-11-7z" />
        </svg>
      </button>
      <button
        onClick={onStop}
        className={`${fabBase} w-14 h-14 bg-red-600 dark:bg-red-400 text-white dark:text-zinc-950`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      </button>
    </div>
  )
}

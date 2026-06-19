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
  if (rideState === 'idle') {
    return (
      <button
        onClick={onStart}
        className="bg-emerald-600 dark:bg-emerald-400 text-white dark:text-zinc-950 w-48 py-3 text-base font-medium"
      >
        START RIDE
      </button>
    )
  }

  if (rideState === 'recording') {
    return (
      <div className="flex gap-3">
        <button
          onClick={onPause}
          className="bg-amber-500 text-white dark:text-zinc-950 w-32 py-3 text-base font-medium"
        >
          PAUSE
        </button>
        <button
          onClick={onStop}
          className="bg-red-600 dark:bg-red-400 text-white dark:text-zinc-950 w-32 py-3 text-base font-medium"
        >
          STOP
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={onResume}
        className="bg-emerald-600 dark:bg-emerald-400 text-white dark:text-zinc-950 w-32 py-3 text-base font-medium"
      >
        RESUME
      </button>
      <button
        onClick={onStop}
        className="bg-red-600 dark:bg-red-400 text-white dark:text-zinc-950 w-32 py-3 text-base font-medium"
      >
        STOP
      </button>
    </div>
  )
}

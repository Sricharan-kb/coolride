import { useState } from 'react'
import type { RideFeedback } from '../../types/index'
import { supabase } from '../../lib/supabase'

interface RideFeedbackModalProps {
  rideId: string
  userId: string
  startedAt: string
  onSubmit: () => void
}

function computeTimeOfDay(startedAt: string): string {
  const hour = new Date(startedAt).getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 20) return 'evening'
  return 'night'
}

function ScaleInput({
  label,
  subtitle,
  value,
  onChange,
}: {
  label: string
  subtitle: string
  value: number | null
  onChange: (v: number) => void
}) {
  return (
    <div className="mb-4">
      <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">
        {label}
      </div>
      <div className="text-xs text-gray-500 dark:text-zinc-400 mb-2">
        {subtitle}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-11 h-11 text-sm font-medium border ${
              value === n
                ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-600 dark:bg-emerald-400 text-white dark:text-zinc-950'
                : 'border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export function RideFeedbackModal({
  rideId,
  userId,
  startedAt,
  onSubmit,
}: RideFeedbackModalProps) {
  const [perceivedTemperature, setPerceivedTemperature] = useState<number | null>(null)
  const [shadeQuality, setShadeQuality] = useState<number | null>(null)
  const [routePreference, setRoutePreference] = useState<'yes' | 'no' | 'maybe' | null>(null)
  const [uvConcern, setUvConcern] = useState<number | null>(null)
  const [hydrationLevel, setHydrationLevel] = useState<number | null>(null)
  const [roadQuality, setRoadQuality] = useState<number | null>(null)
  const [additionalComments, setAdditionalComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit =
    perceivedTemperature !== null &&
    shadeQuality !== null &&
    routePreference !== null &&
    uvConcern !== null &&
    hydrationLevel !== null &&
    roadQuality !== null

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    const timeOfDay = computeTimeOfDay(startedAt)

    const feedback: Omit<RideFeedback, 'id' | 'submitted_at'> = {
      ride_id: rideId,
      user_id: userId,
      perceived_temperature: perceivedTemperature,
      shade_quality: shadeQuality,
      route_preference: routePreference,
      uv_concern: uvConcern,
      hydration_level: hydrationLevel,
      road_quality: roadQuality,
      time_of_day: timeOfDay,
      additional_comments: additionalComments || null,
    }

    try {
      const { error: insertError } = await supabase
        .from('ride_feedback')
        .insert(feedback)

      if (insertError) {
        setError(insertError.message)
        setSubmitting(false)
        return
      }

      onSubmit()
    } catch {
      setError('Failed to submit feedback')
      setSubmitting(false)
    }
  }

  return (
    <div className="absolute inset-0 z-[1100] bg-white dark:bg-zinc-950 overflow-y-auto">
      <div className="max-w-sm mx-auto px-4 py-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-zinc-100 mb-6">
          Ride Feedback
        </h2>

        <ScaleInput
          label="Perceived temperature"
          subtitle="How hot did it feel?"
          value={perceivedTemperature}
          onChange={setPerceivedTemperature}
        />
        <ScaleInput
          label="Shade quality"
          subtitle="How shaded was your route?"
          value={shadeQuality}
          onChange={setShadeQuality}
        />

        <div className="mb-4">
          <div className="text-sm font-medium text-gray-900 dark:text-zinc-100">
            Route preference
          </div>
          <div className="text-xs text-gray-500 dark:text-zinc-400 mb-2">
            Would you prefer a shadier route?
          </div>
          <div className="flex gap-2">
            {(['yes', 'maybe', 'no'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setRoutePreference(opt)}
                className={`px-4 py-2 text-sm font-medium border capitalize ${
                  routePreference === opt
                    ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-600 dark:bg-emerald-400 text-white dark:text-zinc-950'
                    : 'border-gray-200 dark:border-zinc-800 text-gray-900 dark:text-zinc-100'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <ScaleInput
          label="UV concern"
          subtitle="How concerned about UV exposure?"
          value={uvConcern}
          onChange={setUvConcern}
        />
        <ScaleInput
          label="Hydration"
          subtitle="Did you feel adequately hydrated?"
          value={hydrationLevel}
          onChange={setHydrationLevel}
        />
        <ScaleInput
          label="Road quality"
          subtitle="How was the road surface?"
          value={roadQuality}
          onChange={setRoadQuality}
        />

        <div className="mb-4">
          <div className="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-2">
            Anything else?
          </div>
          <textarea
            value={additionalComments}
            onChange={(e) => setAdditionalComments(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 px-3 py-2 text-base outline-none focus:border-emerald-600 dark:focus:border-emerald-400 resize-none"
          />
        </div>

        {error && (
          <p className="text-red-600 dark:text-red-400 text-sm mb-3">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full bg-emerald-600 dark:bg-emerald-400 text-white dark:text-zinc-950 py-2 text-base font-medium disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>
    </div>
  )
}

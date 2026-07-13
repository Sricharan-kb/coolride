import { useMemo } from 'react'
import type { RidePoint } from '../../types/index'
import { findRoughPoints } from '../../lib/ride-quality'

interface RoadQualitySummaryProps {
  points: RidePoint[]
}

export function RoadQualitySummary({ points }: RoadQualitySummaryProps) {
  const summary = useMemo(() => {
    const rough = findRoughPoints(points, 1)
    if (rough.length === 0) return null

    const max = rough.reduce((a, b) =>
      a.roughness > b.roughness ? a : b,
    )
    const avg =
      rough.reduce((s, p) => s + p.roughness, 0) / rough.length
    const severe = rough.filter((p) => p.roughness >= 3).length

    return { count: rough.length, max, avg, severe }
  }, [points])

  if (!summary) return null

  return (
    <div className="mx-1 mb-2 p-2 border border-gray-200 dark:border-zinc-700 rounded text-xs">
      <div className="font-medium text-gray-700 dark:text-zinc-300 mb-1">
        Road quality summary
      </div>
      <div className="grid grid-cols-2 gap-1 text-gray-500 dark:text-zinc-400">
        <span>Rough patches</span>
        <span className="text-gray-900 dark:text-zinc-100 font-medium">
          {summary.count}
        </span>
        <span>Severe ({'>'}=3/5)</span>
        <span className="text-red-600 dark:text-red-400 font-medium">
          {summary.severe}
        </span>
        <span>Avg roughness</span>
        <span className="text-gray-900 dark:text-zinc-100 font-medium">
          {summary.avg.toFixed(1)}/5
        </span>
        <span>Worst</span>
        <span className="text-gray-900 dark:text-zinc-100 font-medium">
          {summary.max.roughness}/5 '{summary.max.label}' at{' '}
          {summary.max.lat.toFixed(4)}, {summary.max.lng.toFixed(4)}
        </span>
      </div>
    </div>
  )
}

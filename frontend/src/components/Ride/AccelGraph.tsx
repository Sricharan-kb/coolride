import { useMemo } from 'react'
import type { RidePoint } from '../../types/index'
import { computeAccelSeries, findRoughPoints } from '../../lib/ride-quality'

interface AccelGraphProps {
  points: RidePoint[]
}

const WIDTH = 800
const HEIGHT = 160
const PADDING = { top: 10, right: 10, bottom: 20, left: 40 }
const PLOT_W = WIDTH - PADDING.left - PADDING.right
const PLOT_H = HEIGHT - PADDING.top - PADDING.bottom

const COLORS = { x: '#22c55e', y: '#3b82f6', z: '#f97316' }
const MAX_ACCEL = 20

function svgPath(values: number[], distKm: number[], maxX: number): string {
  if (values.length < 2) return ''
  return values
    .map((v, i) => {
      const x = PADDING.left + (distKm[i] / maxX) * PLOT_W
      const y =
        PADDING.top +
        PLOT_H / 2 -
        (Math.max(-MAX_ACCEL, Math.min(MAX_ACCEL, v)) / MAX_ACCEL) *
          (PLOT_H / 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function AccelGraph({ points }: AccelGraphProps) {
  const { distanceKm, accelX, accelY, accelZ } = useMemo(
    () => computeAccelSeries(points),
    [points],
  )

  const roughPoints = useMemo(() => findRoughPoints(points, 2), [points])

  if (distanceKm.length < 2) {
    return (
      <div className="text-xs text-gray-400 dark:text-zinc-500 text-center py-4">
        No accelerometer data for this ride
      </div>
    )
  }

  const maxX = distanceKm[distanceKm.length - 1] || 1
  const yTicks = [-MAX_ACCEL, -MAX_ACCEL / 2, 0, MAX_ACCEL / 2, MAX_ACCEL]
  const xTicks = 4

  return (
    <div className="mx-1 mb-2">
      <div className="text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">
        Accelerometer (m/s²) over distance
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ background: 'var(--bg, #f5f5f5)', borderRadius: 6 }}
      >
        {/* Grid lines */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PADDING.left}
              y1={PADDING.top + PLOT_H / 2 - (t / MAX_ACCEL) * (PLOT_H / 2)}
              x2={PADDING.left + PLOT_W}
              y2={PADDING.top + PLOT_H / 2 - (t / MAX_ACCEL) * (PLOT_H / 2)}
              stroke="#e5e7eb"
              strokeWidth={0.5}
            />
            <text
              x={PADDING.left - 4}
              y={PADDING.top + PLOT_H / 2 - (t / MAX_ACCEL) * (PLOT_H / 2) + 4}
              textAnchor="end"
              fontSize={8}
              fill="#9ca3af"
            >
              {t}
            </text>
          </g>
        ))}

        {/* X labels */}
        {Array.from({ length: xTicks + 1 }, (_, i) => {
          const v = (maxX / xTicks) * i
          const x = PADDING.left + (v / maxX) * PLOT_W
          return (
            <text
              key={i}
              x={x}
              y={HEIGHT - 4}
              textAnchor="middle"
              fontSize={8}
              fill="#9ca3af"
            >
              {v.toFixed(1)}km
            </text>
          )
        })}

        {/* Zero line */}
        <line
          x1={PADDING.left}
          y1={PADDING.top + PLOT_H / 2}
          x2={PADDING.left + PLOT_W}
          y2={PADDING.top + PLOT_H / 2}
          stroke="#d1d5db"
          strokeWidth={0.5}
        />

        {/* Accel lines */}
        <path
          d={svgPath(accelX, distanceKm, maxX)}
          fill="none"
          stroke={COLORS.x}
          strokeWidth={1}
        />
        <path
          d={svgPath(accelY, distanceKm, maxX)}
          fill="none"
          stroke={COLORS.y}
          strokeWidth={1}
        />
        <path
          d={svgPath(accelZ, distanceKm, maxX)}
          fill="none"
          stroke={COLORS.z}
          strokeWidth={1}
        />

        {/* Rough point markers */}
        {roughPoints.map((rp) => (
          <g key={rp.index}>
            <line
              x1={PADDING.left + ((distanceKm[rp.index] ?? 0) / maxX) * PLOT_W}
              y1={PADDING.top}
              x2={PADDING.left + ((distanceKm[rp.index] ?? 0) / maxX) * PLOT_W}
              y2={PADDING.top + PLOT_H}
              stroke={rp.roughness >= 3 ? '#ef4444' : '#eab308'}
              strokeWidth={0.5}
              strokeDasharray="2,2"
            />
            <text
              x={PADDING.left + ((distanceKm[rp.index] ?? 0) / maxX) * PLOT_W + 3}
              y={PADDING.top + 8}
              fontSize={7}
              fill={rp.roughness >= 3 ? '#ef4444' : '#eab308'}
            >
              {rp.label} ({randomOffset(rp.index)}km)
            </text>
          </g>
        ))}

        {/* Legend */}
        <g transform={`translate(${PADDING.left},4)`}>
          {[
            ['Z', COLORS.z],
            ['Y', COLORS.y],
            ['X', COLORS.x],
          ].map(([label, color], i) => (
            <g key={label} transform={`translate(${i * 30},0)`}>
              <line x1={0} y1={0} x2={12} y2={0} stroke={color} strokeWidth={1.5} />
              <text x={14} y={3} fontSize={7} fill="#6b7280">
                {label}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Rough point details below chart */}
      {roughPoints.length > 0 && (
        <div className="mt-2 space-y-1">
          {roughPoints.map((rp) => (
            <div
              key={rp.index}
              className="text-xs flex items-baseline gap-2"
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  background:
                    rp.roughness >= 4
                      ? '#ef4444'
                      : rp.roughness >= 3
                        ? '#f97316'
                        : '#eab308',
                }}
              />
              <span className="text-gray-900 dark:text-zinc-100 capitalize">
                {rp.label}
              </span>
              <span className="text-gray-500 dark:text-zinc-400">
                at {rp.lat.toFixed(4)}, {rp.lng.toFixed(4)}
              </span>
              <span className="text-gray-400 dark:text-zinc-500">
                — jerk: {rp.jerk}m/s³, jounce: {rp.jounce}m/s⁴
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ponytail: tiny nonce to avoid duplicate labels when two rough points share same km
let _nonce = 0
function randomOffset(_i: number): string {
  _nonce++
  const offset = ((_nonce * 173) % 100) / 100
  return `~${offset}`
}

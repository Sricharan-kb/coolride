import type { RidePoint } from '../types/index'

export function generateGPX(points: RidePoint[], rideName: string): string {
  const trackPoints = points
    .map((p) => {
      const parts: string[] = []
      parts.push(`      <trkpt lat="${p.location.lat.toFixed(6)}" lon="${p.location.lng.toFixed(6)}">`)
      parts.push(`        <time>${p.recorded_at}</time>`)
      if (p.temperature != null || p.humidity != null) {
        parts.push('        <extensions>')
        if (p.temperature != null) parts.push(`          <temp>${p.temperature}</temp>`)
        if (p.humidity != null) parts.push(`          <humidity>${p.humidity}</humidity>`)
        parts.push('        </extensions>')
      }
      parts.push('      </trkpt>')
      return parts.join('\n')
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="coolride" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${escapeXml(rideName)}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function downloadGPX(points: RidePoint[], rideName: string): void {
  if (points.length === 0) return

  const gpx = generateGPX(points, rideName)
  const blob = new Blob([gpx], { type: 'application/gpx+xml' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `coolride-${rideName.replace(/[^a-zA-Z0-9]/g, '-')}.gpx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

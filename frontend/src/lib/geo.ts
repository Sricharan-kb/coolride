interface GeoJSONPoint {
  type: 'Point'
  coordinates: [number, number]
}

function parseWKT(wkt: string): { lat: number; lng: number } | null {
  const match = wkt.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i)
  if (!match) return null
  const lng = parseFloat(match[1])
  const lat = parseFloat(match[2])
  if (isNaN(lat) || isNaN(lng)) return null
  return { lat, lng }
}

function parseWKBHex(hex: string): { lat: number; lng: number } | null {
  if (!hex || hex.length < 34) return null

  const pairs = hex.match(/.{2}/g)
  if (!pairs) return null
  const bytes = new Uint8Array(pairs.map((b) => parseInt(b, 16)))
  if (bytes.length < 21) return null

  const view = new DataView(bytes.buffer)
  const isLittleEndian = view.getUint8(0) === 1

  let offset = 5

  const type = view.getUint32(1, isLittleEndian)
  if (type & 0x20000000) {
    offset += 4
  }

  if (bytes.length < offset + 16) return null

  const lng = view.getFloat64(offset, isLittleEndian)
  const lat = view.getFloat64(offset + 8, isLittleEndian)

  if (isNaN(lat) || isNaN(lng)) return null
  return { lat, lng }
}

export function parseLocation(raw: unknown): { lat: number; lng: number } | null {
  if (typeof raw === 'string' && /^[0-9A-Fa-f]+$/.test(raw)) {
    const parsed = parseWKBHex(raw)
    if (parsed) return parsed
  }

  const geo = raw as GeoJSONPoint | undefined
  if (
    geo &&
    geo.type === 'Point' &&
    Array.isArray(geo.coordinates) &&
    geo.coordinates.length === 2 &&
    typeof geo.coordinates[0] === 'number' &&
    typeof geo.coordinates[1] === 'number'
  ) {
    return { lat: geo.coordinates[1], lng: geo.coordinates[0] }
  }

  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as GeoJSONPoint
      if (
        parsed.type === 'Point' &&
        Array.isArray(parsed.coordinates) &&
        parsed.coordinates.length === 2 &&
        typeof parsed.coordinates[0] === 'number' &&
        typeof parsed.coordinates[1] === 'number'
      ) {
        return { lat: parsed.coordinates[1], lng: parsed.coordinates[0] }
      }
    } catch {
      // not valid JSON, fall through
    }
  }

  if (typeof raw === 'string') {
    const parsed = parseWKT(raw)
    if (parsed) return parsed
  }

  const direct = raw as { lat?: number; lng?: number } | undefined
  if (direct && typeof direct.lat === 'number' && typeof direct.lng === 'number') {
    return { lat: direct.lat, lng: direct.lng }
  }

  return null
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

import { useState, useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Marker, useMap } from 'react-leaflet'
import * as L from 'leaflet'

interface RideMapProps {
  currentPosition: [number, number] | null
  route: [number, number][]
  isRiding: boolean
  scrubPosition?: [number, number] | null
}

const CHENNAI_CENTER: [number, number] = [13.0827, 80.2707]

function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return isDark
}

function MapCenterUpdater({ position }: { position: [number, number] | null }) {
  const map = useMap()
  const prevRef = useRef<[number, number] | null>(null)

  useEffect(() => {
    if (position && (prevRef.current === null || position[0] !== prevRef.current[0] || position[1] !== prevRef.current[1])) {
      map.setView(position, map.getZoom())
      prevRef.current = position
    }
  }, [position, map])

  return null
}

function RouteBounds({ route }: { route: [number, number][] }) {
  const map = useMap()
  const prevLengthRef = useRef(0)

  useEffect(() => {
    const validRoute = route.filter(
      ([lat, lng]) =>
        typeof lat === 'number' &&
        !isNaN(lat) &&
        typeof lng === 'number' &&
        !isNaN(lng)
    )

    if (validRoute.length > 1 && validRoute.length !== prevLengthRef.current) {
      map.whenReady(() => {
        const bounds = L.latLngBounds(validRoute.map(([lat, lng]) => [lat, lng]))
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 })
      })
      prevLengthRef.current = validRoute.length
    }
  }, [route, map])

  return null
}

function DarkModeTileLayer({ isDark }: { isDark: boolean }) {
  const lightUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  const darkUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  const attribution =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

  return (
    <TileLayer
      key={isDark ? 'dark' : 'light'}
      attribution={attribution}
      url={isDark ? darkUrl : lightUrl}
    />
  )
}

function PinIcon({ color }: { color: string }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="28" height="28">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>`
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  })
}

export function RideMap({
  currentPosition,
  route,
  isRiding,
  scrubPosition,
}: RideMapProps) {
  const isDark = useDarkMode()
  const markerColor = isDark ? '#34D399' : '#059669'
  const scrubColor = isDark ? '#F87171' : '#DC2626'

  const validRoute = route.filter(
    ([lat, lng]) =>
      typeof lat === 'number' &&
      !isNaN(lat) &&
      typeof lng === 'number' &&
      !isNaN(lng)
  )

  const pinIcon = useMemo(() => PinIcon({ color: scrubColor }), [scrubColor])

  return (
    <MapContainer
      center={currentPosition ?? CHENNAI_CENTER}
      zoom={15}
      maxZoom={19}
      className="h-full w-full"
      zoomControl={false}
    >
      <DarkModeTileLayer isDark={isDark} />
      <MapCenterUpdater position={currentPosition} />
      <RouteBounds route={validRoute} />
      {currentPosition && (
        <CircleMarker
          center={currentPosition}
          radius={isRiding ? 9 : 7}
          pathOptions={{
            color: markerColor,
            fillColor: markerColor,
            fillOpacity: isRiding ? 0.5 : 0.8,
          }}
          className={isRiding ? 'leaflet-pulse' : ''}
        />
      )}
      {validRoute.length > 1 && (
        <Polyline
          positions={validRoute}
          pathOptions={{ color: markerColor, weight: 4, opacity: 0.9 }}
        />
      )}
      {scrubPosition && (
        <Marker
          position={scrubPosition}
          icon={pinIcon}
        />
      )}
    </MapContainer>
  )
}

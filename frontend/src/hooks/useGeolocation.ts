import { useState, useEffect, useCallback, useRef } from 'react'

interface GeolocationState {
  position: { lat: number; lng: number } | null
  error: string | null
  accuracy: number | null
}

interface UseGeolocationReturn extends GeolocationState {
  isTracking: boolean
  smoothedPosition: { lat: number; lng: number } | null
}

const SMOOTHING = 0.15

export function useGeolocation(isTracking: boolean): UseGeolocationReturn {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [smoothedPosition, setSmoothedPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const smoothRef = useRef<{ lat: number; lng: number } | null>(null)

  const handlePosition = useCallback((pos: GeolocationPosition) => {
    const raw = { lat: pos.coords.latitude, lng: pos.coords.longitude }
    setPosition(raw)
    setAccuracy(pos.coords.accuracy)
    setError(null)

    if (smoothRef.current === null) {
      smoothRef.current = raw
    } else {
      smoothRef.current = {
        lat: smoothRef.current.lat * (1 - SMOOTHING) + raw.lat * SMOOTHING,
        lng: smoothRef.current.lng * (1 - SMOOTHING) + raw.lng * SMOOTHING,
      }
    }
    setSmoothedPosition({ ...smoothRef.current })
  }, [])

  const handleError = useCallback((err: GeolocationPositionError) => {
    setError(err.message)
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported')
      return
    }

    if (isTracking) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        handleError,
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        }
      )
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [isTracking, handlePosition, handleError])

  return { position, smoothedPosition, error, accuracy, isTracking }
}
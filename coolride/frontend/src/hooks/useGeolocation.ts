import { useState, useEffect, useCallback, useRef } from 'react'

interface GeolocationState {
  position: { lat: number; lng: number } | null
  error: string | null
  accuracy: number | null
  speed: number | null  // m/s from GPS chip, null if unavailable
}

interface UseGeolocationReturn extends GeolocationState {
  isTracking: boolean
}

export function useGeolocation(isTracking: boolean): UseGeolocationReturn {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [speed, setSpeed] = useState<number | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const handlePosition = useCallback((pos: GeolocationPosition) => {
    setPosition({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    })
    setAccuracy(pos.coords.accuracy)
    setSpeed(pos.coords.speed)
    setError(null)
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

  return { position, error, accuracy, speed, isTracking }
}
import { useState, useEffect, useRef } from 'react'
import type { WeatherData } from '../types/index'
import { supabase } from '../lib/supabase'
import { haversineDistance } from '../lib/geo'

interface UseWeatherReturn {
  weather: WeatherData | null
  loading: boolean
  error: string | null
}

export function useWeather(
  lat: number | null,
  lng: number | null
): UseWeatherReturn {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastFetchPos = useRef<{ lat: number; lng: number } | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (lat === null || lng === null) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    if (
      lastFetchPos.current !== null &&
      haversineDistance(lastFetchPos.current.lat, lastFetchPos.current.lng, lat, lng) < 100
    ) {
      return
    }

    const fetchWeather = async () => {
      setLoading(true)
      setError(null)
      lastFetchPos.current = { lat, lng }

      try {
        const { data, error: fetchError } = await supabase.functions.invoke(
          'weather',
          {
            body: { lat, lon: lng },
          }
        )

        if (fetchError) {
          setError(fetchError.message)
        } else if (
          data &&
          typeof data.temperature === 'number' &&
          typeof data.humidity === 'number' &&
          typeof data.feels_like === 'number' &&
          typeof data.description === 'string' &&
          typeof data.icon === 'string'
        ) {
          setWeather(data as WeatherData)
        }
      } catch {
        setError('Failed to fetch weather')
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()

    intervalRef.current = setInterval(fetchWeather, 30000)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [lat, lng])

  return { weather, loading, error }
}

import { useState, useEffect } from 'react'

interface SensorState {
  lux: number | null
  acceleration: { x: number; y: number; z: number } | null
  alsSupported: boolean
  accelSupported: boolean
}

export function useSensors(isTracking: boolean): SensorState {
  const [lux, setLux] = useState<number | null>(null)
  const [acceleration, setAcceleration] = useState<{
    x: number
    y: number
    z: number
  } | null>(null)
  const [alsSupported, setAlsSupported] = useState(false)
  const [accelSupported, setAccelSupported] = useState(false)

  useEffect(() => {
    if (!isTracking) return

    let alsCleanup: (() => void) | undefined

    try {
      // TODO(NOTE): Type cast chain for AmbientLightSensor — consider a typed wrapper or @types/ambient-light-sensor if available
      const sensor = new (window as unknown as { AmbientLightSensor: new (opts?: { frequency?: number }) => { addEventListener: (e: string, cb: () => void) => void; start: () => void; stop: () => void } }).AmbientLightSensor({ frequency: 1 })
      sensor.addEventListener('reading', () => {
        const illuminance = (sensor as unknown as { illuminance: number }).illuminance
        setLux(illuminance)
      })
      sensor.start()
      setAlsSupported(true)
      alsCleanup = () => sensor.stop()
    } catch {
      setAlsSupported(false)
    }

    return () => {
      alsCleanup?.()
    }
  }, [isTracking])

  useEffect(() => {
    if (!isTracking) return

    let cancelled = false

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.acceleration
      if (acc && acc.x !== null && acc.y !== null && acc.z !== null) {
        setAcceleration({ x: acc.x, y: acc.y, z: acc.z })
        if (!cancelled) {
          setAccelSupported(true)
        }
      }
    }

    const register = () => {
      window.addEventListener('devicemotion', handleMotion)
    }

    if (
      typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function'
    ) {
      ;(DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> })
        .requestPermission()
        .then((state) => {
          if (!cancelled && state === 'granted') {
            register()
          }
        })
        .catch(() => {})
    } else {
      register()
    }

    return () => {
      cancelled = true
      window.removeEventListener('devicemotion', handleMotion)
    }
  }, [isTracking])

  return { lux, acceleration, alsSupported, accelSupported }
}

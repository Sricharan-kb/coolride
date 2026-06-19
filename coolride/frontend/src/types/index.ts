export interface Ride {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  route: GeoJSON.LineString | null
  distance_m: number | null
  duration_sec: number | null
  weather_snapshot: WeatherData | null
  sensor_data: { avg_lux: number | null; avg_accel_magnitude: number | null } | null
}

export interface RidePoint {
  id: string
  ride_id: string
  point_index: number
  location: { lat: number; lng: number }
  recorded_at: string
  temperature: number | null
  humidity: number | null
  feels_like: number | null
  speed_kmh: number | null
  lux: number | null
  accel_x: number | null
  accel_y: number | null
  accel_z: number | null
}

export interface RideFeedback {
  id: string
  ride_id: string
  user_id: string
  submitted_at: string
  perceived_temperature: number
  shade_quality: number
  route_preference: 'yes' | 'no' | 'maybe'
  uv_concern: number
  hydration_level: number
  road_quality: number
  time_of_day: string
  additional_comments: string | null
}

export interface WeatherData {
  temperature: number
  humidity: number
  feels_like: number
  description: string
  icon: string
}

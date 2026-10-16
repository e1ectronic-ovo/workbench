export interface WeatherPlace {
  name: string
  lat: number
  lon: number
}

export interface WeatherDay {
  date: string
  code: number
  tMax: number
  tMin: number
}

export interface WeatherSnapshot {
  place: WeatherPlace
  temp: number
  feels: number
  humidity: number
  wind: number
  code: number
  days: WeatherDay[]
  updatedAt: number
}

const CACHE_KEY = 'workbench.weather'
const CACHE_MS = 20 * 60 * 1000

interface CacheBlob {
  snapshot: WeatherSnapshot
}

function readCache(): WeatherSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as CacheBlob
    if (!data?.snapshot?.place) return null
    return data.snapshot
  } catch {
    return null
  }
}

function writeCache(snapshot: WeatherSnapshot) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ snapshot } satisfies CacheBlob))
  } catch {
    /* ignore */
  }
}

export function weatherLabel(code: number): string {
  if (code === 0) return '晴'
  if (code === 1) return '大部晴朗'
  if (code === 2) return '少云'
  if (code === 3) return '多云'
  if (code === 45 || code === 48) return '雾'
  if (code >= 51 && code <= 57) return '毛毛雨'
  if (code >= 61 && code <= 67) return '雨'
  if (code >= 71 && code <= 77) return '雪'
  if (code >= 80 && code <= 82) return '阵雨'
  if (code === 85 || code === 86) return '阵雪'
  if (code >= 95) return '雷雨'
  return '阴'
}

export function weekdayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, (m || 1) - 1, d || 1)
  const today = new Date()
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return '今天'
  }
  return date.toLocaleDateString('zh-CN', { weekday: 'short' })
}

async function locateByGeo(): Promise<WeatherPlace | null> {
  if (!navigator.geolocation) return null
  const pos = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { maximumAge: 30 * 60 * 1000, timeout: 4000, enableHighAccuracy: false }
    )
  })
  if (!pos) return null
  const lat = pos.coords.latitude
  const lon = pos.coords.longitude
  const name = await reverseName(lat, lon)
  return { name, lat, lon }
}

async function locateByIp(): Promise<WeatherPlace | null> {
  const res = await fetch('https://ipwho.is/')
  if (!res.ok) return null
  const data = (await res.json()) as {
    success?: boolean
    city?: string
    region?: string
    latitude?: number
    longitude?: number
  }
  if (!data.success || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
    return null
  }
  const name = data.city || data.region || '当前位置'
  return { name, lat: data.latitude, lon: data.longitude }
}

async function reverseName(lat: number, lon: number): Promise<string> {
  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/reverse')
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set('language', 'zh')
    url.searchParams.set('format', 'json')
    const res = await fetch(url)
    if (!res.ok) return '当前位置'
    const data = (await res.json()) as {
      results?: { name?: string; admin1?: string }[]
    }
    const hit = data.results?.[0]
    return hit?.name || hit?.admin1 || '当前位置'
  } catch {
    return '当前位置'
  }
}

async function resolvePlace(cached?: WeatherPlace): Promise<WeatherPlace> {
  const geo = await locateByGeo()
  if (geo) return geo
  if (cached) return cached
  const ip = await locateByIp()
  if (ip) return ip
  return { name: '北京', lat: 39.9042, lon: 116.4074 }
}

export async function loadWeather(force = false): Promise<WeatherSnapshot> {
  const cached = readCache()
  if (!force && cached && Date.now() - cached.updatedAt < CACHE_MS) return cached

  const place = await resolvePlace(cached?.place)
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(place.lat))
  url.searchParams.set('longitude', String(place.lon))
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m'
  )
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '3')

  const res = await fetch(url)
  if (!res.ok) {
    if (cached) return cached
    throw new Error('天气请求失败')
  }

  const data = (await res.json()) as {
    current?: {
      temperature_2m?: number
      apparent_temperature?: number
      relative_humidity_2m?: number
      weather_code?: number
      wind_speed_10m?: number
    }
    daily?: {
      time?: string[]
      weather_code?: number[]
      temperature_2m_max?: number[]
      temperature_2m_min?: number[]
    }
  }

  const days: WeatherDay[] = (data.daily?.time || []).map((date, i) => ({
    date,
    code: data.daily?.weather_code?.[i] ?? 0,
    tMax: Math.round(data.daily?.temperature_2m_max?.[i] ?? 0),
    tMin: Math.round(data.daily?.temperature_2m_min?.[i] ?? 0)
  }))

  const snapshot: WeatherSnapshot = {
    place,
    temp: Math.round(data.current?.temperature_2m ?? 0),
    feels: Math.round(data.current?.apparent_temperature ?? 0),
    humidity: Math.round(data.current?.relative_humidity_2m ?? 0),
    wind: Math.round(data.current?.wind_speed_10m ?? 0),
    code: data.current?.weather_code ?? 0,
    days,
    updatedAt: Date.now()
  }
  writeCache(snapshot)
  return snapshot
}

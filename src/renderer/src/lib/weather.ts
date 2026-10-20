import { findChinaCityCode, searchChinaPlaces } from './china-places'

export interface WeatherPlace {
  name: string
  lat: number
  lon: number
  cityCode?: string
}

export interface WeatherDay {
  date: string
  code: number
  tMax: number
  tMin: number
  condition?: string
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
  condition?: string
  quality?: string
  notice?: string
  windUnit?: 'kmh' | 'level'
}

const CACHE_KEY = 'workbench.weather'
const PREF_KEY = 'workbench.weather.pref'
const CACHE_MS = 20 * 60 * 1000

export interface WeatherPref {
  mode: 'auto' | 'manual'
  place?: WeatherPlace
}

interface CacheBlob {
  snapshot: WeatherSnapshot
}

function readCache(): WeatherSnapshot | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as CacheBlob
    if (!data?.snapshot?.place) return null
    const snapshot = data.snapshot
    if (!isUsablePlaceName(snapshot.place.name)) {
      snapshot.place = { ...snapshot.place, name: '' }
    }
    return snapshot
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

function isRainCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95
}

function isSnowCode(code: number): boolean {
  return (code >= 71 && code <= 77) || code === 85 || code === 86
}

export function conditionLabel(item: { code: number; condition?: string }): string {
  return item.condition || weatherLabel(item.code)
}

export function weatherHint(snapshot: WeatherSnapshot): string {
  if (snapshot.notice) return snapshot.notice
  if (snapshot.quality && snapshot.quality !== '优') return `空气${snapshot.quality}`
  if (isRainCode(snapshot.code)) return '正在下雨，记得带伞'
  if (isSnowCode(snapshot.code)) return '正在下雪，出门小心'

  const today = snapshot.days[0]
  const tomorrow = snapshot.days[1]
  if (today && isRainCode(today.code)) return '今天有雨，出门带伞'
  if (today && isSnowCode(today.code)) return '今天有雪，注意路面'
  if (tomorrow && isRainCode(tomorrow.code)) return '明天有雨，出门带伞'
  if (tomorrow && isSnowCode(tomorrow.code)) return '明天有雪，注意路面'

  if (today && tomorrow) {
    const drop = Math.max(today.tMin - tomorrow.tMin, today.tMax - tomorrow.tMax)
    if (drop >= 5) return `明天降温约 ${drop}°，加点衣服`
  }
  return ''
}

export function formatWeatherUpdatedAt(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
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

interface GeocodeHit {
  name?: string
  admin1?: string
  admin2?: string
}

interface BigDataCloudPlace {
  locality?: string
  city?: string
  principalSubdivision?: string
}

interface IpPlaceResult {
  lat: number
  lon: number
  name: string
}

const INVALID_PLACE_NAMES = new Set(['当前位置', '定位中'])

function isUsablePlaceName(name?: string): boolean {
  if (!name) return false
  const value = name.trim()
  return value.length > 0 && !INVALID_PLACE_NAMES.has(value)
}

function normalizePlaceName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function formatOpenMeteoPlace(hit?: GeocodeHit): string {
  if (!hit) return ''
  const district = hit.admin2?.trim()
  const city = hit.name?.trim()
  const province = hit.admin1?.trim()

  if (district) return normalizePlaceName(district)
  if (city && province && city !== province && !province.includes(city)) {
    return normalizePlaceName(`${province} ${city}`)
  }
  return normalizePlaceName(city || province || '')
}

function formatBigDataCloudPlace(hit?: BigDataCloudPlace): string {
  if (!hit) return ''
  const district = hit.locality?.trim()
  const city = hit.city?.trim()
  const province = hit.principalSubdivision?.trim()

  if (district) {
    if (city && city !== district && !district.includes(city.replace(/市$/, ''))) {
      const shortCity = city.replace(/市$/, '')
      if (!district.startsWith(shortCity)) {
        return normalizePlaceName(`${shortCity} ${district}`)
      }
    }
    return normalizePlaceName(district)
  }
  return normalizePlaceName(city || province || '')
}

function formatNominatimPlace(data?: {
  address?: {
    county?: string
    city?: string
    district?: string
    town?: string
    suburb?: string
    state?: string
  }
}): string {
  const address = data?.address
  if (!address) return ''
  const district =
    address.district?.trim() ||
    address.county?.trim() ||
    address.town?.trim() ||
    address.suburb?.trim()
  const city = address.city?.trim()
  const province = address.state?.trim()

  if (district) return normalizePlaceName(district)
  if (city && province && city !== province && !province.includes(city)) {
    return normalizePlaceName(`${province} ${city}`)
  }
  return normalizePlaceName(city || province || '')
}

async function locateByGeo(): Promise<Pick<WeatherPlace, 'lat' | 'lon'> | null> {
  if (!navigator.geolocation) return null
  const pos = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { maximumAge: 30 * 60 * 1000, timeout: 4000, enableHighAccuracy: false }
    )
  })
  if (!pos) return null
  return { lat: pos.coords.latitude, lon: pos.coords.longitude }
}

async function reverseOpenMeteo(lat: number, lon: number): Promise<string> {
  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/reverse')
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set('language', 'zh')
    url.searchParams.set('count', '1')
    url.searchParams.set('format', 'json')
    const res = await fetch(url)
    if (!res.ok) return ''
    const data = (await res.json()) as { results?: GeocodeHit[] }
    return formatOpenMeteoPlace(data.results?.[0])
  } catch {
    return ''
  }
}

async function reverseBigDataCloud(lat: number, lon: number): Promise<string> {
  try {
    const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client')
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set('localityLanguage', 'zh')
    const res = await fetch(url)
    if (!res.ok) return ''
    const data = (await res.json()) as BigDataCloudPlace
    return formatBigDataCloudPlace(data)
  } catch {
    return ''
  }
}

async function reverseNominatim(lat: number, lon: number): Promise<string> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lon))
    url.searchParams.set('format', 'json')
    url.searchParams.set('accept-language', 'zh-CN')
    url.searchParams.set('zoom', '10')
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Whaletide/0.3.0 (desktop weather widget)' }
    })
    if (!res.ok) return ''
    const data = (await res.json()) as {
      address?: {
        county?: string
        city?: string
        district?: string
        town?: string
        suburb?: string
        state?: string
      }
    }
    return formatNominatimPlace(data)
  } catch {
    return ''
  }
}

async function reverseName(lat: number, lon: number): Promise<string> {
  const providers = [reverseBigDataCloud, reverseOpenMeteo, reverseNominatim]
  for (const provider of providers) {
    const name = await provider(lat, lon)
    if (isUsablePlaceName(name)) return name
  }
  return ''
}

async function locateByIp(): Promise<IpPlaceResult | null> {
  try {
    const url =
      'https://api.bigdatacloud.net/data/ip-geolocation-with-atomic-precision?localityLanguage=zh'
    const res = await fetch(url)
    if (res.ok) {
      const data = (await res.json()) as BigDataCloudPlace & {
        latitude?: number
        longitude?: number
      }
      const name = formatBigDataCloudPlace(data)
      if (
        isUsablePlaceName(name) &&
        typeof data.latitude === 'number' &&
        typeof data.longitude === 'number'
      ) {
        return { lat: data.latitude, lon: data.longitude, name }
      }
    }
  } catch {
    /* try fallback */
  }

  try {
    const res = await fetch('https://ipwho.is/')
    if (!res.ok) return null
    const data = (await res.json()) as {
      success?: boolean
      latitude?: number
      longitude?: number
    }
    if (!data.success || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
      return null
    }
    const name = await reverseName(data.latitude, data.longitude)
    if (!isUsablePlaceName(name)) return null
    return { lat: data.latitude, lon: data.longitude, name }
  } catch {
    return null
  }
}

async function placeFromCoords(
  lat: number,
  lon: number,
  fallbackName = ''
): Promise<WeatherPlace> {
  const name = (await reverseName(lat, lon)) || fallbackName
  return { name: isUsablePlaceName(name) ? name : '北京', lat, lon }
}

export function loadWeatherPref(): WeatherPref {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (!raw) return { mode: 'auto' }
    const data = JSON.parse(raw) as Partial<WeatherPref>
    if (
      data.mode === 'manual' &&
      data.place &&
      typeof data.place.lat === 'number' &&
      typeof data.place.lon === 'number' &&
      isUsablePlaceName(data.place.name)
    ) {
      return { mode: 'manual', place: data.place }
    }
    return { mode: 'auto' }
  } catch {
    return { mode: 'auto' }
  }
}

export function saveWeatherPref(pref: WeatherPref) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(pref))
  } catch {
    /* ignore */
  }
}

function samePlace(a: WeatherPlace, b: WeatherPlace): boolean {
  return Math.abs(a.lat - b.lat) < 0.02 && Math.abs(a.lon - b.lon) < 0.02
}

function hasCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value)
}

function dedupePlaces(places: WeatherPlace[]): WeatherPlace[] {
  const seen = new Set<string>()
  const result: WeatherPlace[] = []
  for (const place of places) {
    if (!isUsablePlaceName(place.name)) continue
    const key = `${place.name}|${place.lat.toFixed(2)},${place.lon.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(place)
  }
  return result
}

async function searchOpenMeteo(query: string): Promise<WeatherPlace[]> {
  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
    url.searchParams.set('name', query)
    url.searchParams.set('count', '8')
    url.searchParams.set('language', 'zh')
    url.searchParams.set('format', 'json')
    const res = await fetch(url)
    if (!res.ok) return []
    const data = (await res.json()) as {
      results?: Array<{
        name?: string
        latitude?: number
        longitude?: number
        admin1?: string
        admin2?: string
        country?: string
      }>
    }
    return (data.results || [])
      .filter(
        (hit): hit is typeof hit & { latitude: number; longitude: number } =>
          typeof hit.latitude === 'number' && typeof hit.longitude === 'number'
      )
      .map((hit) => {
        const name = formatOpenMeteoPlace(hit) || normalizePlaceName(hit.name || query)
        const extra =
          (hit.admin1 && !name.includes(hit.admin1) ? hit.admin1 : '') ||
          (hit.country && hit.country !== '中国' && hit.country !== 'China' ? hit.country : '')
        return {
          name: extra ? `${name} · ${extra}` : name,
          lat: hit.latitude,
          lon: hit.longitude
        }
      })
  } catch {
    return []
  }
}

async function searchNominatim(query: string): Promise<WeatherPlace[]> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('q', query)
    url.searchParams.set('accept-language', 'zh-CN')
    url.searchParams.set('limit', '8')
    url.searchParams.set('addressdetails', '1')
    if (hasCjk(query)) url.searchParams.set('countrycodes', 'cn,hk,mo,tw')
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Whaletide/0.3.0 (desktop weather widget)' }
    })
    if (!res.ok) return []
    const data = (await res.json()) as Array<{
      lat?: string
      lon?: string
      name?: string
      display_name?: string
      address?: {
        city?: string
        town?: string
        county?: string
        district?: string
        suburb?: string
        state?: string
      }
    }>
    return data
      .map((hit) => {
        const lat = Number(hit.lat)
        const lon = Number(hit.lon)
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
        const name =
          formatNominatimPlace(hit) ||
          normalizePlaceName(hit.name || '') ||
          normalizePlaceName((hit.display_name || '').split(',')[0] || '')
        return name ? { name, lat, lon } : null
      })
      .filter((place): place is WeatherPlace => place !== null)
  } catch {
    return []
  }
}

async function searchPhoton(query: string): Promise<WeatherPlace[]> {
  try {
    const url = new URL('https://photon.komoot.io/api/')
    url.searchParams.set('q', query)
    url.searchParams.set('lang', 'zh')
    url.searchParams.set('limit', '8')
    if (hasCjk(query)) {
      url.searchParams.set('lat', '35')
      url.searchParams.set('lon', '105')
    }
    const res = await fetch(url)
    if (!res.ok) return []
    const data = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: number[] }
        properties?: {
          name?: string
          city?: string
          county?: string
          district?: string
          state?: string
          country?: string
        }
      }>
    }
    return (data.features || [])
      .map((feature) => {
        const coords = feature.geometry?.coordinates
        const lon = coords?.[0]
        const lat = coords?.[1]
        if (typeof lat !== 'number' || typeof lon !== 'number') return null
        const props = feature.properties
        const name = formatOpenMeteoPlace({
          name: props?.name,
          admin1: props?.state,
          admin2: props?.district || props?.county || props?.city
        }) || normalizePlaceName(props?.name || props?.city || '')
        return name ? { name, lat, lon } : null
      })
      .filter((place): place is WeatherPlace => place !== null)
  } catch {
    return []
  }
}

export async function searchPlaces(query: string): Promise<WeatherPlace[]> {
  const q = query.trim()
  if (!q) return []

  const local = searchChinaPlaces(q)
  const [photon, nominatim, openMeteo] = await Promise.all([
    searchPhoton(q),
    searchNominatim(q),
    searchOpenMeteo(q)
  ])
  return dedupePlaces([...local, ...photon, ...nominatim, ...openMeteo]).slice(0, 8)
}

async function resolvePlace(cached?: WeatherPlace): Promise<WeatherPlace> {
  const fallbackName = isUsablePlaceName(cached?.name) ? cached!.name : ''

  const geo = await locateByGeo()
  if (geo) {
    const place = await placeFromCoords(geo.lat, geo.lon, fallbackName)
    if (isUsablePlaceName(place.name)) return place
  }

  const ip = await locateByIp()
  if (ip) return { name: ip.name, lat: ip.lat, lon: ip.lon }

  if (cached) {
    const place = await placeFromCoords(cached.lat, cached.lon, fallbackName)
    if (isUsablePlaceName(place.name)) return place
  }

  return { name: '北京', lat: 39.9042, lon: 116.4074 }
}

function parseChinaTemp(value?: string): number {
  const match = value?.match(/-?\d+/)
  return match ? Number(match[0]) : 0
}

function chinaTypeToCode(type = ''): number {
  if (type.includes('雷')) return 95
  if (type.includes('雪')) return 71
  if (type.includes('雨')) return 61
  if (type.includes('雾')) return 45
  if (type.includes('晴')) return 0
  if (type.includes('云')) return 2
  return 3
}

async function loadChinaCityWeather(place: WeatherPlace): Promise<WeatherSnapshot | null> {
  const cityCode = place.cityCode || findChinaCityCode(place.name)
  if (!cityCode) return null

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`https://t.weather.itboy.net/api/weather/city/${cityCode}`, {
      signal: controller.signal
    })
    clearTimeout(timer)
    if (!res.ok) return null

    const data = (await res.json()) as {
      status?: number
      cityInfo?: { city?: string }
      data?: {
        wendu?: string
        shidu?: string
        quality?: string
        forecast?: Array<{
          ymd?: string
          high?: string
          low?: string
          type?: string
          notice?: string
          fx?: string
          fl?: string
        }>
      }
    }
    if (data.status !== 200 || !data.data?.forecast?.length) return null

    const forecast = data.data.forecast
    const today = forecast[0]
    const humidity = Number.parseInt(data.data.shidu || '', 10)
    const windMatch = today?.fl?.match(/\d+/)
    const days: WeatherDay[] = forecast.slice(0, 3).map((day) => ({
      date: day.ymd || '',
      code: chinaTypeToCode(day.type),
      tMax: parseChinaTemp(day.high),
      tMin: parseChinaTemp(day.low),
      condition: day.type
    }))

    return {
      place: {
        ...place,
        name: isUsablePlaceName(place.name)
          ? place.name
          : data.cityInfo?.city?.replace(/市$/, '') || place.name,
        cityCode
      },
      temp: Number.parseInt(data.data.wendu || '', 10) || parseChinaTemp(today?.high),
      feels: Number.parseInt(data.data.wendu || '', 10) || parseChinaTemp(today?.high),
      humidity: Number.isFinite(humidity) ? humidity : 0,
      wind: windMatch ? Number(windMatch[0]) : 0,
      windUnit: 'level',
      code: chinaTypeToCode(today?.type),
      condition: today?.type,
      quality: data.data.quality,
      notice: today?.notice,
      days,
      updatedAt: Date.now()
    }
  } catch {
    return null
  }
}

export async function loadWeather(force = false): Promise<WeatherSnapshot> {
  const cached = readCache()
  const pref = loadWeatherPref()
  const resolved =
    pref.mode === 'manual' && pref.place
      ? pref.place
      : await resolvePlace(cached?.place)
  const place = {
    ...resolved,
    cityCode: resolved.cityCode || findChinaCityCode(resolved.name)
  }

  if (
    !force &&
    cached &&
    Date.now() - cached.updatedAt < CACHE_MS &&
    samePlace(cached.place, place)
  ) {
    return { ...cached, place }
  }

  const china = await loadChinaCityWeather(place)
  if (china) {
    writeCache(china)
    return china
  }

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
    windUnit: 'kmh',
    code: data.current?.weather_code ?? 0,
    days,
    updatedAt: Date.now()
  }
  writeCache(snapshot)
  return snapshot
}

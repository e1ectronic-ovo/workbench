import { findChinaPlace, nearestChinaPlace, searchChinaPlaces } from './china-places'

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
  /** 相对湿度 %；-1 表示数据源没有提供（境外城市只有预报） */
  humidity: number
  /** 风速：windUnit=level 时是风力等级，否则 km/h；-1 表示没有 */
  wind: number
  code: number
  days: WeatherDay[]
  updatedAt: number
  condition?: string
  quality?: string
  notice?: string
  windUnit?: 'kmh' | 'level'
}

/** v2：换了数据源（中国天气网），旧的 itboy 缓存直接作废 */
const CACHE_KEY = 'workbench.weather.v2'
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

/**
 * 经纬度 → 可用的地点。名字一律换成国内口径的简体地名（反查服务常给繁体或英文），
 * 城市码优先取区县级精确匹配，兜底用内置城市表里最近的那个。
 */
async function placeFromCoords(
  lat: number,
  lon: number,
  fallbackName = ''
): Promise<WeatherPlace> {
  const name = fallbackName || (await reverseName(lat, lon))
  const district = await districtChinaPlace(name)
  const nearest = nearestChinaPlace(lat, lon)
  const canonical = district ? null : await canonicalChinaPlace(name)
  const cityCode = district?.cityCode ?? canonical?.cityCode ?? nearest?.cityCode
  const display =
    district?.name ||
    canonical?.name ||
    nearest?.name ||
    (isUsablePlaceName(name) ? name : '')

  return {
    name: isUsablePlaceName(display) ? display : '北京',
    lat,
    lon,
    cityCode
  }
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
  // 城市码最可靠；两边都没有码（境外地名）时才比经纬度
  if (a.cityCode && b.cityCode) return a.cityCode === b.cityCode
  if (hasCoords(a) && hasCoords(b)) {
    return Math.abs(a.lat - b.lat) < 0.02 && Math.abs(a.lon - b.lon) < 0.02
  }
  return a.name === b.name
}

function hasCoords(place: WeatherPlace): boolean {
  return Math.abs(place.lat) > 0.01 || Math.abs(place.lon) > 0.01
}

function hasCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value)
}

function dedupePlaces(places: WeatherPlace[]): WeatherPlace[] {
  const seen = new Set<string>()
  const result: WeatherPlace[] = []
  for (const place of places) {
    if (!isUsablePlaceName(place.name)) continue
    // 有城市码就按码去重：内置表带经纬度，同码时它排在前面，优先保留
    const key = place.cityCode
      ? `c:${place.cityCode}`
      : `n:${place.name}|${place.lat.toFixed(2)},${place.lon.toFixed(2)}`
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

  // 国内优先：内置城市表秒出，再补中国天气网的搜索结果（覆盖到区县和街道/镇）
  const local = searchChinaPlaces(q)
  const domestic = await searchChinaWeather(q)
  if (local.length || domestic.length) {
    return rankByQuery(dedupePlaces([...local, ...domestic]), q).slice(0, 8)
  }

  // 国内接口都没有结果（大概率是境外地名）才回落到国外的地理编码
  const [photon, nominatim, openMeteo] = await Promise.all([
    searchPhoton(q),
    searchNominatim(q),
    searchOpenMeteo(q)
  ])
  return rankByQuery(dedupePlaces([...photon, ...nominatim, ...openMeteo]), q).slice(0, 8)
}

async function resolvePlace(cached?: WeatherPlace): Promise<WeatherPlace> {
  const fallbackName = isUsablePlaceName(cached?.name) ? cached!.name : ''

  const geo = await locateByGeo()
  if (geo) {
    const place = await placeFromCoords(geo.lat, geo.lon)
    if (isUsablePlaceName(place.name)) return place
  }

  const ip = await locateByIp()
  if (ip) return placeFromCoords(ip.lat, ip.lon, ip.name)

  if (cached) {
    const place = await placeFromCoords(cached.lat, cached.lon, fallbackName)
    if (isUsablePlaceName(place.name)) return place
  }

  return { name: '北京', lat: 39.9042, lon: 116.4074, cityCode: '101010100' }
}

// ── 中国天气网（weather.com.cn） ──────────────────────────────
//
// 数据从主进程代取（`window.workbench.weather`），接口要 Referer、也不给 CORS 头。
// 实况在 `dataSK`，五天预报在 `fc.f`，今日概况在 `cityDZ`，预警在 `alarmDZ.w`。

/** 02 阴，03 阵雨 … 官方编码表，带 d/n 前缀（白天/夜间） */
const CN_CONDITIONS: Record<string, string> = {
  '00': '晴',
  '01': '多云',
  '02': '阴',
  '03': '阵雨',
  '04': '雷阵雨',
  '05': '雷阵雨伴有冰雹',
  '06': '雨夹雪',
  '07': '小雨',
  '08': '中雨',
  '09': '大雨',
  '10': '暴雨',
  '11': '大暴雨',
  '12': '特大暴雨',
  '13': '阵雪',
  '14': '小雪',
  '15': '中雪',
  '16': '大雪',
  '17': '暴雪',
  '18': '雾',
  '19': '冻雨',
  '20': '沙尘暴',
  '21': '小到中雨',
  '22': '中到大雨',
  '23': '大到暴雨',
  '24': '暴雨到大暴雨',
  '25': '大暴雨到特大暴雨',
  '26': '小到中雪',
  '27': '中到大雪',
  '28': '大到暴雪',
  '29': '浮尘',
  '30': '扬沙',
  '31': '强沙尘暴',
  '32': '浓雾',
  '49': '强阵雨',
  '53': '霾',
  '54': '晴',
  '55': '多云',
  '56': '阴',
  '57': '阵雨',
  '58': '小雨',
  '99': '未知'
}

function cnKey(code?: string): string {
  return (code || '').replace(/^[a-z]/i, '').padStart(2, '0')
}

function cnConditionText(code?: string): string | undefined {
  const text = CN_CONDITIONS[cnKey(code)]
  return text && text !== '未知' ? text : undefined
}

/** 官方编码 → 本文件内部用的 WMO 风格编码（决定提示语里的雨雪判断） */
function cnConditionCode(code?: string): number {
  const n = Number(cnKey(code))
  if (!Number.isFinite(n)) return 3
  if (n === 0 || n === 54) return 0
  if (n === 1 || n === 55) return 2
  if (n === 2 || n === 56) return 3
  if (n === 3 || n === 49 || n === 57) return 80
  if (n === 4 || n === 5) return 95
  if (n >= 6 && n <= 12) return 61
  if (n === 13) return 85
  if (n >= 14 && n <= 17) return 71
  if (n === 18 || n === 32 || n === 53) return 45
  if (n === 19) return 61
  if (n >= 20 && n <= 31) return 45
  if (n >= 21 && n <= 25) return 61
  if (n >= 26 && n <= 28) return 71
  if (n === 58) return 61
  return 3
}

/** 「10/29」→「2026-10-29」，跨年时补到下一年 */
function cnDateIso(raw?: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec((raw || '').trim())
  if (!m) return ''
  const month = Number(m[1])
  const day = Number(m[2])
  const now = new Date()
  let year = now.getFullYear()
  if (new Date(year, month - 1, day).getTime() < now.getTime() - 30 * 86400000) year += 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function aqiQuality(aqi?: number): string | undefined {
  if (typeof aqi !== 'number' || !Number.isFinite(aqi)) return undefined
  if (aqi <= 50) return '优'
  if (aqi <= 100) return '良'
  if (aqi <= 150) return '轻度污染'
  if (aqi <= 200) return '中度污染'
  if (aqi <= 300) return '重度污染'
  return '严重污染'
}

function toInt(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? Math.round(n) : fallback
}

/** 把 `var a = {...};var b = {...}` 拆成对象表，单块坏了不影响其他块 */
function parseCnVars(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const chunk of text.split(/\bvar\s+/)) {
    const eq = chunk.indexOf('=')
    if (eq < 0) continue
    const name = chunk.slice(0, eq).trim()
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) continue
    const body = chunk
      .slice(eq + 1)
      .trim()
      .replace(/;$/, '')
      .trim()
    try {
      out[name] = JSON.parse(body)
    } catch {
      /* 跳过这一块 */
    }
  }
  return out
}

interface ChinaToday {
  condition?: string
  code: number
  tMax: number
  tMin: number
  wind: number
}

/** 街道/镇只有当天的天气（dingzhi 接口，没有实况、没有预报） */
async function loadChinaToday(code: string): Promise<ChinaToday | null> {
  const bridge = window.workbench?.weather
  if (!bridge) return null
  try {
    const res = await bridge.fetchToday(code)
    if (!res.ok || !res.text) return null
    const vars = parseCnVars(res.text)
    // 变量名带编码后缀：var cityDZ101101111001={...}
    const entry = Object.entries(vars).find(([name]) => name.startsWith('cityDZ'))
    const info = (entry?.[1] as { weatherinfo?: Record<string, unknown> } | undefined)?.weatherinfo
    if (!info) return null
    const tMax = toInt(info.temp)
    const tMin = toInt(info.tempn)
    if (!tMax && !tMin) return null
    return {
      condition: typeof info.weather === 'string' ? info.weather.trim() : undefined,
      code: cnConditionCode(String(info.weathercode ?? '')),
      tMax,
      tMin,
      wind: toInt(info.ws, -1)
    }
  } catch {
    return null
  }
}

function isoToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function loadChinaWeather(
  place: WeatherPlace,
  cityCode: string
): Promise<WeatherSnapshot | null> {
  const bridge = window.workbench?.weather
  if (!bridge) return null

  // 12 位是街道/镇：当天数据取它自己的，实况和未来几天只能取所属区县（前 9 位）
  const township = cityCode.length === 12 ? await loadChinaToday(cityCode) : null
  const countyCode = cityCode.length === 12 ? cityCode.slice(0, 9) : cityCode

  const res = await bridge.fetchIndex(countyCode)
  const vars = res.ok && res.text ? parseCnVars(res.text) : {}
  const sk = (vars.dataSK ?? {}) as Record<string, unknown>
  const dzInfo = ((vars.cityDZ as { weatherinfo?: Record<string, unknown> } | undefined)
    ?.weatherinfo ?? {}) as Record<string, unknown>
  const fcList = ((vars.fc as { f?: Array<Record<string, unknown>> } | undefined)?.f ??
    []) as Array<Record<string, unknown>>

  const days: WeatherDay[] = fcList.slice(0, 3).map((day) => ({
    date: cnDateIso(String(day.fi ?? '')),
    code: cnConditionCode(String(day.fa ?? '')),
    tMax: toInt(day.fc),
    tMin: toInt(day.fd),
    condition: cnConditionText(String(day.fa ?? ''))
  }))

  // 今天这一天用乡镇自己的预报覆盖，后面的日子沿用区县
  if (township) {
    const today: WeatherDay = {
      date: days[0]?.date || isoToday(),
      code: township.code,
      tMax: township.tMax || days[0]?.tMax || 0,
      tMin: township.tMin || days[0]?.tMin || 0,
      condition: township.condition
    }
    if (days.length) days[0] = today
    else days.push(today)
  }

  if (!days.length && !sk.temp) return null

  const hasCurrent = sk.temp !== undefined && sk.temp !== ''
  const temp = hasCurrent ? toInt(sk.temp) : (days[0]?.tMax ?? 0)

  const condition =
    township?.condition ||
    (typeof sk.weather === 'string' && sk.weather.trim()) ||
    (days[0]?.condition as string | undefined) ||
    (typeof dzInfo.weather === 'string' ? dzInfo.weather : undefined)

  const code = township
    ? township.code
    : sk.weathercode
      ? cnConditionCode(String(sk.weathercode))
      : textToCode(condition)

  const alarms = ((vars.alarmDZ as { w?: Array<Record<string, unknown>> } | undefined)?.w ??
    []) as Array<Record<string, unknown>>
  const alarm = alarms[0]
  const alarmText =
    alarm && (alarm.w5 || alarm.w7)
      ? `${String(alarm.w5 ?? '')}${String(alarm.w7 ?? '')}预警`
      : ''

  return {
    place: {
      ...place,
      name: isUsablePlaceName(place.name)
        ? place.name
        : String(sk.cityname ?? dzInfo.city ?? place.name ?? ''),
      cityCode
    },
    temp,
    // 官方接口不给体感温度，用实况温度顶上
    feels: temp,
    // 境外城市、街道/镇都没有 dataSK 实况，湿度/风速记 -1，界面据此隐藏
    humidity: hasCurrent ? toInt(sk.SD) : -1,
    wind: hasCurrent ? toInt(sk.WS) : township ? township.wind : -1,
    windUnit: 'level',
    code,
    condition,
    quality: hasCurrent ? aqiQuality(toInt(sk.aqi, Number.NaN)) : undefined,
    notice: alarmText || undefined,
    days,
    updatedAt: Date.now()
  }
}

/** 只有文字没有编码时（个别字段缺失）按关键字兜底 */
function textToCode(text?: string): number {
  const value = text ?? ''
  if (value.includes('雷')) return 95
  if (value.includes('雪')) return 71
  if (value.includes('雨')) return 61
  if (value.includes('雾') || value.includes('霾') || value.includes('沙')) return 45
  if (value.includes('晴')) return 0
  if (value.includes('云')) return 2
  return 3
}

/** 国内城市搜索：返回的 ref 是 `城市码~省拼音~名字~英文名~上级区县~…~省份` */
async function searchChinaWeather(query: string): Promise<WeatherPlace[]> {
  const bridge = window.workbench?.weather
  if (!bridge) return []
  try {
    const res = await bridge.search(query)
    if (!res.ok || !res.text) return []
    const body = res.text
      .trim()
      .replace(/^\(/, '')
      .replace(/\)\s*$/, '')
    const list = JSON.parse(body) as Array<{ ref?: string }>
    if (!Array.isArray(list)) return []

    const places: WeatherPlace[] = []
    for (const item of list) {
      const fields = (item?.ref ?? '').split('~')
      const code = (fields[0] ?? '').trim()
      const name = (fields[2] ?? '').trim()
      // 9 位是市/区县，12 位是街道/镇；11 位的景点码取不到数据，跳过
      if (!/^\d{9}(\d{3})?$/.test(code) || !isUsablePlaceName(name)) continue
      const county = (fields[4] ?? '').trim()
      const province = (fields[9] ?? '').trim()
      // 乡镇用上级区县标注（同名街道很多），市区用省份标注
      const suffix = code.length === 12 ? county || province : province
      const label =
        suffix && !name.includes(suffix) && suffix !== name ? `${name} · ${suffix}` : name
      places.push({ name: label, lat: 0, lon: 0, cityCode: code })
    }
    return places.slice(0, 8)
  } catch {
    return []
  }
}

/** 完全同名的排前面（搜「福田保税区」时别被「福田」挤到后面），其余保持原顺序 */
function rankByQuery(places: WeatherPlace[], query: string): WeatherPlace[] {
  const q = query.trim()
  if (!q) return places
  const rank = (name: string): number => {
    const bare = name.replace(/ · .*$/, '')
    return bare === q ? 0 : bare.startsWith(q) ? 1 : 2
  }
  return [...places].sort((a, b) => rank(a.name) - rank(b.name))
}

/** 名字 → 简体名 + 城市码：内置表优先，其次国内搜索 */
async function canonicalChinaPlace(
  name: string
): Promise<{ name: string; cityCode?: string }> {
  const local = findChinaPlace(name)
  if (local) return { name: local.name, cityCode: local.cityCode }
  if (!isUsablePlaceName(name)) return { name }
  const hits = await searchChinaWeather(name.split(/[·,，\s]/)[0] ?? name)
  const hit = hits[0]
  if (!hit) return { name }
  return { name: hit.name.replace(/ · .*$/, ''), cityCode: hit.cityCode }
}

/**
 * 反查出来的名字常常是「城市 区县」（如「杭州 余杭区」），末尾那段如果能在国内
 * 搜索里精确命中，就保留区县级精度；命中不了（繁体、境外、乡镇）就放弃。
 */
async function districtChinaPlace(name: string): Promise<WeatherPlace | undefined> {
  const tokens = name.split(/[\s,，·]+/).filter(Boolean)
  if (tokens.length < 2) return undefined
  const token = tokens[tokens.length - 1]
  if (!token || token.length < 2) return undefined
  const hits = await searchChinaWeather(token)
  const bare = token.replace(/市$|区$|县$/, '')
  const hit = hits.find(
    (item) => item.name.replace(/ · .*$/, '').replace(/市$|区$|县$/, '') === bare
  )
  return hit ? { ...hit, name: hit.name.replace(/ · .*$/, '') } : undefined
}


/** 搜索列表里用「名字 · 省份」区分同名地点，卡片上只要名字 */
function shortPlaceName(name: string): string {
  return name.split(' · ')[0]?.trim() || name
}

export async function loadWeather(force = false): Promise<WeatherSnapshot> {
  const cached = readCache()
  const pref = loadWeatherPref()
  const resolved =
    pref.mode === 'manual' && pref.place
      ? pref.place
      : await resolvePlace(cached?.place)
  const cityCode = resolved.cityCode || (await canonicalChinaPlace(resolved.name)).cityCode
  const place: WeatherPlace = { ...resolved, name: shortPlaceName(resolved.name), cityCode }

  if (
    !force &&
    cached &&
    Date.now() - cached.updatedAt < CACHE_MS &&
    samePlace(cached.place, place)
  ) {
    return { ...cached, place }
  }

  if (cityCode) {
    const china = await loadChinaWeather(place, cityCode)
    if (china) {
      writeCache(china)
      return china
    }
  }

  // 没有城市码（境外）或国内接口暂时不可用时，才退回 open-meteo
  if (!hasCoords(place)) {
    if (cached) return cached
    throw new Error('天气请求失败')
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

import { ipcMain } from 'electron'

/**
 * 天气数据走**中国天气网**（weather.com.cn）的公开接口 —— 官方页面自己在用的那两个：
 *
 * - `d1.weather.com.cn/weather_index/{9 位城市码}.html` 实况 + 未来 5 天
 * - `d1.weather.com.cn/dingzhi/{12 位乡镇码}.html` 街道/镇**当天**的天气（没有实况，没有预报）
 * - `toy1.weather.com.cn/search?cityname=xx` 城市搜索（返回 `([{"ref":"城市码~省~名字~…"}])`）
 *
 * 这两个接口都要带 `Referer: weather.com.cn` 才给数据（否则 403），而 Referer 是
 * 浏览器侧的禁止头，渲染进程的 fetch 改不了，所以统一从主进程取，顺带绕开 CORS。
 *
 * 主进程的 fetch 不走系统代理，访问国内站正好不需要。
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/126.0.0.0 Safari/537.36'

const REFERER = 'http://www.weather.com.cn/weather1d/101010100.shtml'
const TIMEOUT_MS = 8000

/** 只认 9 位城市码；11/12 位的景点、街道码在 weather_index 上会 302 到 404 页 */
const CITY_CODE = /^\d{9}$/
/** 街道/镇是 12 位，只有 dingzhi 接口（当天天气）认 */
const TOWNSHIP_CODE = /^\d{12}$/
const MAX_QUERY = 40

export interface WeatherFetchResult {
  ok: boolean
  text?: string
  error?: string
}

async function getText(url: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Referer: REFERER,
        Accept: '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9'
      }
    })
    if (!res.ok) throw new Error(`接口返回 ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return '请求超时'
    return error.message
  }
  return String(error)
}

export function registerWeatherIpc(): void {
  ipcMain.handle(
    'weather:fetch',
    async (_e, payload: { kind?: string; key?: string }): Promise<WeatherFetchResult> => {
      const kind = payload?.kind
      const key = (payload?.key ?? '').trim()
      if (!key) return { ok: false, error: '缺少参数' }

      try {
        if (kind === 'index') {
          if (!CITY_CODE.test(key)) return { ok: false, error: '城市编码无效' }
          const text = await getText(
            `http://d1.weather.com.cn/weather_index/${key}.html?_=${Date.now()}`
          )
          return { ok: true, text }
        }

        // 街道/镇的当天天气；9 位码也认，方便统一调用
        if (kind === 'today') {
          if (!CITY_CODE.test(key) && !TOWNSHIP_CODE.test(key)) {
            return { ok: false, error: '城市编码无效' }
          }
          const text = await getText(`http://d1.weather.com.cn/dingzhi/${key}.html?_=${Date.now()}`)
          return { ok: true, text }
        }

        if (kind === 'search') {
          if (key.length > MAX_QUERY) return { ok: false, error: '关键词过长' }
          const text = await getText(
            `http://toy1.weather.com.cn/search?cityname=${encodeURIComponent(key)}`
          )
          return { ok: true, text }
        }

        return { ok: false, error: '未知请求' }
      } catch (error) {
        return { ok: false, error: describe(error) }
      }
    }
  )
}

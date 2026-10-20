import type { ProxySubscriptionInfo, ProxySubscriptionUsage } from '../../common/proxy'

export interface SubscriptionMeta extends ProxySubscriptionInfo {
  /** 订阅响应头里声明的名称；没有时为空 */
  name: string
}

function hasControlCharacters(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31)) return true
  }
  return false
}

function hasNonAscii(value: string): boolean {
  for (const char of value) {
    if ((char.codePointAt(0) ?? 0) > 0x7f) return true
  }
  return false
}

function decodeBase64(value: string): string | null {
  const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/')
  if (!normalized || normalized.length % 4 === 1) return null
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return null

  try {
    const decoded = Buffer.from(normalized, 'base64').toString('utf8').trim()
    if (!decoded || decoded.includes('\uFFFD') || hasControlCharacters(decoded)) return null
    return decoded
  } catch {
    return null
  }
}

/**
 * 名称可能来自 Profile-Title，也可能是 Content-Disposition 的 filename。
 * 部分机场会把中文标题做 URL 编码或 base64，两种都尽量还原。
 */
function decodeHeaderText(value: string): string {
  let text = value.trim()
  if (!text) return ''

  if (/^base64:/i.test(text)) return decodeBase64(text.slice(7)) ?? ''

  // RFC 5987: UTF-8''%E6%9C%BA%E5%9C%BA
  if (/^utf-8''/i.test(text)) text = text.slice(7)
  try {
    text = decodeURIComponent(text)
  } catch {
    /* 保留原值 */
  }

  if (/[=]$/.test(text) || text.length >= 8) {
    const decoded = decodeBase64(text)
    if (decoded && (hasNonAscii(decoded) || /={1,2}$/.test(text))) return decoded
  }
  return text
}

function fileNameFromDisposition(value: string): string {
  if (!value) return ''

  const encoded = value.match(/filename\*\s*=\s*(?:"([^"]+)"|([^;]+))/i)
  if (encoded) {
    const name = decodeHeaderText((encoded[1] ?? encoded[2] ?? '').trim())
    if (name) return name
  }

  const plain = value.match(/filename\s*=\s*(?:"([^"]+)"|([^;]+))/i)
  return decodeHeaderText((plain?.[1] ?? plain?.[2] ?? '').trim())
}

function parseUsage(value: string): ProxySubscriptionUsage | null {
  if (!value.trim()) return null

  const fields = new Map<string, number>()
  for (const part of value.split(/[;,]/)) {
    const [rawKey, rawValue] = part.split('=', 2)
    const key = rawKey?.trim().toLowerCase()
    if (!key || rawValue === undefined) continue
    const number = Number(rawValue.trim())
    if (Number.isFinite(number)) fields.set(key, number)
  }

  if (!fields.size) return null

  const upload = Math.max(0, fields.get('upload') ?? 0)
  const download = Math.max(0, fields.get('download') ?? 0)
  const total = fields.has('total') ? Math.max(0, fields.get('total') ?? 0) : -1
  const rawExpire = Math.max(0, fields.get('expire') ?? 0)
  // 少数服务端误把毫秒时间戳放进 expire，这里统一成秒。
  const expire = rawExpire > 100_000_000_000 ? Math.floor(rawExpire / 1000) : rawExpire

  return { upload, download, total, expire }
}

function nameFromUrl(url: string): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    const hash = decodeURIComponent(parsed.hash.replace(/^#/, '')).trim()
    return hash
  } catch {
    return ''
  }
}

function isValidHomeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

/** 解析 Clash / Clash Verge / Surge 常见的订阅响应头 */
export function parseSubscriptionMeta(headers: Headers, url = ''): SubscriptionMeta {
  const title = decodeHeaderText(headers.get('profile-title') ?? '')
  const dispositionName = fileNameFromDisposition(headers.get('content-disposition') ?? '')
  const usage = parseUsage(headers.get('subscription-userinfo') ?? '')
  const homeUrl = (headers.get('profile-web-page-url') ?? '').trim()
  const interval = Number(headers.get('profile-update-interval') ?? 0)

  return {
    name: title || dispositionName || nameFromUrl(url),
    usage,
    homeUrl: isValidHomeUrl(homeUrl) ? homeUrl : '',
    updateInterval: Number.isFinite(interval) && interval > 0 ? interval : 0
  }
}

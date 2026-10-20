import { writeFileSync } from 'fs'
import type { ProxySettings, ProxySubscriptionInfo } from '../../common/proxy'
import { proxyFilePath } from './settings'
import { parseSubscriptionMeta } from './subscription'

const CONFIG_FILE = 'config.yaml'

const SUBSCRIPTION_UA = 'clash-verge/v2.3.2'

export interface FetchedSubscription {
  text: string
  /** 响应头中的订阅名称，供自动命名使用 */
  name: string
  subscription: ProxySubscriptionInfo
}

export function configPath(): string {
  return proxyFilePath(CONFIG_FILE)
}

/** 统计 proxies 段里的节点条数；兼容 2/4 空格两种缩进 */
export function countProxies(yaml: string): number {
  const lines = yaml.split(/\r?\n/)
  let inside = false
  let indent = -1
  let count = 0

  for (const line of lines) {
    if (/^proxies\s*:/.test(line)) {
      inside = true
      continue
    }
    if (!inside) continue
    if (!line.trim()) continue
    if (/^\S/.test(line)) break // 下一个顶层键，说明这一段结束了

    const match = line.match(/^(\s*)-\s/)
    if (!match) continue
    if (indent === -1) indent = match[1].length
    if (match[1].length === indent) count++
  }

  return count
}

/** Clash / mihomo 配置的关键顶层字段特征 */
export function looksLikeClashConfig(text: string): boolean {
  return /^\s*proxies\s*:/m.test(text) || /^\s*proxy-groups\s*:/m.test(text)
}

function tryDecodeBase64(text: string): string | null {
  const compact = text.replace(/\s+/g, '')
  if (compact.length < 24 || !/^[A-Za-z0-9+/=_=-]+$/.test(compact)) return null
  try {
    const decoded = Buffer.from(compact, 'base64').toString('utf8')
    if (!decoded || decoded.includes('\u0000')) return null
    return decoded
  } catch {
    return null
  }
}

/**
 * 拉取订阅并归一化成 Clash 配置文本。
 * 部分机场默认返回 base64 节点列表，这里尽量解码后再判断一次。
 */
export async function fetchSubscription(url: string): Promise<FetchedSubscription> {
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('订阅地址需要以 http:// 或 https:// 开头')
  }

  let response: Response
  try {
    response = await fetch(trimmed, {
      headers: {
        'User-Agent': SUBSCRIPTION_UA,
        Accept: 'text/yaml, text/plain, */*'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000)
    })
  } catch (e) {
    const reason = e instanceof Error && e.name === 'TimeoutError' ? '请求超时' : '网络不可达'
    throw new Error(`订阅下载失败：${reason}`)
  }

  if (!response.ok) {
    throw new Error(`订阅下载失败：服务器返回 ${response.status}`)
  }

  const metadata = parseSubscriptionMeta(response.headers, trimmed)
  const text = (await response.text()).trim()
  if (!text) throw new Error('订阅返回了空内容')

  if (looksLikeClashConfig(text)) {
    return { text, name: metadata.name, subscription: metadata }
  }

  const decoded = tryDecodeBase64(text)
  if (decoded && looksLikeClashConfig(decoded)) {
    return { text: decoded, name: metadata.name, subscription: metadata }
  }

  throw new Error('这不是 Clash 格式的订阅，请在机场后台选择「Clash」订阅链接')
}

function serializeScalar(value: string | number | boolean): string {
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return JSON.stringify(value)
}

/**
 * 只改写顶层标量键，其余内容（规则、策略组、DNS）原样保留。
 * YAML 顶层键不缩进，所以按行匹配足够安全，也省掉一个 yaml 依赖。
 */
export function applyOverrides(
  yaml: string,
  overrides: Record<string, string | number | boolean>
): string {
  let out = yaml.replace(/\r\n/g, '\n')
  for (const [key, value] of Object.entries(overrides)) {
    const line = `${key}: ${serializeScalar(value)}`
    const re = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:.*$`, 'm')
    if (re.test(out)) out = out.replace(re, () => line)
    else out = `${out.replace(/\s*$/, '')}\n${line}`
  }
  return `${out.replace(/\s*$/, '')}\n`
}

export function buildOverrides(settings: ProxySettings): Record<string, string | number | boolean> {
  return {
    'mixed-port': settings.mixedPort,
    // 局域网共享已废弃，固定只监听本机
    'allow-lan': false,
    'external-controller': `127.0.0.1:${settings.controllerPort}`,
    secret: settings.secret,
    mode: settings.mode,
    'log-level': 'warning'
  }
}

/** 把选中的配置叠加运行参数后写成 config.yaml，返回配置文件路径 */
export function writeConfig(settings: ProxySettings, profileText: string): string {
  const merged = applyOverrides(profileText, buildOverrides(settings))
  const file = configPath()
  writeFileSync(file, merged, 'utf8')
  return file
}

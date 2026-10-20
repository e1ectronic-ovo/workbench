import type { ProxyGroup, ProxyMode, ProxyNode } from '../../common/proxy'

interface RawProxy {
  type?: string
  now?: string
  all?: string[]
  alive?: boolean
  history?: { time?: string; delay?: number }[]
}

interface ProxiesPayload {
  proxies: Record<string, RawProxy>
}

interface RawConnection {
  upload?: number
  download?: number
  /** 出站链路：chains[0] 是实际出站（节点名或 DIRECT） */
  chains?: string[]
}

interface ConnectionsPayload {
  downloadTotal?: number
  uploadTotal?: number
  connections?: RawConnection[] | null
}

interface VersionPayload {
  version?: string
  meta?: boolean
}

const DELAY_TEST_URL = 'https://www.gstatic.com/generate_204'

export class MihomoClient {
  constructor(
    private readonly port: number,
    private readonly secret: string
  ) {}

  private url(path: string): string {
    return `http://127.0.0.1:${this.port}${path}`
  }

  private async request<T>(path: string, init?: RequestInit, timeoutMs = 5000): Promise<T> {
    const response = await fetch(this.url(path), {
      ...init,
      headers: {
        Authorization: `Bearer ${this.secret}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      },
      signal: AbortSignal.timeout(timeoutMs)
    })
    if (!response.ok) {
      throw new Error(`内核接口返回 ${response.status}（${path}）`)
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  async version(): Promise<VersionPayload> {
    return this.request<VersionPayload>('/version', undefined, 2500)
  }

  async connections(): Promise<ConnectionsPayload> {
    return this.request<ConnectionsPayload>('/connections')
  }

  async proxies(): Promise<ProxiesPayload> {
    return this.request<ProxiesPayload>('/proxies')
  }

  async setMode(mode: ProxyMode): Promise<void> {
    await this.request('/configs', { method: 'PATCH', body: JSON.stringify({ mode }) })
  }

  async select(group: string, node: string): Promise<void> {
    await this.request(`/proxies/${encodeURIComponent(group)}`, {
      method: 'PUT',
      body: JSON.stringify({ name: node })
    })
  }

  async delay(name: string, timeout = 4000): Promise<number> {
    const payload = await this.request<{ delay?: number }>(
      `/proxies/${encodeURIComponent(name)}/delay?timeout=${timeout}&url=${encodeURIComponent(DELAY_TEST_URL)}`,
      undefined,
      timeout + 2000
    )
    return typeof payload?.delay === 'number' ? payload.delay : -1
  }

  /** 触发订阅 provider 立即更新 */
  async updateProvider(name: string): Promise<void> {
    await this.request(`/providers/proxies/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify({})
    })
  }
}

function lastDelay(proxy: RawProxy | undefined): number {
  const history = proxy?.history
  if (!Array.isArray(history) || history.length === 0) return -1
  const last = history[history.length - 1]
  return typeof last?.delay === 'number' ? last.delay : -1
}

/** 从 /proxies 的结果里抽出策略组，GLOBAL 放到最后 */
export function toGroups(payload: ProxiesPayload): ProxyGroup[] {
  const all = payload?.proxies ?? {}
  const groups: ProxyGroup[] = []

  for (const [name, proxy] of Object.entries(all)) {
    if (!Array.isArray(proxy.all)) continue
    const type = proxy.type ?? 'Selector'
    groups.push({
      name,
      type,
      now: proxy.now ?? '',
      selectable: type === 'Selector' || type === 'Fallback',
      nodes: proxy.all.map<ProxyNode>((nodeName) => {
        const node = all[nodeName]
        return {
          name: nodeName,
          type: node?.type ?? '',
          delay: lastDelay(node),
          alive: node?.alive !== false
        }
      })
    })
  }

  groups.sort((a, b) => {
    if (a.name === 'GLOBAL') return 1
    if (b.name === 'GLOBAL') return -1
    if (a.selectable !== b.selectable) return a.selectable ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })

  return groups
}

export function pickActiveGroup(groups: ProxyGroup[]): ProxyGroup | null {
  return (
    groups.find((g) => g.selectable && g.name !== 'GLOBAL' && g.now) ??
    groups.find((g) => g.selectable && g.name !== 'GLOBAL') ??
    groups.find((g) => g.now) ??
    null
  )
}

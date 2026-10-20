/** 代理模块的跨进程共享类型与默认值。主进程与渲染进程都从这里取。 */

export type ProxyCoreStatus = 'stopped' | 'starting' | 'running' | 'error'

export type ProxyMode = 'rule' | 'global' | 'direct'

export type ProxyProfileSource = 'none' | 'subscription' | 'file'

export interface ProxySettings {
  /** 应用启动后自动连接内核 */
  enabledOnStart: boolean
  /** 自定义内核路径；为空时使用随应用分发的内置路径 */
  corePath: string
  /** 混合代理端口（HTTP + SOCKS） */
  mixedPort: number
  /** external-controller 端口，仅监听 127.0.0.1 */
  controllerPort: number
  /** REST 接口密钥，首次运行时随机生成 */
  secret: string
  mode: ProxyMode
  subscriptionUrl: string
  allowLan: boolean
  /** 连接时是否接管 Windows 系统代理 */
  systemProxy: boolean
}

export interface ProxyNode {
  name: string
  type: string
  /** 最近一次测速结果，-1 表示未知 */
  delay: number
  alive: boolean
}

export interface ProxyGroup {
  name: string
  type: string
  /** 当前选中的节点名 */
  now: string
  /** 只有 Selector / Fallback 类型能手动切换 */
  selectable: boolean
  nodes: ProxyNode[]
}

export interface ProxyTraffic {
  /** 上行字节/秒 */
  up: number
  /** 下行字节/秒 */
  down: number
  totalUp: number
  totalDown: number
  connections: number
}

export interface ProxyProfileInfo {
  source: ProxyProfileSource
  url: string
  updatedAt: string
  nodeCount: number
}

/** 一份配置文件（订阅或本地文件），可同时存在多份并切换 */
export interface ProxyProfile {
  id: string
  name: string
  source: 'subscription' | 'file'
  url: string
  updatedAt: string
  nodeCount: number
}

export interface ProxySnapshot {
  status: ProxyCoreStatus
  running: boolean
  starting: boolean
  error: string | null
  version: string | null
  coreReady: boolean
  corePath: string
  activeGroup: string
  activeNode: string
  activeDelay: number
  traffic: ProxyTraffic
  profile: ProxyProfileInfo
  /** 全部配置，供界面切换 */
  profiles: ProxyProfile[]
  activeProfileId: string
  settings: ProxySettings
  /** 系统代理当前是否指向本应用内核 */
  systemProxy: boolean
  nodeCount: number
  groupCount: number
}

export interface ProxyActionResult {
  ok: boolean
  error?: string
}

export interface ProxyTestProgress {
  group: string
  node: string
  delay: number
  tested: number
  total: number
  done: boolean
}

export const DEFAULT_MIXED_PORT = 7890
export const DEFAULT_CONTROLLER_PORT = 9090

export function emptyTraffic(): ProxyTraffic {
  return { up: 0, down: 0, totalUp: 0, totalDown: 0, connections: 0 }
}

export function emptyProfile(): ProxyProfileInfo {
  return { source: 'none', url: '', updatedAt: '', nodeCount: 0 }
}

export function defaultProxySettings(): ProxySettings {
  return {
    enabledOnStart: true,
    corePath: '',
    mixedPort: DEFAULT_MIXED_PORT,
    controllerPort: DEFAULT_CONTROLLER_PORT,
    secret: '',
    mode: 'rule',
    subscriptionUrl: '',
    allowLan: false,
    systemProxy: true
  }
}

/** 内核可执行文件名，按平台区分 */
export function coreBinaryName(platform: string): string {
  return platform === 'win32' ? 'mihomo.exe' : 'mihomo'
}

/** 代理模块的跨进程共享类型与默认值。主进程与渲染进程都从这里取。 */

export type ProxyCoreStatus = 'stopped' | 'starting' | 'running' | 'error'

export type ProxyMode = 'rule' | 'global' | 'direct'

export type ProxyProfileSource = 'none' | 'subscription' | 'file'

/** 机场订阅响应头里携带的流量信息；-1 表示响应里没有该字段 */
export interface ProxySubscriptionUsage {
  /** 已上传字节数 */
  upload: number
  /** 已下载字节数 */
  download: number
  /** 套餐总流量；0 表示不限量，-1 表示未知 */
  total: number
  /** 到期时间（Unix 秒）；0 表示未知或长期有效 */
  expire: number
}

/** 从订阅响应头解析出的附加信息 */
export interface ProxySubscriptionInfo {
  usage: ProxySubscriptionUsage | null
  /** 机场管理页，响应头未提供时为空 */
  homeUrl: string
  /** 建议更新间隔（小时）；0 表示未提供 */
  updateInterval: number
}

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
  /** 上行字节/秒（仅走代理节点的流量） */
  up: number
  /** 下行字节/秒（仅走代理节点的流量） */
  down: number
  /** 内核启动以来全部流量（含直连），仅供内部参考，不进界面 */
  totalUp: number
  totalDown: number
  /** 本次内核运行以来实际走代理节点的累计消耗（含已结束的连接），字节 */
  sessionUp: number
  sessionDown: number
  /** 正在走代理节点的连接数（直连不计入） */
  connections: number
}

export interface ProxyProfileInfo {
  name: string
  source: ProxyProfileSource
  url: string
  updatedAt: string
  nodeCount: number
  subscription: ProxySubscriptionInfo | null
}

/** 一份配置文件（订阅或本地文件），可同时存在多份并切换 */
export interface ProxyProfile {
  id: string
  name: string
  /** 名称是订阅自动读取的还是用户手动指定的 */
  nameSource?: 'auto' | 'manual'
  source: 'subscription' | 'file'
  url: string
  updatedAt: string
  nodeCount: number
  /** 订阅响应头里的名称、流量和到期信息；本地文件没有 */
  subscription?: ProxySubscriptionInfo
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
  return { up: 0, down: 0, totalUp: 0, totalDown: 0, sessionUp: 0, sessionDown: 0, connections: 0 }
}

export function emptyProfile(): ProxyProfileInfo {
  return {
    name: '',
    source: 'none',
    url: '',
    updatedAt: '',
    nodeCount: 0,
    subscription: null
  }
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

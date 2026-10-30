import type {
  ProxyActionResult,
  ProxyGroup,
  ProxyMode,
  ProxyProfile,
  ProxySettings,
  ProxySnapshot,
  ProxyTestProgress
} from '../../../common/proxy'
import type { UpdateState } from '../../../common/update'

export type WorkbenchPlatform =
  | 'win32'
  | 'darwin'
  | 'linux'
  | 'aix'
  | 'freebsd'
  | 'openbsd'
  | 'sunos'
  | string

/** 当前承载外壳。安卓能力已完全跑在 Electron 主进程里，这个字段只保留给旧数据兼容。 */
export type WorkbenchShell = 'electron' | 'wpf'

/** 外壳实现：决定网页模块用 <webview> 还是 <iframe> 渲染。 */
export type WorkbenchImpl = 'electron' | 'webview2'

export interface WorkbenchAPI {
  platform: WorkbenchPlatform
  /** 旧版 preload 没有该字段，缺省按 electron 处理。 */
  shell?: WorkbenchShell
  impl?: WorkbenchImpl
  getOpenAtLogin: () => Promise<{
    openAtLogin: boolean
    openAsHidden: boolean
    wasOpenedAtLogin: boolean
  }>
  setOpenAtLogin: (
    openAtLogin: boolean,
    openAsHidden?: boolean
  ) => Promise<{ openAtLogin: boolean; openAsHidden: boolean }>
  pickImage: () => Promise<string | null>
  saveModuleIcon: (moduleId: string, sourcePath: string) => Promise<string>
  removeModuleIcon: (moduleId: string) => Promise<boolean>
  iconFileUrl: (filePath: string) => Promise<string | null>
  getAppInfo: () => Promise<{
    name: string
    version: string
    platform: string
    isPackaged: boolean
    userData: string
  }>
  setChromeTheme: (payload: { backgroundColor?: string }) => Promise<boolean>
  isMaximized: () => Promise<boolean>
  minimizeWindow: () => Promise<boolean>
  maximizeWindow: () => Promise<boolean>
  closeWindow: () => Promise<boolean>
  onMaximized: (cb: (maximized: boolean) => void) => () => void
  syncReminder: (
    payload: {
      enabled: boolean
      fireAt: string
      dateKey: string
      firedDateKey?: string | null
      title: string
      body: string
    },
    key?: string
  ) => Promise<{ scheduled: boolean; reason?: string; fireAt?: string }>
  clearReminder: (key?: string) => Promise<boolean>
  testReminder: (payload: { title?: string; body?: string }) => Promise<boolean>
  onReminderFired: (cb: (payload: { key?: string; dateKey: string }) => void) => () => void
  onGuestOpenTab: (cb: (payload: { url: string }) => void) => () => void
  /** 开关灯：把访客页切成真正的深色主题；返回是否成功 */
  setGuestDarkMode: (webContentsId: number, enabled: boolean) => Promise<boolean>
  /** 内置游戏里屏蔽系统输入法；返回是否成功 */
  setImeBlocked: (blocked: boolean) => Promise<boolean>
  openExternal: (url: string) => Promise<void>

  /** 中国天气网取数（主进程代取：接口要求 Referer，且无 CORS 头） */
  weather?: {
    fetchIndex: (cityCode: string) => Promise<{ ok: boolean; text?: string; error?: string }>
    search: (query: string) => Promise<{ ok: boolean; text?: string; error?: string }>
    /** 街道/镇（12 位码）只有当天的天气 */
    fetchToday: (code: string) => Promise<{ ok: boolean; text?: string; error?: string }>
  }

  update: {
    state: () => Promise<UpdateState>
    check: () => Promise<UpdateState>
    download: () => Promise<UpdateState>
    install: () => Promise<boolean>
    onChange: (cb: (state: UpdateState) => void) => () => void
  }

  proxy: {
    snapshot: () => Promise<ProxySnapshot>
    groups: () => Promise<ProxyGroup[]>
    logs: () => Promise<string[]>
    start: () => Promise<ProxyActionResult>
    startCore: () => Promise<ProxyActionResult>
    toggleProxy: (enabled?: boolean) => Promise<ProxyActionResult>
    stop: () => Promise<ProxyActionResult>
    restart: () => Promise<ProxyActionResult>
    select: (group: string, node: string) => Promise<ProxyActionResult>
    testDelay: (node: string) => Promise<number>
    testGroup: (group: string) => Promise<ProxyGroup | null>
    onTestProgress: (cb: (payload: ProxyTestProgress) => void) => () => void
    setMode: (mode: ProxyMode) => Promise<ProxyActionResult>
    patchSettings: (patch: Partial<ProxySettings>) => Promise<ProxySnapshot>
    setSystemProxy: (enabled: boolean) => Promise<ProxyActionResult>
    importProfile: () => Promise<ProxyActionResult & { profile?: ProxyProfile }>
    setSubscription: (
      url: string,
      name?: string
    ) => Promise<ProxyActionResult & { profile?: ProxyProfile }>
    updateSubscription: () => Promise<ProxyActionResult & { profile?: ProxyProfile }>
    switchProfile: (id: string) => Promise<ProxyActionResult>
    removeProfile: (id: string) => Promise<ProxyActionResult>
    renameProfile: (id: string, name: string) => Promise<ProxyActionResult>
    onState: (cb: () => void) => () => void
  }

  /**
   * 安卓模拟器接口曾经挂在这里（2026-10 移除）。整套方案要带上十几 G 的 SDK/AVD
   * 和 4G 常驻内存，为此还在主进程里跑 scrcpy + WebCodecs 解码，收益不成立，已整体删除。
   */

  /** 仅开发态存在：主进程恢复窗口后截图，用于自动化验收界面 */
  devtools?: {
    capture: () => Promise<string | null>
  }
}

declare global {
  interface Window {
    workbench: WorkbenchAPI
  }
}

export {}

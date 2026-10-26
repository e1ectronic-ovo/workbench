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

export interface AndroidWindowInfo {
  handle: string
  processId: number
  processName: string
  title: string
  className: string
  display: string
}

export interface AndroidMountPayload {
  processName: string
  title?: string
  className?: string
  x: number
  y: number
  width: number
  height: number
}

export interface AndroidLaunchPayload extends AndroidMountPayload {
  executablePath: string
  arguments?: string
}

export interface AndroidStatus {
  embedded: boolean
  processName: string
  title: string
  className: string
  handle: string
}

/** 当前承载外壳：electron 是原版 Electron 壳，wpf 是 WebView2 + 原生窗口托管壳。 */
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
  syncReminder: (payload: {
    enabled: boolean
    fireAt: string
    dateKey: string
    firedDateKey?: string | null
    title: string
    body: string
  }) => Promise<{ scheduled: boolean; reason?: string; fireAt?: string }>
  clearReminder: () => Promise<boolean>
  testReminder: (payload: { title?: string; body?: string }) => Promise<boolean>
  onReminderFired: (cb: (payload: { dateKey: string }) => void) => () => void
  onGuestOpenTab: (cb: (payload: { url: string }) => void) => () => void
  openExternal: (url: string) => Promise<void>

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
   * 原生窗口托管能力。只有 WPF 外壳（WebView2 + HwndHost）提供；
   * Electron 外壳没有可用的原生窗口托管通道，因此这里必须是可选的。
   */
  android?: {
    /** 取消选择时返回 null。 */
    pickWindow: () => Promise<AndroidWindowInfo | null>
    mount: (payload: AndroidMountPayload) => Promise<AndroidStatus>
    launch: (payload: AndroidLaunchPayload) => Promise<AndroidStatus>
    updateBounds: (payload: Pick<AndroidMountPayload, 'x' | 'y' | 'width' | 'height'>) => Promise<AndroidStatus>
    deactivate: () => Promise<AndroidStatus>
    detach: () => Promise<AndroidStatus>
    status: () => Promise<AndroidStatus>
    onStatus: (cb: (status: AndroidStatus) => void) => () => void
  }
}

declare global {
  interface Window {
    workbench: WorkbenchAPI
  }
}

export {}

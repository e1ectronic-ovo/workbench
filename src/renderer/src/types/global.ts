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

export interface WorkbenchAPI {
  platform: WorkbenchPlatform
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
}

declare global {
  interface Window {
    workbench: WorkbenchAPI
  }
}

export {}

import { contextBridge, ipcRenderer, shell } from 'electron'
import type { CloseAction } from '../common/window'
import type { UpdateState } from '../common/update'
import type {
  ProxyActionResult,
  ProxyGroup,
  ProxyMode,
  ProxyProfile,
  ProxySettings,
  ProxySnapshot,
  ProxyTestProgress
} from '../common/proxy'

const api = {
  platform: process.platform as string,
  shell: 'electron' as const,
  impl: 'electron' as const,

  getOpenAtLogin: () =>
    ipcRenderer.invoke('settings:getOpenAtLogin') as Promise<{
      openAtLogin: boolean
      openAsHidden: boolean
      wasOpenedAtLogin: boolean
    }>,

  setOpenAtLogin: (openAtLogin: boolean, openAsHidden = false) =>
    ipcRenderer.invoke('settings:setOpenAtLogin', { openAtLogin, openAsHidden }) as Promise<{
      openAtLogin: boolean
      openAsHidden: boolean
    }>,

  pickImage: () => ipcRenderer.invoke('dialog:pickImage') as Promise<string | null>,

  saveModuleIcon: (moduleId: string, sourcePath: string) =>
    ipcRenderer.invoke('icons:saveModuleIcon', { moduleId, sourcePath }) as Promise<string>,

  removeModuleIcon: (moduleId: string) =>
    ipcRenderer.invoke('icons:removeModuleIcon', moduleId) as Promise<boolean>,

  iconFileUrl: (filePath: string) =>
    ipcRenderer.invoke('icons:toUrl', filePath) as Promise<string | null>,

  getAppInfo: () =>
    ipcRenderer.invoke('app:getInfo') as Promise<{
      name: string
      version: string
      platform: string
      isPackaged: boolean
      userData: string
    }>,

  setChromeTheme: (payload: { backgroundColor?: string }) =>
    ipcRenderer.invoke('window:setChromeTheme', payload) as Promise<boolean>,

  isMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,

  minimizeWindow: () => ipcRenderer.invoke('window:minimize') as Promise<boolean>,

  maximizeWindow: () => ipcRenderer.invoke('window:maximize') as Promise<boolean>,

  closeWindow: () => ipcRenderer.invoke('window:close') as Promise<boolean>,

  getCloseAction: () => ipcRenderer.invoke('window:getCloseAction') as Promise<CloseAction>,

  setCloseAction: (action: CloseAction) =>
    ipcRenderer.invoke('window:setCloseAction', action) as Promise<CloseAction>,

  onMaximized: (cb: (maximized: boolean) => void) => {
    const listener = (_: Electron.IpcRendererEvent, maximized: boolean) => cb(maximized)
    ipcRenderer.on('window:maximized', listener)
    return () => ipcRenderer.removeListener('window:maximized', listener)
  },

  syncReminder: (payload: {
    enabled: boolean
    fireAt: string
    dateKey: string
    firedDateKey?: string | null
    title: string
    body: string
  }) =>
    ipcRenderer.invoke('reminders:sync', payload) as Promise<{
      scheduled: boolean
      reason?: string
      fireAt?: string
    }>,

  clearReminder: () => ipcRenderer.invoke('reminders:clear') as Promise<boolean>,

  testReminder: (payload: { title?: string; body?: string }) =>
    ipcRenderer.invoke('reminders:test', payload) as Promise<boolean>,

  onReminderFired: (cb: (payload: { dateKey: string }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: { dateKey: string }) =>
      cb(payload)
    ipcRenderer.on('reminder:fired', listener)
    return () => ipcRenderer.removeListener('reminder:fired', listener)
  },

  onGuestOpenTab: (cb: (payload: { url: string }) => void) => {
    const listener = (_: Electron.IpcRendererEvent, payload: { url: string }) =>
      cb(payload)
    ipcRenderer.on('guest:open-tab', listener)
    return () => ipcRenderer.removeListener('guest:open-tab', listener)
  },

  /** 开关灯：让主进程把访客页切成真正的深色主题（CDP，不是蒙版） */
  setGuestDarkMode: (webContentsId: number, enabled: boolean) =>
    ipcRenderer.invoke('guest:setDarkMode', { webContentsId, enabled }) as Promise<boolean>,

  openExternal: (url: string) => shell.openExternal(url),

  /** 天气数据统一走主进程取（中国天气网要 Referer，渲染进程改不了这个头） */
  weather: {
    fetchIndex: (cityCode: string) =>
      ipcRenderer.invoke('weather:fetch', { kind: 'index', key: cityCode }) as Promise<{
        ok: boolean
        text?: string
        error?: string
      }>,

    search: (query: string) =>
      ipcRenderer.invoke('weather:fetch', { kind: 'search', key: query }) as Promise<{
        ok: boolean
        text?: string
        error?: string
      }>,

    /** 街道/镇（12 位码）只有当天的天气 */
    fetchToday: (code: string) =>
      ipcRenderer.invoke('weather:fetch', { kind: 'today', key: code }) as Promise<{
        ok: boolean
        text?: string
        error?: string
      }>
  },

  proxy: {
    snapshot: () => ipcRenderer.invoke('proxy:snapshot') as Promise<ProxySnapshot>,

    groups: () => ipcRenderer.invoke('proxy:groups') as Promise<ProxyGroup[]>,

    logs: () => ipcRenderer.invoke('proxy:logs') as Promise<string[]>,

    start: () => ipcRenderer.invoke('proxy:start') as Promise<ProxyActionResult>,

    /** 只拉起内核（不接管系统代理），用于打开节点列表 / 测速 */
    startCore: () => ipcRenderer.invoke('proxy:startCore') as Promise<ProxyActionResult>,

    toggleProxy: (enabled?: boolean) =>
      ipcRenderer.invoke('proxy:toggleProxy', enabled) as Promise<ProxyActionResult>,

    stop: () => ipcRenderer.invoke('proxy:stop') as Promise<ProxyActionResult>,

    restart: () => ipcRenderer.invoke('proxy:restart') as Promise<ProxyActionResult>,

    select: (group: string, node: string) =>
      ipcRenderer.invoke('proxy:select', { group, node }) as Promise<ProxyActionResult>,

    testDelay: (node: string) => ipcRenderer.invoke('proxy:testDelay', node) as Promise<number>,

    /** 整组测速；进度通过 onTestProgress 推送 */
    testGroup: (group: string) =>
      ipcRenderer.invoke('proxy:testGroup', group) as Promise<ProxyGroup | null>,

    onTestProgress: (cb: (payload: ProxyTestProgress) => void) => {
      const listener = (_: Electron.IpcRendererEvent, payload: ProxyTestProgress) => cb(payload)
      ipcRenderer.on('proxy:test-progress', listener)
      return () => ipcRenderer.removeListener('proxy:test-progress', listener)
    },

    setMode: (mode: ProxyMode) =>
      ipcRenderer.invoke('proxy:setMode', mode) as Promise<ProxyActionResult>,

    patchSettings: (patch: Partial<ProxySettings>) =>
      ipcRenderer.invoke('proxy:patchSettings', patch) as Promise<ProxySnapshot>,

    setSystemProxy: (enabled: boolean) =>
      ipcRenderer.invoke('proxy:setSystemProxy', enabled) as Promise<ProxyActionResult>,

    importProfile: () =>
      ipcRenderer.invoke('proxy:importProfile') as Promise<
        ProxyActionResult & { profile?: ProxyProfile }
      >,

    setSubscription: (url: string, name?: string) =>
      ipcRenderer.invoke('proxy:setSubscription', { url, name }) as Promise<
        ProxyActionResult & { profile?: ProxyProfile }
      >,

    updateSubscription: () =>
      ipcRenderer.invoke('proxy:updateSubscription') as Promise<
        ProxyActionResult & { profile?: ProxyProfile }
      >,

    switchProfile: (id: string) =>
      ipcRenderer.invoke('proxy:switchProfile', id) as Promise<ProxyActionResult>,

    removeProfile: (id: string) =>
      ipcRenderer.invoke('proxy:removeProfile', id) as Promise<ProxyActionResult>,

    renameProfile: (id: string, name: string) =>
      ipcRenderer.invoke('proxy:renameProfile', { id, name }) as Promise<ProxyActionResult>,

    onState: (cb: () => void) => {
      const listener = (): void => cb()
      ipcRenderer.on('proxy:state', listener)
      return () => ipcRenderer.removeListener('proxy:state', listener)
    }
  },

  update: {
    state: () => ipcRenderer.invoke('update:state') as Promise<UpdateState>,

    check: () => ipcRenderer.invoke('update:check') as Promise<UpdateState>,

    download: () => ipcRenderer.invoke('update:download') as Promise<UpdateState>,

    install: () => ipcRenderer.invoke('update:install') as Promise<boolean>,

    onChange: (cb: (state: UpdateState) => void) => {
      const listener = (_: Electron.IpcRendererEvent, state: UpdateState) => cb(state)
      ipcRenderer.on('update:changed', listener)
      return () => ipcRenderer.removeListener('update:changed', listener)
    }
  },

  /** 仅开发态可用：主进程恢复窗口后截一张 PNG（base64），用于自动化验收界面 */
  devtools: {
    capture: () => ipcRenderer.invoke('devtools:capture') as Promise<string | null>
  }
}

contextBridge.exposeInMainWorld('workbench', api)

export type WorkbenchAPI = typeof api

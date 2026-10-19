import { contextBridge, ipcRenderer, shell } from 'electron'

const api = {
  platform: process.platform as string,

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

  openExternal: (url: string) => shell.openExternal(url)
}

contextBridge.exposeInMainWorld('workbench', api)

export type WorkbenchAPI = typeof api

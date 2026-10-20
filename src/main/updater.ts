import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateState } from '../common/update'
import { idleUpdateState } from '../common/update'

const CHECK_DELAY = 8000

/**
 * 应用内更新：检查 GitHub Releases → 下载 → 覆盖安装。
 * 只在打包环境启用，开发态没有 app-update.yml，检查会直接报错。
 */
class UpdateService {
  private state: UpdateState = idleUpdateState()
  /** 避免同一个版本反复弹窗 */
  private prompted = new Set<string>()
  private wired = false

  /** 便携版没有安装目录，自动更新会把绿色版变成安装版，直接禁用 */
  private get portable(): boolean {
    return !!process.env['PORTABLE_EXECUTABLE_DIR']
  }

  init(): void {
    if (!app.isPackaged || this.portable) return
    this.wire()

    setTimeout(() => {
      void this.check(false)
    }, CHECK_DELAY)
  }

  private wire(): void {
    if (this.wired) return
    this.wired = true

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => {
      this.patch({ status: 'checking', error: null })
    })

    autoUpdater.on('update-available', (info) => {
      this.patch({
        status: 'available',
        version: info.version,
        notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : '',
        releasedAt: info.releaseDate ?? ''
      })
      this.promptAvailable(info.version)
    })

    autoUpdater.on('update-not-available', () => {
      this.patch({ status: 'none', version: '', downloaded: 0, total: 0 })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.patch({
        status: 'downloading',
        percent: Math.round(progress.percent),
        downloaded: progress.transferred,
        total: progress.total
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.patch({ status: 'downloaded', version: info.version, percent: 100 })
      this.promptInstall(info.version)
    })

    autoUpdater.on('error', (error) => {
      this.patch({ status: 'error', error: error?.message || '检查更新失败' })
    })
  }

  private patch(partial: Partial<UpdateState>): void {
    this.state = { ...this.state, ...partial }
    this.emit()
  }

  private emit(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('update:changed', this.state)
    }
  }

  stateOf(): UpdateState {
    return this.state
  }

  async check(manual = true): Promise<UpdateState> {
    if (this.portable) {
      this.patch({ status: 'error', error: '便携版不支持自动更新，请到 GitHub Releases 下载新版' })
      return this.state
    }
    if (!app.isPackaged) {
      this.patch({ status: 'error', error: '开发模式下不检查更新' })
      return this.state
    }
    if (this.state.status === 'downloading') return this.state

    this.wire()
    try {
      await autoUpdater.checkForUpdates()
    } catch (e) {
      this.patch({ status: 'error', error: e instanceof Error ? e.message : '检查更新失败' })
    }
    if (manual && this.state.status === 'none') {
      void this.toast('已是最新版本', `当前版本 v${app.getVersion()}`)
    }
    return this.state
  }

  async download(): Promise<UpdateState> {
    if (this.state.status !== 'available' && this.state.status !== 'error') return this.state
    try {
      this.patch({ status: 'downloading', percent: 0, error: null })
      await autoUpdater.downloadUpdate()
    } catch (e) {
      this.patch({ status: 'error', error: e instanceof Error ? e.message : '下载失败' })
    }
    return this.state
  }

  install(): void {
    if (this.state.status !== 'downloaded') return
    // 静默覆盖安装：只替换安装目录里的程序文件，userData 原样保留
    setImmediate(() => autoUpdater.quitAndInstall(true, true))
  }

  /** 发现新版本时的主动提示，一个版本只弹一次 */
  private promptAvailable(version: string): void {
    if (this.prompted.has(version)) return
    this.prompted.add(version)

    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return

    void dialog
      .showMessageBox(win, {
        type: 'info',
        title: '发现新版本',
        message: `Workbench v${version} 已发布`,
        detail: `当前版本 v${app.getVersion()}。现在下载吗？下载完成后会提示重启安装。`,
        buttons: ['下载更新', '稍后'],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        if (response === 0) void this.download()
      })
  }

  private promptInstall(version: string): void {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return
    void dialog
      .showMessageBox(win, {
        type: 'info',
        title: '更新已就绪',
        message: `v${version} 已下载完成`,
        detail: '重启后自动覆盖安装，现有配置与登录状态都会保留。',
        buttons: ['立即重启安装', '下次启动时安装'],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        if (response === 0) this.install()
      })
  }

  private async toast(message: string, detail: string): Promise<void> {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return
    await dialog.showMessageBox(win, { type: 'info', title: '检查更新', message, detail, buttons: ['好'] })
  }
}

export const updateService = new UpdateService()

export function registerUpdateIpc(): void {
  ipcMain.handle('update:state', () => updateService.stateOf())
  ipcMain.handle('update:check', () => updateService.check(true))
  ipcMain.handle('update:download', () => updateService.download())
  ipcMain.handle('update:install', () => {
    updateService.install()
    return true
  })
}

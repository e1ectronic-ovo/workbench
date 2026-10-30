import { app, BrowserWindow, dialog, ipcMain, protocol, session } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'fs'
import { extname, join } from 'path'
import { pathToFileURL } from 'url'
import { GUEST_PARTITION, GUEST_USER_AGENT } from '../common/guest-session'
import {
  clearReminderSchedule,
  initReminders,
  scheduleReminder,
  showDesktopNotification,
  type ReminderPayload
} from './reminders'
import { ProxyService, registerProxyIpc } from './proxy'
import { destroyTray, setTrayActive, setupTray } from './tray'
import { registerUpdateIpc, updateService } from './updater'
import { registerWeatherIpc } from './weather'
import {
  installCloseBehavior,
  readCloseAction,
  showMainWindow,
  writeCloseAction
} from './window-behavior'
import type { CloseAction } from '../common/window'

const isDev = !app.isPackaged
/** 界面上显示的产品名，托盘菜单与关闭确认框都用它 */
const PRODUCT_NAME = '鲸汐'

let mainWindow: BrowserWindow | null = null
/** before-quit 已经接管退出流程，关窗时不要再弹确认 */
let quitting = false

/**
 * 产品在 0.3.0 从 Workbench 更名为 Whaletide，Electron 默认的数据目录会随之改变。
 * 老用户直接沿用原来的目录——不复制、不搬移、不删除，配置 / 登录态 / 代理订阅零风险；
 * 只有全新安装的用户才会落到新目录。
 *
 * 必须在任何 getPath('userData') 调用之前执行（会话分区、代理存储都依赖它）。
 */
function adoptLegacyUserData(): void {
  const appData = app.getPath('appData')
  const legacy = join(appData, 'Workbench')
  const current = join(appData, 'Whaletide')
  if (existsSync(current)) return
  try {
    if (existsSync(legacy) && readdirSync(legacy).length > 0) {
      app.setPath('userData', legacy)
      console.log('[whaletide] 沿用旧数据目录', legacy)
    }
  } catch (err) {
    // 读不动就按新目录走，不能因为迁移把应用卡在启动阶段
    console.warn('[whaletide] 旧数据目录检测失败', err)
  }
}

/**
 * 开发态用项目内的独立数据目录。
 *
 * 两个理由：
 *   1. 装上正式版之后，两者会抢同一个 userData 的单实例锁，谁先开另一个就起不来，
 *      开发时来回切换极其难受；
 *   2. 调试改主题 / 改模块不该把真实配置写坏，脏数据也不该回流到日常使用的那份。
 *
 * 目录跟 `.runtime/` 一起被 .gitignore 忽略，删掉即重置（主题、模块全回初始状态）。
 */
function useDevUserData(): void {
  if (app.isPackaged) return
  const dir = join(app.getAppPath(), '.runtime', 'userdata-dev')
  try {
    mkdirSync(dir, { recursive: true })
    app.setPath('userData', dir)
    console.log('[whaletide] 开发态数据目录', dir)
  } catch (err) {
    console.warn('[whaletide] 开发态数据目录创建失败，退回默认目录', err)
  }
}

/**
 * 开发态截图通道：先把窗口恢复再抓图。
 *
 * 窗口一旦被最小化，Chromium 的合成器就停止产帧，CDP 的 Page.captureScreenshot
 * 会一直等到超时。capturePage 同样要求窗口可见，所以这里先 restore + show。
 * 只在未打包时挂载，打包版本没有这段。
 */
function registerDevCapture(): void {
  if (app.isPackaged) return
  ipcMain.handle('devtools:capture', async () => {
    const win = mainWindow
    if (!win || win.isDestroyed()) return null
    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.show()
    win.focus()
    await new Promise((resolve) => setTimeout(resolve, 320))
    const image = await win.webContents.capturePage()
    return image.toPNG().toString('base64')
  })
}

/**
 * 开发态按需开放 CDP 调试端口（默认不开）。
 *
 * 用途：自动化验证界面 —— 逐主题截图、抓渲染层报错、模拟点击，
 * 比让人肉眼看一遍可靠。只监听 127.0.0.1，且打包版本不会有这段。
 *   WHALETIDE_DEVTOOLS_PORT=9222 npm run dev
 */
function openDevtoolsPort(): void {
  if (app.isPackaged) return
  const port = process.env.WHALETIDE_DEVTOOLS_PORT?.trim()
  if (!port) return
  app.commandLine.appendSwitch('remote-debugging-port', port)
  app.commandLine.appendSwitch('remote-allow-origins', '*')
  console.log('[whaletide] CDP 调试端口', port)
}

adoptLegacyUserData()
useDevUserData()
openDevtoolsPort()

/**
 * 单实例锁：第二个实例必须让位给已经跑着的那个。
 * 这里不是「体验问题」——两个实例会各自拉起一个 mihomo 抢同一组端口、
 * 互相覆盖系统代理与注册表备份，退出时还原顺序也会错乱。
 *
 * 锁建立在 userData 路径上，所以改名前后（%APPDATA%\Workbench / %APPDATA%\Whaletide）
 * 会各有一把锁；等老用户都升级完之后不会再有并存情况。
 */
const primaryInstance = app.requestSingleInstanceLock()
if (!primaryInstance) {
  console.log('[whaletide] 已有实例在运行，本次启动退出')
  app.quit()
}

app.on('second-instance', (_event, argv) => {
  // 开机自启带 --hidden 的重复启动不应该把窗口弹出来
  if (argv.includes('--hidden')) return
  // 收进托盘之后再双击图标：唤起的是托盘里那个还在跑的实例
  focusMainWindow()
})

// 豆包等站点用跨子域 Cookie 做登录；关掉第三方存储隔离，会话才能在内嵌页里留下来。
app.commandLine.appendSwitch('disable-features', 'ThirdPartyStoragePartitioning')

const proxyService = new ProxyService()

/** 把主窗口唤回前台；还没创建（隐藏启动、托盘点击）时顺带创建 */
function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    // 隐藏启动时窗口不会自动显示，这里由托盘 / 重复启动显式唤出
    showMainWindow(createWindow())
    return
  }
  showMainWindow(mainWindow)
}

/** 完整退出：走 before-quit，保证系统代理被还原、内核被收掉 */
function requestQuit(): void {
  app.quit()
}

function loginItemPath(): string {
  return isDev ? process.execPath : app.getPath('exe')
}

function loginItemArgs(openAsHidden: boolean): string[] {
  const args: string[] = []
  if (isDev) {
    // 开发态 execPath 是 node_modules/electron/dist/electron.exe，必须显式带上绝对应用路径。
    // 这里不能沿用 process.argv.slice(1)：`electron .` 拿到的是相对路径 "."，
    // 开机自启由系统以 C:\WINDOWS\System32 为工作目录拉起，"." 会被解析成 System32，
    // 于是报 "Unable to find Electron app at C:\WINDOWS\System32" 后直接退出。
    args.push(app.getAppPath())
  }
  if (openAsHidden) args.push('--hidden')
  return args
}

function loginItemQuery(openAsHidden: boolean): Electron.LoginItemSettingsOptions {
  if (process.platform !== 'win32' && !isDev) return {}
  return {
    path: loginItemPath(),
    args: loginItemArgs(openAsHidden)
  }
}

function shouldStartHidden(): boolean {
  if (process.argv.includes('--hidden')) return true
  try {
    const s = app.getLoginItemSettings(loginItemQuery(true))
    return s.wasOpenedAtLogin && s.openAsHidden
  } catch {
    return false
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'wbicon',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true
    }
  },
  // 内置应用（resources/apps/<应用名>/）走专有协议：离线读取打包内的静态页面，
  // 同时给页面一个正常的 origin，localStorage 存档才不会退化成 file:// 的共享域。
  {
    scheme: 'wbapp',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

function resourcesDir(): string {
  if (app.isPackaged) return process.resourcesPath
  return join(__dirname, '../../resources')
}

/**
 * 内置应用根目录。每个应用是 resources/apps/<name>/ 下的一个静态站点，
 * 由 wbapp://<name>/<path> 提供，与网络完全无关。
 */
function builtinAppsDir(): string {
  return join(resourcesDir(), 'apps')
}

/** 把 wbapp:// 请求映射成内置目录里的文件，拒绝任何越界路径 */
function serveBuiltinApp(request: Request): Response {
  try {
    const url = new URL(request.url)
    const appName = decodeURIComponent(url.hostname)
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'

    const bad = (s: string): boolean => !s || s.includes('..') || s.includes('\\')
    if (bad(appName) || appName.includes('/') || /[<>:"|?*]/.test(appName)) {
      return new Response('Bad request', { status: 400 })
    }
    if (rel.split('/').some((seg) => seg === '..' || seg === '')) {
      return new Response('Bad request', { status: 400 })
    }

    const root = builtinAppsDir()
    const file = join(root, appName, rel)
    if (!file.startsWith(root)) return new Response('Forbidden', { status: 403 })
    if (!existsSync(file)) return new Response('Not found', { status: 404 })

    return new Response(readFileSync(file), {
      headers: {
        'Content-Type': mimeFor(file),
        // 应用是随包发布的，内容不会中途变化，允许缓存但每次都校验
        'Cache-Control': 'no-cache'
      }
    })
  } catch {
    return new Response('Error', { status: 500 })
  }
}

/** 内置应用要在访客分区（webview 用的 persist:guest）和默认分区上都注册 */
function registerBuiltinAppProtocol(ses: Electron.Session): void {
  ses.protocol.handle('wbapp', serveBuiltinApp)
}

function appIconPath(): string {
  const ico = join(resourcesDir(), 'icon.ico')
  const png = join(resourcesDir(), 'icon.png')
  if (process.platform === 'win32' && existsSync(ico)) return ico
  if (existsSync(png)) return png
  return ico
}

/**
 * 托盘图标。Windows 通知区在 100%~400% 缩放下取 16~48px，用单独的小尺寸 ico
 * 才能各档都清晰；其他平台使用同一套透明圆形 PNG。
 */
function trayIconPaths(): { idle: string; active: string } {
  const fallback = appIconPath()
  const png = join(resourcesDir(), 'tray.png')
  const activePng = join(resourcesDir(), 'tray-active.png')

  if (process.platform === 'win32') {
    const ico = join(resourcesDir(), 'tray.ico')
    const activeIco = join(resourcesDir(), 'tray-active.ico')
    const idle = existsSync(ico) ? ico : existsSync(png) ? png : fallback
    return {
      idle,
      active: existsSync(activeIco) ? activeIco : existsSync(activePng) ? activePng : idle
    }
  }

  const idle = existsSync(png) ? png : fallback
  return { idle, active: existsSync(activePng) ? activePng : idle }
}

function iconsDir(): string {
  const dir = join(app.getPath('userData'), 'module-icons')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function createWindow(): BrowserWindow {
  const icon = appIconPath()
  const isMac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#f5f5f7',
    roundedCorners: true,
    icon: existsSync(icon) ? icon : undefined,
    frame: isMac,
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  })

  const emitMaximized = () => {
    win.webContents.send('window:maximized', win.isMaximized())
  }
  win.on('maximize', emitMaximized)
  win.on('unmaximize', emitMaximized)
  win.webContents.on('did-finish-load', emitMaximized)

  // 关窗默认不杀进程：收进托盘或直接退出，由用户在设置里决定（默认是每次询问）
  installCloseBehavior(win, {
    isQuitting: () => quitting,
    requestQuit,
    productName: PRODUCT_NAME
  })

  // 开机自启 / 收进托盘时进程还在，但不该占着任务栏
  const startHidden = shouldStartHidden()
  if (startHidden) win.setSkipTaskbar(true)
  if (!startHidden) {
    win.once('ready-to-show', () => win.show())
  }

  // 主窗口链接一律不甩给系统浏览器（避免调起 BitBrowser 等）
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  win.webContents.on('will-attach-webview', (_e, webPreferences) => {
    delete webPreferences.preload
    // 访客页（内嵌网站）禁用 Node 集成；nativeWindowOpen 在新版 Electron 已默认开启，无需显式设置
    webPreferences.nodeIntegration = false
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = win
  return win
}

function registerIpc(): void {
  ipcMain.handle('settings:getOpenAtLogin', () => {
    const path = loginItemPath()
    const normal = app.getLoginItemSettings({ path, args: loginItemArgs(false) })
    if (normal.openAtLogin) {
      return {
        openAtLogin: normal.openAtLogin,
        openAsHidden: normal.openAsHidden,
        wasOpenedAtLogin: normal.wasOpenedAtLogin
      }
    }
    const hidden = app.getLoginItemSettings({ path, args: loginItemArgs(true) })
    return {
      openAtLogin: hidden.openAtLogin,
      openAsHidden: hidden.openAsHidden,
      wasOpenedAtLogin: hidden.wasOpenedAtLogin
    }
  })

  ipcMain.handle(
    'settings:setOpenAtLogin',
    (_e, payload: { openAtLogin: boolean; openAsHidden?: boolean }) => {
      const openAsHidden = !!payload.openAsHidden
      const settings: Electron.Settings = {
        openAtLogin: !!payload.openAtLogin,
        openAsHidden,
        path: loginItemPath(),
        args: loginItemArgs(openAsHidden)
      }
      app.setLoginItemSettings(settings)
      const result = app.getLoginItemSettings({
        path: settings.path,
        args: settings.args
      })
      return {
        openAtLogin: result.openAtLogin,
        openAsHidden: result.openAsHidden,
        wasOpenedAtLogin: result.wasOpenedAtLogin
      }
    }
  )

  ipcMain.handle('dialog:pickImage', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win ?? undefined!, {
      title: '选择图标文件',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'ico', 'svg'] }
      ]
    })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })

  ipcMain.handle(
    'icons:saveModuleIcon',
    (_e, payload: { moduleId: string; sourcePath: string }) => {
      const { moduleId, sourcePath } = payload
      if (!moduleId || !sourcePath || !existsSync(sourcePath)) {
        throw new Error('无效的图标文件')
      }
      const ext = (extname(sourcePath) || '.png').toLowerCase()
      const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.svg'].includes(ext)
        ? ext
        : '.png'
      const dest = join(iconsDir(), `${moduleId}${safeExt}`)
      // remove previous icons for this module (any ext)
      for (const e of ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.svg']) {
        const prev = join(iconsDir(), `${moduleId}${e}`)
        if (prev !== dest && existsSync(prev)) {
          try {
            unlinkSync(prev)
          } catch {
            /* ignore */
          }
        }
      }
      copyFileSync(sourcePath, dest)
      return dest
    }
  )

  ipcMain.handle('icons:removeModuleIcon', (_e, moduleId: string) => {
    if (!moduleId) return false
    let removed = false
    for (const e of ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.svg']) {
      const p = join(iconsDir(), `${moduleId}${e}`)
      if (existsSync(p)) {
        try {
          unlinkSync(p)
          removed = true
        } catch {
          /* ignore */
        }
      }
    }
    return removed
  })

  ipcMain.handle('icons:toUrl', (_e, filePath: string) => {
    if (!filePath || !existsSync(filePath)) return null
    return pathToFileURL(filePath).href
  })

  ipcMain.handle('app:getInfo', () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
    isPackaged: app.isPackaged,
    userData: app.getPath('userData')
  }))

  ipcMain.handle(
    'window:setChromeTheme',
    (event, payload: { backgroundColor?: string }) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return false
      try {
        // 背景色与主题同步，避免圆角外侧露出旧色或被 webview 顶成直角
        if (payload.backgroundColor) {
          win.setBackgroundColor(payload.backgroundColor)
        }
        return true
      } catch {
        return false
      }
    }
  )

  ipcMain.handle('window:isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win?.isMaximized() ?? false
  })

  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
    return true
  })

  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
    return win.isMaximized()
  })

  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
    return true
  })

  ipcMain.handle('window:getCloseAction', () => readCloseAction())

  ipcMain.handle('window:setCloseAction', (_event, action: CloseAction) => {
    writeCloseAction(action)
    return readCloseAction()
  })

  ipcMain.handle('reminders:sync', (_event, payload: ReminderPayload) => {
    return scheduleReminder(payload)
  })

  ipcMain.handle('reminders:clear', () => {
    clearReminderSchedule()
    return true
  })

  ipcMain.handle(
    'reminders:test',
    (_event, payload: { title?: string; body?: string }) => {
      const title = payload?.title || '鲸汐'
      const body = payload?.body || '通知测试成功'
      return showDesktopNotification(title, body)
    }
  )
}

function mimeFor(file: string): string {
  switch (extname(file).toLowerCase()) {
    case '.html':
    case '.htm':
      return 'text/html; charset=utf-8'
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.txt':
      return 'text/plain; charset=utf-8'
    case '.woff2':
      return 'font/woff2'
    case '.woff':
      return 'font/woff'
    case '.ttf':
      return 'font/ttf'
    case '.mp3':
      return 'audio/mpeg'
    case '.ogg':
      return 'audio/ogg'
    case '.wav':
      return 'audio/wav'
    case '.mp4':
      return 'video/mp4'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    case '.ico':
      return 'image/x-icon'
    default:
      return 'application/octet-stream'
  }
}

/** 只允许网页导航。bitbrowser: 等自定义协议会让 Windows 弹出「需要新应用打开此链接」。 */
function isWebNavigation(url: string): boolean {
  return (
    /^https?:/i.test(url) ||
    /^about:/i.test(url) ||
    /^file:/i.test(url) ||
    /^devtools:/i.test(url) ||
    // 内置应用走自己的协议，属于站内导航，不能按「外部协议」拦掉
    /^wbapp:/i.test(url)
  )
}

function blockExternalProtocol(event: Electron.Event, url: string) {
  if (!url || isWebNavigation(url)) return
  event.preventDefault()
}

function isAppShell(contents: Electron.WebContents): boolean {
  return (
    mainWindow != null &&
    !mainWindow.isDestroyed() &&
    contents.id === mainWindow.webContents.id
  )
}

function isGuestBrowsing(contents: Electron.WebContents): boolean {
  if (isAppShell(contents)) return false
  if (contents.getType() === 'webview') return true
  return false
}

function notifyGuestOpenTab(url: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send('guest:open-tab', { url })
}

function isBlankPopupUrl(url: string): boolean {
  const raw = (url || '').trim()
  return !raw || raw === 'about:blank' || /^about:blank[?#]/i.test(raw) || raw === 'about:newblank'
}

/**
 * 模块 webview 开窗策略：
 * - http(s) / about:blank 弹窗：在主窗口内开新标签页
 * - bitbrowser: / mailto: 等自定义协议：拒绝，不甩给系统
 * - 应用壳 renderer：一律拒绝
 */
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => blockExternalProtocol(event, url))
  contents.on('will-redirect', (event, url) => blockExternalProtocol(event, url))
  contents.on('will-frame-navigate', (event) => blockExternalProtocol(event, event.url))

  contents.setWindowOpenHandler(({ url }) => {
    if (!isGuestBrowsing(contents)) {
      return { action: 'deny' }
    }

    const raw = (url || '').trim()

    if (isBlankPopupUrl(raw) || /^https?:\/\//i.test(raw)) {
      notifyGuestOpenTab(raw || 'about:blank')
      return { action: 'deny' }
    }

    return { action: 'deny' }
  })
})

function allowGeolocation(ses: Electron.Session): void {
  ses.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'geolocation')
  })
}

function configureGuestSession(): void {
  const ses = session.fromPartition(GUEST_PARTITION)
  ses.setUserAgent(GUEST_USER_AGENT)
  allowGeolocation(ses)
  allowGeolocation(session.defaultSession)
  // 内置应用同样要在访客分区可用：模块 webview 全部跑在 persist:guest 上
  registerBuiltinAppProtocol(ses)
}

app.whenReady().then(() => {
  // 没抢到锁的实例在退出途中，不要初始化任何东西
  if (!primaryInstance) return

  configureGuestSession()

  protocol.handle('wbicon', (request) => {
    try {
      const url = new URL(request.url)
      const name = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
      if (!name || name.includes('..') || name.includes('/') || name.includes('\\')) {
        return new Response('Bad request', { status: 400 })
      }
      const file = join(iconsDir(), name)
      if (!existsSync(file)) return new Response('Not found', { status: 404 })
      return new Response(readFileSync(file), {
        headers: { 'Content-Type': mimeFor(file), 'Cache-Control': 'no-cache' }
      })
    } catch {
      return new Response('Error', { status: 500 })
    }
  })

  if (process.platform === 'win32') {
    app.setAppUserModelId('com.workbench.app')
  }

  // 内置应用：默认分区也注册一份，方便主界面直接引用（截图、预览等场景）
  registerBuiltinAppProtocol(session.defaultSession)

  initReminders({
    getMainWindow: () => mainWindow,
    iconPath: appIconPath
  })

  registerIpc()
  registerProxyIpc(proxyService)
  registerUpdateIpc()
  registerWeatherIpc()
  registerDevCapture()
  createWindow()

  setupTray(trayIconPaths(), {
    show: focusMainWindow,
    requestQuit,
    productName: PRODUCT_NAME
  })
  proxyService.onStateChange = setTrayActive

  void proxyService.init()
  updateService.init()

  // macOS 点 Dock 图标：窗口收进托盘后要能再唤出来
  app.on('activate', () => focusMainWindow())
})

app.on('before-quit', (event) => {
  // 没抢到锁的实例没启动过内核，直接退，别等那 2.5 秒兜底
  if (!primaryInstance) {
    app.exit(0)
    return
  }
  if (quitting) return
  quitting = true
  event.preventDefault()
  destroyTray()
  // 退出前必须还原系统代理，否则内核没了整机就断网
  Promise.race([
    proxyService.shutdown(),
    new Promise((resolve) => setTimeout(resolve, 2500))
  ]).finally(() => app.exit(0))
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

import { app, BrowserWindow, dialog } from 'electron'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { CLOSE_ACTIONS, type CloseAction } from '../common/window'

function settingsFile(): string {
  return join(app.getPath('userData'), 'window.json')
}

export function readCloseAction(): CloseAction {
  try {
    const file = settingsFile()
    if (!existsSync(file)) return 'ask'
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { closeAction?: unknown }
    return CLOSE_ACTIONS.includes(raw.closeAction as CloseAction)
      ? (raw.closeAction as CloseAction)
      : 'ask'
  } catch {
    // 文件损坏不能影响关窗，退回默认的「每次询问」
    return 'ask'
  }
}

export function writeCloseAction(action: CloseAction): void {
  if (!CLOSE_ACTIONS.includes(action)) return
  const file = settingsFile()
  // 主进程自己读，渲染层不参与，所以不放 localStorage
  writeFileSync(`${file}.tmp`, JSON.stringify({ closeAction: action }, null, 2))
  renameSync(`${file}.tmp`, file)
}

/** 从托盘 / 任务栏把窗口唤回前台 */
export function showMainWindow(win: BrowserWindow): void {
  win.setSkipTaskbar(false)
  if (process.platform === 'darwin') app.dock?.show()
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  win.focus()
}

/** 收进托盘：进程继续跑，只从任务栏和桌面消失 */
export function hideToTray(win: BrowserWindow): void {
  win.setSkipTaskbar(true)
  win.hide()
  if (process.platform === 'darwin') app.dock?.hide()
}

export interface CloseBehaviorDeps {
  /** 退出流程已经被 before-quit 接管 */
  isQuitting: () => boolean
  /** 走完整退出流程，会触发系统代理还原 */
  requestQuit: () => void
  productName: string
}

/**
 * 拦截窗口关闭。
 *
 * 询问要用异步对话框，但 preventDefault 必须同步执行，所以这里统一先拦下，
 * 拿到结果之后再决定收进托盘 / 退出 / 什么都不做。
 */
export function installCloseBehavior(win: BrowserWindow, deps: CloseBehaviorDeps): void {
  win.on('close', (event) => {
    // app.quit() 已经在收尾了，放行让它正常关掉
    if (deps.isQuitting()) return
    event.preventDefault()
    void resolveClose(win, deps)
  })
}

async function resolveClose(win: BrowserWindow, deps: CloseBehaviorDeps): Promise<void> {
  const saved = readCloseAction()
  if (saved !== 'ask') {
    act(win, deps, saved)
    return
  }

  const res = await dialog.showMessageBox(win, {
    type: 'question',
    title: deps.productName,
    message: '要怎么处理这个窗口？',
    detail:
      '收进托盘后程序会继续在后台运行，代理连接和网站登录状态都会保留；\n' +
      '之后可以从任务栏托盘再打开，或者在托盘菜单里彻底退出。',
    buttons: ['收进托盘', '退出程序', '取消'],
    defaultId: 0,
    cancelId: 2,
    checkboxLabel: '记住我的选择，以后不再询问',
    checkboxChecked: false,
    noLink: true
  })

  // 点了取消（含直接关闭对话框）：窗口保持原样
  if (res.response === 2) return
  const action: CloseAction = res.response === 0 ? 'tray' : 'quit'
  if (res.checkboxChecked) writeCloseAction(action)
  act(win, deps, action)
}

function act(win: BrowserWindow, deps: CloseBehaviorDeps, action: CloseAction): void {
  if (action === 'tray') {
    hideToTray(win)
    return
  }
  // 先收起窗口，退出前的代理还原才有时间跑完而不显得卡住
  if (win.isVisible()) win.hide()
  deps.requestQuit()
}

import { Menu, Tray, nativeImage, type NativeImage } from 'electron'
import { existsSync } from 'fs'

export interface TrayIconPaths {
  /** 系统代理关闭时的紫色图标 */
  idle: string
  /** 系统代理开启时的绿色图标 */
  active: string
}

export interface TrayDeps {
  /** 唤起主窗口；窗口还没建好时会顺带创建 */
  show: () => void
  /** 走完整退出流程，会触发系统代理还原 */
  requestQuit: () => void
  productName: string
}

let current: Tray | null = null
let idleImage: NativeImage | null = null
let activeImage: NativeImage | null = null
let currentActive = false
let currentProductName = ''

function loadTrayImage(path: string): NativeImage | null {
  if (!existsSync(path)) return null
  const image = nativeImage.createFromPath(path)
  return image.isEmpty() ? null : image
}

/**
 * 任务栏托盘。右键出菜单，左键直接开窗。
 * 内置的代理内核常驻在后台，所以托盘里必须能彻底退出——否则用户关了窗口
 * 却以为程序没在跑，系统代理还一直被接管着。
 */
export function setupTray(icons: TrayIconPaths, deps: TrayDeps): void {
  destroyTray()

  const idle = loadTrayImage(icons.idle)
  if (!idle) {
    console.warn('[whaletide] 托盘图标不存在或读取失败，跳过托盘：', icons.idle)
    return
  }
  const active = loadTrayImage(icons.active) ?? idle

  const name = deps.productName
  const tray = new Tray(idle)
  tray.setToolTip(name)
  tray.setIgnoreDoubleClickEvents(true)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `打开${name}`, click: () => deps.show() },
      { type: 'separator' },
      { label: `退出${name}`, click: () => deps.requestQuit() },
    ]),
  )
  tray.on('click', () => deps.show())
  tray.on('double-click', () => deps.show())

  current = tray
  idleImage = idle
  activeImage = active
  currentActive = false
  currentProductName = name
}

/** 仅在系统代理实际开启时切换为绿色图标；重复状态不会重复刷新托盘。 */
export function setTrayActive(active: boolean): void {
  if (!current || !idleImage || !activeImage || currentActive === active) return
  currentActive = active
  current.setImage(active ? activeImage : idleImage)
  current.setToolTip(active ? `${currentProductName} · 代理已开启` : currentProductName)
}

/** 退出时主动销毁，否则 Windows 上托盘图标会残留到鼠标划过才消失 */
export function destroyTray(): void {
  current?.destroy()
  current = null
  idleImage = null
  activeImage = null
  currentActive = false
  currentProductName = ''
}

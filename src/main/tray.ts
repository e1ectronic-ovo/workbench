import { Menu, Tray, nativeImage } from 'electron'
import { existsSync } from 'fs'

export interface TrayDeps {
  /** 唤起主窗口；窗口还没建好时会顺带创建 */
  show: () => void
  /** 走完整退出流程，会触发系统代理还原 */
  requestQuit: () => void
  productName: string
}

let current: Tray | null = null

/**
 * 任务栏托盘。右键出菜单，左键直接开窗。
 * 内置的代理内核常驻在后台，所以托盘里必须能彻底退出——否则用户关了窗口
 * 却以为程序没在跑，系统代理还一直被接管着。
 */
export function setupTray(iconPath: string, deps: TrayDeps): void {
  destroyTray()

  if (!existsSync(iconPath)) {
    console.warn('[whaletide] 托盘图标不存在，跳过托盘：', iconPath)
    return
  }
  const image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) {
    console.warn('[whaletide] 托盘图标读取失败：', iconPath)
    return
  }

  const name = deps.productName
  const tray = new Tray(image)
  tray.setToolTip(name)
  tray.setIgnoreDoubleClickEvents(true)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `打开${name}`, click: () => deps.show() },
      { type: 'separator' },
      { label: `退出${name}`, click: () => deps.requestQuit() }
    ])
  )
  tray.on('click', () => deps.show())
  tray.on('double-click', () => deps.show())

  current = tray
}

/** 退出时主动销毁，否则 Windows 上托盘图标会残留到鼠标划过才消失 */
export function destroyTray(): void {
  current?.destroy()
  current = null
}

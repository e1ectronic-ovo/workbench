/**
 * 点击窗口关闭按钮时的行为。
 * - `ask`：每次弹窗询问（默认）
 * - `tray`：收进托盘，进程继续在后台跑
 * - `quit`：直接退出程序
 */
export type CloseAction = 'ask' | 'tray' | 'quit'

export const CLOSE_ACTIONS: CloseAction[] = ['ask', 'tray', 'quit']

export const CLOSE_ACTION_LABELS: Record<CloseAction, string> = {
  ask: '每次询问',
  tray: '收进托盘',
  quit: '退出程序'
}

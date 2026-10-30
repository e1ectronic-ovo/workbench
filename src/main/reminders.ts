import { BrowserWindow, Notification, nativeImage } from 'electron'

export interface ReminderPayload {
  enabled: boolean
  fireAt: string
  dateKey: string
  /** 同一天已经提醒过就别再排（下班提醒用；便签触发后由渲染层自己清掉提醒时间） */
  firedDateKey?: string | null
  title: string
  body: string
}

export interface ReminderScheduleResult {
  scheduled: boolean
  reason?: 'disabled' | 'invalid_time' | 'passed' | 'already_fired' | 'no_clock_in'
  fireAt?: string
}

/**
 * 提醒按 key 分开排：`attendance` 是下班提醒，便签用 `note:<id>`。
 *
 * 早先只有一个 timer，谁后同步谁把别人顶掉 —— 便签一设提醒，下班提醒就没了。
 */
const timers = new Map<string, ReturnType<typeof setTimeout>>()
export const DEFAULT_REMINDER_KEY = 'attendance'

let getMainWindow: () => BrowserWindow | null = () => null
let getIconPath: () => string = () => ''

export function initReminders(deps: {
  getMainWindow: () => BrowserWindow | null
  iconPath: () => string
}) {
  getMainWindow = deps.getMainWindow
  getIconPath = deps.iconPath
}

function clearKey(key: string) {
  const timer = timers.get(key)
  if (timer) clearTimeout(timer)
  timers.delete(key)
}

export function showDesktopNotification(title: string, body: string): boolean {
  if (!Notification.isSupported()) return false
  try {
    const path = getIconPath()
    const icon = path ? nativeImage.createFromPath(path) : null
    const notification = new Notification({
      title,
      body,
      icon: icon && !icon.isEmpty() ? icon : undefined
    })
    notification.show()
    return true
  } catch {
    return false
  }
}

export function scheduleReminder(
  payload: ReminderPayload,
  key = DEFAULT_REMINDER_KEY
): ReminderScheduleResult {
  clearKey(key)

  if (!payload.enabled || !payload.fireAt) {
    return { scheduled: false, reason: 'disabled' }
  }

  if (payload.firedDateKey && payload.firedDateKey === payload.dateKey) {
    return { scheduled: false, reason: 'already_fired' }
  }

  const target = new Date(payload.fireAt)
  if (Number.isNaN(target.getTime())) {
    return { scheduled: false, reason: 'invalid_time' }
  }

  const delay = target.getTime() - Date.now()
  if (delay <= 0) return { scheduled: false, reason: 'passed' }

  const timer = setTimeout(() => {
    timers.delete(key)
    showDesktopNotification(payload.title, payload.body)
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('reminder:fired', { key, dateKey: payload.dateKey })
    }
  }, delay)
  timer.unref?.()
  timers.set(key, timer)

  return { scheduled: true, fireAt: target.toISOString() }
}

/** 不传 key 就清全部（退出应用时用） */
export function clearReminderSchedule(key?: string) {
  if (key === undefined) {
    timers.forEach((timer) => clearTimeout(timer))
    timers.clear()
    return
  }
  clearKey(key)
}

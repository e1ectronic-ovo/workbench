import { BrowserWindow, Notification, nativeImage } from 'electron'

export interface ReminderPayload {
  enabled: boolean
  fireAt: string
  dateKey: string
  firedDateKey?: string | null
  title: string
  body: string
}

export interface ReminderScheduleResult {
  scheduled: boolean
  reason?: 'disabled' | 'invalid_time' | 'passed' | 'already_fired' | 'no_clock_in'
  fireAt?: string
}

let timer: ReturnType<typeof setTimeout> | null = null
let getMainWindow: () => BrowserWindow | null = () => null
let getIconPath: () => string = () => ''

export function initReminders(deps: {
  getMainWindow: () => BrowserWindow | null
  iconPath: () => string
}) {
  getMainWindow = deps.getMainWindow
  getIconPath = deps.iconPath
}

function clearTimer() {
  if (timer) clearTimeout(timer)
  timer = null
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

export function scheduleReminder(payload: ReminderPayload): ReminderScheduleResult {
  clearTimer()

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

  timer = setTimeout(() => {
    timer = null
    showDesktopNotification(payload.title, payload.body)
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('reminder:fired', { dateKey: payload.dateKey })
    }
  }, delay)

  return { scheduled: true, fireAt: target.toISOString() }
}

export function clearReminderSchedule() {
  clearTimer()
}

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const STORAGE_KEY = 'workbench.attendance'
const REMINDER_KEY = 'workbench.attendance.reminder'
export const WORK_HOURS = 9
export const REMINDER_BEFORE_MINUTES = 3

export interface DayAttendance {
  clockIn: string
}

export interface ReminderSettings {
  enabled: boolean
  firedDateKey: string | null
}

type AttendanceMap = Record<string, DayAttendance>

const DEFAULT_REMINDER: ReminderSettings = {
  enabled: true,
  firedDateKey: null
}

function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function loadRecords(): AttendanceMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as AttendanceMap
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function loadReminder(): ReminderSettings {
  try {
    const raw = localStorage.getItem(REMINDER_KEY)
    if (!raw) return { ...DEFAULT_REMINDER }
    const data = JSON.parse(raw) as Partial<ReminderSettings> & { time?: string }
    const settings: ReminderSettings = {
      enabled: data.enabled !== undefined ? !!data.enabled : DEFAULT_REMINDER.enabled,
      firedDateKey: typeof data.firedDateKey === 'string' ? data.firedDateKey : null
    }
    if (data.enabled === false && !data.time && data.firedDateKey == null) {
      settings.enabled = true
    }
    return settings
  } catch {
    return { ...DEFAULT_REMINDER }
  }
}

function persistRecords(records: AttendanceMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    /* ignore */
  }
}

function persistReminder(reminder: ReminderSettings) {
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(reminder))
  } catch {
    /* ignore */
  }
}

export function formatClockTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

export function addWorkHours(iso: string, hours: number): Date {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000)
}

export function isoToTimeInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function timeInputToDate(time: string, base = new Date()): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  const d = new Date(base)
  d.setHours(h, min, 0, 0)
  return d
}

export const useAttendanceStore = defineStore('attendance', () => {
  const records = ref<AttendanceMap>(loadRecords())
  const reminder = ref<ReminderSettings>(loadReminder())
  const today = ref(todayKey())

  const todayRecord = computed(() => records.value[today.value] ?? null)

  const clockInTime = computed(() =>
    todayRecord.value ? new Date(todayRecord.value.clockIn) : null
  )

  const clockOutTime = computed(() => {
    if (!todayRecord.value) return null
    return addWorkHours(todayRecord.value.clockIn, WORK_HOURS)
  })

  const reminderFireTime = computed(() => {
    const out = clockOutTime.value
    if (!out) return null
    return new Date(out.getTime() - REMINDER_BEFORE_MINUTES * 60 * 1000)
  })

  const reminderEnabled = computed(() => reminder.value.enabled)

  function refreshToday() {
    const key = todayKey()
    if (key !== today.value) {
      today.value = key
      if (reminder.value.firedDateKey && reminder.value.firedDateKey !== key) {
        reminder.value = { ...reminder.value, firedDateKey: null }
        persistReminder(reminder.value)
      }
    }
  }

  function clockIn(at = new Date()) {
    refreshToday()
    records.value = {
      ...records.value,
      [today.value]: { clockIn: at.toISOString() }
    }
    persistRecords(records.value)
    if (reminder.value.firedDateKey === today.value) {
      reminder.value = { ...reminder.value, firedDateKey: null }
      persistReminder(reminder.value)
    }
  }

  function setClockInTime(time: string) {
    const at = timeInputToDate(time)
    if (!at) return false
    clockIn(at)
    return true
  }

  function resetToday() {
    refreshToday()
    const next = { ...records.value }
    delete next[today.value]
    records.value = next
    persistRecords(records.value)
  }

  function setReminderEnabled(enabled: boolean) {
    reminder.value = { ...reminder.value, enabled }
    persistReminder(reminder.value)
  }

  function markReminderFired(dateKey = today.value) {
    reminder.value = { ...reminder.value, firedDateKey: dateKey }
    persistReminder(reminder.value)
  }

  async function syncReminderSchedule() {
    refreshToday()

    if (!reminder.value.enabled || !todayRecord.value) {
      await window.workbench.clearReminder()
      return null
    }

    const fireAt = reminderFireTime.value
    if (!fireAt) {
      await window.workbench.clearReminder()
      return null
    }

    const clockOut = clockOutTime.value
    const body = clockOut
      ? `还有 ${REMINDER_BEFORE_MINUTES} 分钟下班（${formatClockTime(clockOut.toISOString())}）`
      : `还有 ${REMINDER_BEFORE_MINUTES} 分钟下班。`

    return window.workbench.syncReminder({
      enabled: true,
      fireAt: fireAt.toISOString(),
      dateKey: today.value,
      firedDateKey: reminder.value.firedDateKey,
      title: 'Workbench 下班提醒',
      body
    })
  }

  return {
    today,
    todayRecord,
    clockInTime,
    clockOutTime,
    reminderFireTime,
    reminder,
    reminderEnabled,
    clockIn,
    setClockInTime,
    resetToday,
    refreshToday,
    setReminderEnabled,
    markReminderFired,
    syncReminderSchedule
  }
})

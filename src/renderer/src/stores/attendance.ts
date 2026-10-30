import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const STORAGE_KEY = 'workbench.attendance'
const REMINDER_KEY = 'workbench.attendance.reminder'
const WORK_MINUTES_KEY = 'workbench.attendance.work-minutes'
/** 旧版本只记整点小时，读不到新键时用它迁移一次 */
const LEGACY_WORK_HOURS_KEY = 'workbench.attendance.work-hours'
/** 用户最后一次主动改工时的时刻，只用于排查「设置什么时候被改过」，不参与计算 */
const WORK_MINUTES_UPDATED_KEY = 'workbench.attendance.work-minutes.updated'
export const DEFAULT_WORK_MINUTES = 9 * 60
export const MIN_WORK_MINUTES = 1
export const MAX_WORK_MINUTES = 24 * 60
export const REMINDER_BEFORE_MINUTES = 3
/** 主进程按这个 key 分辨提醒归属（便签用 note:<id>） */
export const ATTENDANCE_REMINDER_KEY = 'attendance'

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

export function attendanceDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function todayKey(date = new Date()): string {
  return attendanceDateKey(date)
}

export function formatDateKeyLabel(dateKey: string, base = new Date()): string {
  const parts = dateKey.split('-').map(Number)
  if (parts.length < 3 || parts.some(Number.isNaN)) return dateKey
  const date = new Date(parts[0], parts[1] - 1, parts[2])
  if (Number.isNaN(date.getTime())) return dateKey
  if (dateKey === attendanceDateKey(base)) return '今天'
  const yesterday = new Date(base)
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateKey === attendanceDateKey(yesterday)) return '昨天'
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
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

/** 工时一律以「总分钟」保存，界面再拆成小时 + 分钟两格 */
export function clampWorkMinutes(minutes: number): number {
  return Math.min(MAX_WORK_MINUTES, Math.max(MIN_WORK_MINUTES, Math.round(minutes)))
}

/** 小时/分钟输入框都只留两位数字 */
export function sanitizeDurationInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 2)
}

/** 540 → 「9 小时」，555 → 「9 小时 15 分钟」，45 → 「45 分钟」 */
export function formatWorkDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h && m) return `${h} 小时 ${m} 分钟`
  if (h) return `${h} 小时`
  return `${m} 分钟`
}

export function splitWorkMinutes(minutes: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(minutes))
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}

/** 两格合并成总分钟；少于 1 分钟或超过 24 小时返回 null */
export function parseWorkDurationInput(hoursInput: string, minutesInput: string): number | null {
  const hDigits = sanitizeDurationInput(hoursInput)
  const mDigits = sanitizeDurationInput(minutesInput)
  if (!hDigits && !mDigits) return null
  const hours = hDigits ? parseInt(hDigits, 10) : 0
  const mins = mDigits ? parseInt(mDigits, 10) : 0
  if (Number.isNaN(hours) || Number.isNaN(mins)) return null
  const total = hours * 60 + mins
  if (total < MIN_WORK_MINUTES) return null
  return clampWorkMinutes(total)
}

/**
 * 读工时，并说明这份值是从哪来的：
 *   current  —— 新键里就有，直接用（不写回，避免每次启动都重写一遍）
 *   legacy   —— 只有旧版的整点小时，折算后需要迁移写回
 *   fallback —— 什么都没读到（或读失败），只好用默认值，**绝对不要写回**：
 *               写回等于把用户之前设过的值单程销毁，下次就真读不到了
 */
type WorkMinutesSource = 'current' | 'legacy' | 'fallback'

function loadWorkMinutes(): { minutes: number; source: WorkMinutesSource } {
  try {
    const stored = localStorage.getItem(WORK_MINUTES_KEY)
    const parsed = stored ? parseInt(stored, 10) : NaN
    if (Number.isFinite(parsed)) return { minutes: clampWorkMinutes(parsed), source: 'current' }
    // 旧版本只存了整点小时，这里折算成分钟
    const legacy = localStorage.getItem(LEGACY_WORK_HOURS_KEY)
    const legacyHours = legacy ? parseInt(legacy, 10) : NaN
    if (Number.isFinite(legacyHours)) {
      return { minutes: clampWorkMinutes(legacyHours * 60), source: 'legacy' }
    }
    return { minutes: DEFAULT_WORK_MINUTES, source: 'fallback' }
  } catch {
    return { minutes: DEFAULT_WORK_MINUTES, source: 'fallback' }
  }
}

function normalizeWorkMinutesState(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampWorkMinutes(value)
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    if (Number.isFinite(parsed)) return clampWorkMinutes(parsed)
  }
  return DEFAULT_WORK_MINUTES
}

function persistWorkMinutes(minutes: number) {
  try {
    localStorage.setItem(WORK_MINUTES_KEY, String(minutes))
    localStorage.setItem(WORK_MINUTES_UPDATED_KEY, String(Date.now()))
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

export function addWorkMinutes(iso: string, minutes: number): Date {
  return new Date(new Date(iso).getTime() + minutes * 60 * 1000)
}

export function isoToTimeInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function workProgress(clockIn: Date, clockOut: Date, now = new Date()): number {
  const total = clockOut.getTime() - clockIn.getTime()
  if (total <= 0) return 1
  const elapsed = now.getTime() - clockIn.getTime()
  return Math.min(1, Math.max(0, elapsed / total))
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
  const loadedWorkMinutes = loadWorkMinutes()
  const workMinutesState = ref(normalizeWorkMinutesState(loadedWorkMinutes.minutes))
  const today = ref(todayKey())

  // 只有从旧版整点小时折算过来时才落盘一次。
  // 读不到值时**不写回**：以前这里无条件 persist，一旦某次没读到就把默认 9 小时写死，
  // 等于把用户自己设的工时单程销毁 —— 表现就是「每次打开都被重置成 9 小时」。
  if (loadedWorkMinutes.source === 'legacy') persistWorkMinutes(workMinutesState.value)

  const workMinutes = computed(() => workMinutesState.value)

  const todayRecord = computed(() => records.value[today.value] ?? null)

  const clockInTime = computed(() =>
    todayRecord.value ? new Date(todayRecord.value.clockIn) : null
  )

  const clockOutTime = computed(() => {
    if (!todayRecord.value) return null
    return addWorkMinutes(todayRecord.value.clockIn, workMinutesState.value)
  })

  const reminderFireTime = computed(() => {
    const out = clockOutTime.value
    if (!out) return null
    return new Date(out.getTime() - REMINDER_BEFORE_MINUTES * 60 * 1000)
  })

  const reminderEnabled = computed(() => reminder.value.enabled)

  const recordMap = computed(() => records.value)

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
    deleteRecord(today.value)
  }

  function deleteRecord(dateKey: string) {
    refreshToday()
    const next = { ...records.value }
    delete next[dateKey]
    records.value = next
    persistRecords(records.value)
    if (dateKey === today.value && reminder.value.firedDateKey === dateKey) {
      reminder.value = { ...reminder.value, firedDateKey: null }
      persistReminder(reminder.value)
    }
  }

  function setReminderEnabled(enabled: boolean) {
    reminder.value = { ...reminder.value, enabled }
    persistReminder(reminder.value)
  }

  function setWorkMinutes(minutes: number) {
    const next = normalizeWorkMinutesState(minutes)
    workMinutesState.value = next
    persistWorkMinutes(next)
    if (reminder.value.firedDateKey === today.value) {
      reminder.value = { ...reminder.value, firedDateKey: null }
      persistReminder(reminder.value)
    }
  }

  /** 小时 + 分钟两格一起提交 */
  function setWorkDurationFromInput(hoursInput: string, minutesInput: string): boolean {
    const parsed = parseWorkDurationInput(hoursInput, minutesInput)
    if (parsed === null) return false
    setWorkMinutes(parsed)
    return true
  }

  function markReminderFired(dateKey = today.value) {
    reminder.value = { ...reminder.value, firedDateKey: dateKey }
    persistReminder(reminder.value)
  }

  async function syncReminderSchedule() {
    refreshToday()

    if (!reminder.value.enabled || !todayRecord.value) {
      await window.workbench.clearReminder(ATTENDANCE_REMINDER_KEY)
      return null
    }

    const fireAt = reminderFireTime.value
    if (!fireAt) {
      await window.workbench.clearReminder(ATTENDANCE_REMINDER_KEY)
      return null
    }

    const clockOut = clockOutTime.value
    const body = clockOut
      ? `还有 ${REMINDER_BEFORE_MINUTES} 分钟下班（${formatClockTime(clockOut.toISOString())}）`
      : `还有 ${REMINDER_BEFORE_MINUTES} 分钟下班。`

    return window.workbench.syncReminder(
      {
        enabled: true,
        fireAt: fireAt.toISOString(),
        dateKey: today.value,
        firedDateKey: reminder.value.firedDateKey,
        title: 'Workbench 下班提醒',
        body
      },
      ATTENDANCE_REMINDER_KEY
    )
  }

  return {
    today,
    todayRecord,
    records: recordMap,
    workMinutes,
    clockInTime,
    clockOutTime,
    reminderFireTime,
    reminder,
    reminderEnabled,
    clockIn,
    setClockInTime,
    resetToday,
    deleteRecord,
    refreshToday,
    setReminderEnabled,
    setWorkMinutes,
    setWorkDurationFromInput,
    markReminderFired,
    syncReminderSchedule
  }
})

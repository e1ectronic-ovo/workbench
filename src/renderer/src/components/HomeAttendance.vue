<template>
  <div class="home-panel countdown">
    <div class="panel-head">
      <span class="panel-title">下班倒计时</span>
      <span class="panel-date">{{ todayLabel }}</span>
    </div>

    <template v-if="hasClockIn">
      <div class="countdown-hero" :class="countdownPhase">
        <span class="countdown-hero__value">{{ countdownDisplay }}</span>
        <span class="countdown-hero__hint">{{ countdownHint }}</span>
      </div>

      <div class="countdown-progress" aria-hidden="true">
        <div class="countdown-progress__bar" :style="{ width: `${progressPercent}%` }" />
      </div>

      <div class="countdown-meta">
        <span>上班 {{ clockInLabel }}</span>
        <span>下班 {{ clockOutLabel }}</span>
      </div>
    </template>

    <div v-else class="countdown-empty">
      <p class="countdown-empty__text">今天还没记录上班</p>
      <button type="button" class="mac-btn mac-btn--primary clock-in-btn" @click="clockInNow">
        现在上班
      </button>
    </div>

    <div class="panel-foot">
      <label class="reminder-toggle">
        <input
          type="checkbox"
          :checked="attendance.reminder.enabled"
          @change="onReminderToggle"
        />
        <span>下班提醒</span>
      </label>
      <div class="panel-actions">
        <button type="button" class="link-btn" @click="openHistory">历史</button>
        <button type="button" class="link-btn" @click="openEdit">编辑</button>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="editOpen" class="mac-sheet-backdrop attendance-sheet-backdrop">
      <form class="mac-sheet" @submit.prevent="saveEdit">
        <h2 class="mac-sheet__title">{{ hasClockIn ? '编辑今日记录' : '新增今日记录' }}</h2>

        <label class="mac-field">
          <span>上班时间</span>
          <div class="time-field__row">
            <input
              v-model="editTime"
              class="time-input"
              type="time"
              step="60"
              required
            />
            <button type="button" class="mac-btn mac-btn--ghost now-btn" @click="fillEditNow">
              现在
            </button>
          </div>
        </label>

        <label class="mac-field">
          <span>每日工时</span>
          <div class="work-duration">
            <div class="work-duration__cell">
              <input
                class="work-hours-input"
                :value="editHours"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="2"
                placeholder="9"
                @input="onDurationInput('hours', $event)"
                @keydown="onDurationKeydown"
                @blur="normalizeDurationInputs"
              />
              <span class="work-duration__unit">小时</span>
            </div>
            <div class="work-duration__cell">
              <input
                class="work-hours-input work-minutes-input"
                :value="editMinutes"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="2"
                placeholder="0"
                @input="onDurationInput('minutes', $event)"
                @keydown="onDurationKeydown"
                @blur="normalizeDurationInputs"
              />
              <span class="work-duration__unit">分钟</span>
            </div>
          </div>
        </label>

        <p v-if="editError" class="sheet-warn">{{ editError }}</p>

        <div class="sheet-actions">
          <button
            v-if="hasClockIn"
            type="button"
            class="mac-btn mac-btn--ghost sheet-actions__danger"
            @click="clearEdit"
          >
            清除
          </button>
          <div class="sheet-actions__main">
            <button type="button" class="mac-btn mac-btn--ghost" @click="closeEdit">取消</button>
            <button type="submit" class="mac-btn mac-btn--primary">保存</button>
          </div>
        </div>
      </form>
    </div>

    <div v-if="historyOpen" class="mac-sheet-backdrop attendance-sheet-backdrop">
      <div class="mac-sheet history-sheet">
        <h2 class="mac-sheet__title">打卡历史</h2>
        <AttendanceHistoryCalendar ref="historyCalendarRef" />

        <div class="sheet-actions sheet-actions--end">
          <button type="button" class="mac-btn mac-btn--ghost" @click="closeHistory">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import AttendanceHistoryCalendar from './AttendanceHistoryCalendar.vue'
import {
  DEFAULT_WORK_MINUTES,
  formatClockTime,
  formatCountdown,
  formatWorkDuration,
  isoToTimeInput,
  MAX_WORK_MINUTES,
  MIN_WORK_MINUTES,
  sanitizeDurationInput,
  splitWorkMinutes,
  useAttendanceStore,
  workProgress
} from '../stores/attendance'

const WORK_DURATION_NAV_KEYS = new Set([
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'Home',
  'End'
])

const attendance = useAttendanceStore()
const now = ref(Date.now())
const editOpen = ref(false)
const historyOpen = ref(false)
const editTime = ref('')
const editHours = ref(String(Math.floor(DEFAULT_WORK_MINUTES / 60)))
const editMinutes = ref(String(DEFAULT_WORK_MINUTES % 60))
const editError = ref('')
const historyCalendarRef = ref<InstanceType<typeof AttendanceHistoryCalendar> | null>(null)

const todayLabel = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
})

const hasClockIn = computed(() => !!attendance.todayRecord)

const clockInLabel = computed(() => {
  if (!attendance.clockInTime) return '—'
  return formatClockTime(attendance.clockInTime.toISOString())
})

const clockOutLabel = computed(() => {
  if (!attendance.clockOutTime) return '—'
  return formatClockTime(attendance.clockOutTime.toISOString())
})

const remainingMs = computed(() => {
  const out = attendance.clockOutTime
  if (!out) return 0
  return out.getTime() - now.value
})

const isDone = computed(() => hasClockIn.value && remainingMs.value <= 0)

const countdownPhase = computed(() => {
  if (isDone.value) return 'is-done'
  if (remainingMs.value <= 30 * 60 * 1000) return 'is-soon'
  return ''
})

const countdownDisplay = computed(() => {
  if (isDone.value) return '已下班'
  return formatCountdown(remainingMs.value)
})

const countdownHint = computed(() => {
  if (isDone.value) {
    return `今日工时已满 ${formatWorkDuration(attendance.workMinutes || DEFAULT_WORK_MINUTES)}`
  }
  const out = attendance.clockOutTime
  if (!out) return ''
  return `${formatClockTime(out.toISOString())} 下班`
})

const progressPercent = computed(() => {
  const start = attendance.clockInTime
  const end = attendance.clockOutTime
  if (!start || !end) return 0
  return Math.round(workProgress(start, end, new Date(now.value)) * 100)
})

function clockInNow() {
  attendance.clockIn()
}

function openEdit() {
  editError.value = ''
  editTime.value = attendance.todayRecord
    ? isoToTimeInput(attendance.todayRecord.clockIn)
    : isoToTimeInput(new Date().toISOString())
  const parts = splitWorkMinutes(attendance.workMinutes || DEFAULT_WORK_MINUTES)
  editHours.value = String(parts.hours)
  editMinutes.value = String(parts.minutes)
  editOpen.value = true
}

function onDurationInput(field: 'hours' | 'minutes', e: Event) {
  const input = e.target as HTMLInputElement
  const digits = sanitizeDurationInput(input.value)
  if (field === 'hours') editHours.value = digits
  else editMinutes.value = digits
  input.value = digits
}

function onDurationKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (WORK_DURATION_NAV_KEYS.has(e.key)) return
  if (/^\d$/.test(e.key)) return
  e.preventDefault()
}

/**
 * 失焦时把两格理顺：分钟超过 59 自动进位到小时，总时长夹到 24 小时以内。
 * 两格都空着就还原成当前设置，避免留下一个空表单。
 */
function normalizeDurationInputs() {
  if (!editHours.value && !editMinutes.value) {
    const parts = splitWorkMinutes(attendance.workMinutes || DEFAULT_WORK_MINUTES)
    editHours.value = String(parts.hours)
    editMinutes.value = String(parts.minutes)
    return
  }
  const hours = parseInt(editHours.value || '0', 10)
  const minutes = parseInt(editMinutes.value || '0', 10)
  const raw = (Number.isNaN(hours) ? 0 : hours) * 60 + (Number.isNaN(minutes) ? 0 : minutes)
  const parts = splitWorkMinutes(Math.min(MAX_WORK_MINUTES, Math.max(0, raw)))
  editHours.value = String(parts.hours)
  editMinutes.value = String(parts.minutes)
}

function closeEdit() {
  editOpen.value = false
  editError.value = ''
}

function fillEditNow() {
  editTime.value = isoToTimeInput(new Date().toISOString())
}

function saveEdit() {
  editError.value = ''
  if (!attendance.setWorkDurationFromInput(editHours.value, editMinutes.value)) {
    editError.value = `每日工时需在 ${MIN_WORK_MINUTES} 分钟到 ${MAX_WORK_MINUTES / 60} 小时之间`
    return
  }
  if (!editTime.value) {
    editError.value = '请选择上班时间'
    return
  }
  if (!attendance.setClockInTime(editTime.value)) {
    editError.value = '时间格式无效'
    return
  }
  closeEdit()
}

function clearEdit() {
  attendance.resetToday()
  closeEdit()
}

function openHistory() {
  historyOpen.value = true
  void nextTick(() => historyCalendarRef.value?.resetView())
}

function closeHistory() {
  historyOpen.value = false
}

function onReminderToggle(e: Event) {
  attendance.setReminderEnabled((e.target as HTMLInputElement).checked)
}

let dayTimer: ReturnType<typeof setInterval> | undefined
let tickTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  attendance.refreshToday()
  dayTimer = setInterval(() => attendance.refreshToday(), 60_000)
  tickTimer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onBeforeUnmount(() => {
  if (dayTimer) clearInterval(dayTimer)
  if (tickTimer) clearInterval(tickTimer)
})
</script>

<style scoped>
.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: 8px;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.panel-date {
  font-size: 11px;
  color: var(--text-muted);
}

.countdown-hero {
  text-align: center;
  padding: 4px 0 6px;
}

.countdown-hero__value {
  display: block;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
  color: var(--accent);
  line-height: 1.1;
}

.countdown-hero.is-soon .countdown-hero__value {
  color: #f59e0b;
}

.countdown-hero.is-done .countdown-hero__value {
  font-size: 24px;
  color: #22c55e;
}

.countdown-hero__hint {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.countdown-progress {
  height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--border) 70%, transparent);
  overflow: hidden;
  margin: 2px 0 8px;
}

.countdown-progress__bar {
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 1s linear;
}

.countdown-hero.is-soon + .countdown-progress .countdown-progress__bar {
  background: #f59e0b;
}

.countdown-hero.is-done + .countdown-progress .countdown-progress__bar {
  background: #22c55e;
}

.countdown-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.countdown-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  padding: 8px 0 12px;
}

.countdown-empty__text {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.clock-in-btn {
  min-width: 112px;
  height: 32px;
}

.panel-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.reminder-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text);
  cursor: pointer;
}

.reminder-toggle input {
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
}

.link-btn {
  font-size: 12px;
  color: var(--text-muted);
  padding: 2px 6px;
  border-radius: 4px;
}

.link-btn:hover {
  color: var(--accent);
  background: var(--surface-hover);
}

.time-field__row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.time-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.time-input:focus {
  border-color: var(--border-focus);
  outline: none;
}

.now-btn {
  height: 32px;
  padding: 0 10px;
  flex-shrink: 0;
  font-size: 12px;
}

.work-duration {
  display: flex;
  align-items: center;
  gap: 8px;
}

.work-duration__cell {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.work-duration__unit {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.work-hours-input {
  flex: 1 1 0;
  min-width: 0;
  width: auto;
  box-sizing: border-box;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.work-minutes-input {
  font-family: var(--font-mono);
}

.sheet-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: var(--space-4);
}

.sheet-actions--end {
  justify-content: flex-end;
}

.sheet-actions__main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.sheet-actions__danger {
  color: var(--text-muted);
}

.sheet-actions__danger:hover:not(:disabled) {
  color: #ef4444;
}

.sheet-warn {
  margin: 0;
  font-size: 12px;
  color: #ef4444;
}

.confirm-text {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.history-sheet {
  width: min(400px, 100%);
}

.mac-sheet.narrow {
  width: min(360px, 100%);
}

.attendance-sheet-backdrop {
  z-index: 1100;
}

.attendance-sheet-backdrop.is-confirm {
  z-index: 1110;
}
</style>

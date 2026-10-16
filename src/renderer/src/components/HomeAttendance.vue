<template>
  <div class="home-panel">
    <div class="panel-head">
      <span class="panel-title">今日打卡</span>
      <span class="panel-date">{{ todayLabel }}</span>
    </div>

    <div class="panel-grid">
      <label class="time-field">
        <span class="time-field__label">上班时间</span>
        <div class="time-field__row">
          <input
            v-model="timeInput"
            class="time-input"
            type="time"
            step="60"
            @change="onTimeChange"
          />
          <button type="button" class="mac-btn mac-btn--ghost now-btn" @click="fillNow">
            现在
          </button>
        </div>
      </label>

      <div class="time-block">
        <span class="time-label">下班</span>
        <span class="time-value accent">{{ clockOutLabel }}</span>
        <span class="time-hint">+{{ WORK_HOURS }}h</span>
      </div>
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
      <button
        v-if="attendance.todayRecord"
        type="button"
        class="link-btn"
        @click="onClear"
      >
        清除
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  addWorkHours,
  formatClockTime,
  isoToTimeInput,
  useAttendanceStore,
  WORK_HOURS
} from '../stores/attendance'

const attendance = useAttendanceStore()
const timeInput = ref('')

const todayLabel = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
})

const clockOutLabel = computed(() => {
  const t = timeInput.value
  if (!t) {
    if (attendance.clockOutTime) {
      return formatClockTime(attendance.clockOutTime.toISOString())
    }
    return '—'
  }
  const parts = t.split(':').map(Number)
  if (parts.length < 2 || parts.some(Number.isNaN)) return '—'
  const d = new Date()
  d.setHours(parts[0], parts[1], 0, 0)
  return formatClockTime(addWorkHours(d.toISOString(), WORK_HOURS).toISOString())
})

function syncFromStore() {
  timeInput.value = attendance.todayRecord
    ? isoToTimeInput(attendance.todayRecord.clockIn)
    : ''
}

function onTimeChange() {
  if (!timeInput.value) {
    attendance.resetToday()
    return
  }
  attendance.setClockInTime(timeInput.value)
}

function fillNow() {
  const now = new Date()
  timeInput.value = isoToTimeInput(now.toISOString())
  attendance.clockIn(now)
}

function onClear() {
  attendance.resetToday()
  timeInput.value = ''
}

function onReminderToggle(e: Event) {
  attendance.setReminderEnabled((e.target as HTMLInputElement).checked)
}

watch(() => attendance.todayRecord?.clockIn, syncFromStore)

let dayTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  attendance.refreshToday()
  syncFromStore()
  dayTimer = setInterval(() => attendance.refreshToday(), 60_000)
})

onBeforeUnmount(() => {
  if (dayTimer) clearInterval(dayTimer)
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

.panel-grid {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px 12px;
  align-items: end;
}

.time-field {
  display: block;
  min-width: 0;
}

.time-field__label {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.time-field__row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.time-input {
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.time-field__row .time-input {
  flex: 1;
  min-width: 0;
}

.time-input:focus {
  border-color: var(--border-focus);
  outline: none;
}

.now-btn {
  height: 30px;
  padding: 0 10px;
  flex-shrink: 0;
  font-size: 12px;
}

.time-block {
  text-align: right;
  padding-bottom: 1px;
}

.time-label {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 0;
}

.time-value {
  display: block;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  line-height: 1.15;
}

.time-value.accent {
  color: var(--accent);
}

.time-hint {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 1px;
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
  padding: 2px 4px;
  border-radius: 4px;
}

.link-btn:hover {
  color: var(--accent);
  background: var(--surface-hover);
}
</style>

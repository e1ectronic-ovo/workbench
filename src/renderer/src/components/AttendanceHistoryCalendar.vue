<template>
  <div class="attendance-calendar">
    <div class="calendar-nav">
      <button type="button" class="calendar-nav__btn" aria-label="上个月" @click="prevMonth">
        ‹
      </button>
      <span class="calendar-nav__label">{{ monthLabel }}</span>
      <button type="button" class="calendar-nav__btn" aria-label="下个月" @click="nextMonth">
        ›
      </button>
    </div>

    <div class="calendar-weekdays" aria-hidden="true">
      <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
    </div>

    <div class="calendar-grid" role="grid" :aria-label="`${monthLabel}打卡日历`">
      <button
        v-for="cell in cells"
        :key="cell.dateKey"
        type="button"
        class="calendar-cell"
        :class="{
          'is-outside': !cell.inMonth,
          'is-today': cell.isToday,
          'has-record': !!cell.clockIn,
          'is-selected': cell.dateKey === selectedDateKey
        }"
        role="gridcell"
        :aria-selected="cell.dateKey === selectedDateKey"
        :aria-label="cellLabel(cell)"
        @click="selectCell(cell)"
      >
        <span class="calendar-cell__day">{{ cell.day }}</span>
        <span v-if="cell.clockIn" class="calendar-cell__time">
          {{ formatClockTime(cell.clockIn) }}
        </span>
      </button>
    </div>

    <div v-if="selectedCell" class="calendar-detail">
      <p class="calendar-detail__text">
        {{ formatDateKeyLabel(selectedCell.dateKey) }}
        <template v-if="selectedCell.clockIn">
          · {{ formatClockTime(selectedCell.clockIn) }} 上班
        </template>
        <template v-else> · 未打卡</template>
      </p>
      <button
        v-if="selectedCell.clockIn"
        type="button"
        class="calendar-detail__delete"
        @click="pendingDelete = selectedCell.dateKey"
      >
        删除
      </button>
    </div>
    <p v-else class="calendar-hint">点击日期查看打卡时间</p>

  </div>

  <Teleport to="body">
    <div
      v-if="pendingDelete"
      class="mac-sheet-backdrop attendance-sheet-backdrop is-confirm"
    >
      <div class="mac-sheet narrow">
        <h2 class="mac-sheet__title">删除记录</h2>
        <p class="confirm-text">
          确定删除「{{ formatDateKeyLabel(pendingDelete) }}」的打卡记录？
        </p>
        <div class="sheet-actions sheet-actions--end">
          <button type="button" class="mac-btn mac-btn--ghost" @click="pendingDelete = null">
            取消
          </button>
          <button type="button" class="mac-btn mac-btn--danger" @click="confirmDelete">
            删除
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { buildCalendarCells, formatMonthLabel, type CalendarCell } from '../lib/attendance-calendar'
import {
  attendanceDateKey,
  formatClockTime,
  formatDateKeyLabel,
  useAttendanceStore
} from '../stores/attendance'

const attendance = useAttendanceStore()

const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth())
const selectedDateKey = ref<string | null>(attendance.today)
const pendingDelete = ref<string | null>(null)

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

const monthLabel = computed(() => formatMonthLabel(viewYear.value, viewMonth.value))

const cells = computed(() =>
  buildCalendarCells(viewYear.value, viewMonth.value, attendance.records)
)

const selectedCell = computed(() => {
  if (!selectedDateKey.value) return null
  return cells.value.find((cell) => cell.dateKey === selectedDateKey.value) ?? null
})

function resetView() {
  const now = new Date()
  viewYear.value = now.getFullYear()
  viewMonth.value = now.getMonth()
  selectedDateKey.value = attendance.today
  pendingDelete.value = null
}

watch(
  () => attendance.today,
  (today) => {
    if (!selectedDateKey.value) selectedDateKey.value = today
  }
)

defineExpose({ resetView })

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value -= 1
  } else {
    viewMonth.value -= 1
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value += 1
  } else {
    viewMonth.value += 1
  }
}

function selectCell(cell: CalendarCell) {
  selectedDateKey.value = cell.dateKey
  if (!cell.inMonth) {
    const parts = cell.dateKey.split('-').map(Number)
    if (parts.length >= 2 && !parts.some(Number.isNaN)) {
      viewYear.value = parts[0]
      viewMonth.value = parts[1] - 1
    }
  }
}

function cellLabel(cell: CalendarCell): string {
  const date = formatDateKeyLabel(cell.dateKey)
  if (!cell.clockIn) return `${date}，未打卡`
  return `${date}，${formatClockTime(cell.clockIn)} 上班`
}

function confirmDelete() {
  if (!pendingDelete.value) return
  attendance.deleteRecord(pendingDelete.value)
  pendingDelete.value = null
  if (selectedDateKey.value === attendanceDateKey()) {
    selectedDateKey.value = attendance.today
  }
}
</script>

<style scoped>
.attendance-calendar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.calendar-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.calendar-nav__label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.01em;
}

.calendar-nav__btn {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
}

.calendar-nav__btn:hover {
  color: var(--text);
  background: var(--surface-hover);
}

.calendar-weekdays,
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 4px;
}

.calendar-weekdays span {
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  padding: 2px 0;
}

.calendar-cell {
  min-height: 52px;
  padding: 4px 2px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  cursor: pointer;
  transition:
    background var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}

.calendar-cell:hover {
  background: var(--surface-hover);
}

.calendar-cell.is-outside {
  opacity: 0.38;
}

.calendar-cell.is-today .calendar-cell__day {
  color: var(--accent);
  font-weight: 700;
}

.calendar-cell.has-record {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.calendar-cell.has-record:hover {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}

.calendar-cell.is-selected {
  border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.calendar-cell__day {
  font-size: 12px;
  line-height: 1.2;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.calendar-cell__time {
  font-size: 10px;
  line-height: 1.1;
  color: var(--accent);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.calendar-detail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 36px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg);
}

.calendar-detail__text {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.calendar-detail__delete {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-muted);
  padding: 2px 6px;
  border-radius: 4px;
}

.calendar-detail__delete:hover {
  color: #ef4444;
  background: var(--surface-hover);
}

.calendar-hint {
  margin: 0;
  min-height: 36px;
  padding: 8px 2px;
  font-size: 12px;
  color: var(--text-muted);
}

.confirm-text {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.sheet-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: var(--space-4);
}

.mac-sheet.narrow {
  width: min(360px, 100%);
}

.attendance-sheet-backdrop {
  z-index: 1110;
}

.attendance-sheet-backdrop.is-confirm {
  z-index: 1120;
}
</style>

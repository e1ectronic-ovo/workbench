import { onBeforeUnmount, onMounted, watch } from 'vue'
import { ATTENDANCE_REMINDER_KEY, useAttendanceStore } from '../stores/attendance'

export function useReminderSync() {
  const attendance = useAttendanceStore()

  async function sync() {
    try {
      await attendance.syncReminderSchedule()
    } catch {
      /* ignore */
    }
  }

  watch(
    () => [
      attendance.reminder.enabled,
      attendance.today,
      attendance.reminder.firedDateKey,
      attendance.todayRecord?.clockIn,
      attendance.workMinutes
    ],
    () => {
      void sync()
    }
  )

  let offFired: (() => void) | undefined

  onMounted(() => {
    attendance.refreshToday()
    void sync()
    offFired = window.workbench.onReminderFired(({ key, dateKey }) => {
      // 便签提醒也走同一条通道，别把它当成下班提醒记成"已触发"
      if (key && key !== ATTENDANCE_REMINDER_KEY) return
      attendance.markReminderFired(dateKey)
      void sync()
    })
  })

  onBeforeUnmount(() => {
    offFired?.()
  })
}

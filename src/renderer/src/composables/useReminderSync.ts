import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useAttendanceStore } from '../stores/attendance'

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
      attendance.todayRecord?.clockIn
    ],
    () => {
      void sync()
    }
  )

  let offFired: (() => void) | undefined

  onMounted(() => {
    attendance.refreshToday()
    void sync()
    offFired = window.workbench.onReminderFired(({ dateKey }) => {
      attendance.markReminderFired(dateKey)
      void sync()
    })
  })

  onBeforeUnmount(() => {
    offFired?.()
  })
}

import { attendanceDateKey, type DayAttendance } from '../stores/attendance'

export interface CalendarCell {
  dateKey: string
  day: number
  inMonth: boolean
  isToday: boolean
  clockIn: string | null
}

type AttendanceMap = Record<string, DayAttendance>

export function buildCalendarCells(
  year: number,
  month: number,
  records: AttendanceMap,
  base = new Date()
): CalendarCell[] {
  const todayKey = attendanceDateKey(base)
  const cells: CalendarCell[] = []
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const date = new Date(year, month, -i)
    pushCell(cells, date, false, todayKey, records)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    pushCell(cells, new Date(year, month, day), true, todayKey, records)
  }

  let nextDay = 1
  while (cells.length < 42) {
    pushCell(cells, new Date(year, month + 1, nextDay), false, todayKey, records)
    nextDay += 1
  }

  return cells
}

function pushCell(
  cells: CalendarCell[],
  date: Date,
  inMonth: boolean,
  todayKey: string,
  records: AttendanceMap
) {
  const dateKey = attendanceDateKey(date)
  cells.push({
    dateKey,
    day: date.getDate(),
    inMonth,
    isToday: dateKey === todayKey,
    clockIn: records[dateKey]?.clockIn ?? null
  })
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long'
  })
}

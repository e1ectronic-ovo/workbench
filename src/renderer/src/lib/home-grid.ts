export interface GridItem {
  id: string
  enabled?: boolean
  col: number
  row: number
  colSpan: number
  rowSpan: number
}

export function widgetCells(
  item: Pick<GridItem, 'col' | 'row' | 'colSpan' | 'rowSpan'>,
  columns: number
): string[] {
  const colSpan = Math.min(Math.max(1, item.colSpan), columns)
  const rowSpan = Math.max(1, item.rowSpan)
  const col = Math.min(Math.max(1, item.col), columns - colSpan + 1)
  const row = Math.max(1, item.row)
  const cells: string[] = []
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) cells.push(`${c},${r}`)
  }
  return cells
}

export function widgetsOverlap(a: GridItem, b: GridItem, columns: number): boolean {
  const taken = new Set(widgetCells(a, columns))
  return widgetCells(b, columns).some((cell) => taken.has(cell))
}

export function findFreeSlot<T extends GridItem>(
  widget: T,
  occupied: T[],
  columns: number,
  prefer?: { col: number; row: number }
): { col: number; row: number } {
  const colSpan = Math.min(Math.max(1, widget.colSpan), columns)
  const maxOccupiedRow = occupied.reduce((max, item) => Math.max(max, item.row + item.rowSpan - 1), 1)
  const maxRow = maxOccupiedRow + Math.max(1, widget.rowSpan) + 6

  const fits = (col: number, row: number) => {
    const candidate = { ...widget, col, row, colSpan }
    return !occupied.some((item) => widgetsOverlap(candidate, item, columns))
  }

  const startRow = prefer ? Math.max(1, prefer.row) : 1
  if (prefer) {
    const col = Math.min(Math.max(1, prefer.col), columns - colSpan + 1)
    if (fits(col, startRow)) return { col, row: startRow }
  }

  for (let row = startRow; row <= maxRow; row++) {
    for (let col = 1; col <= columns - colSpan + 1; col++) {
      if (fits(col, row)) return { col, row }
    }
  }

  for (let row = 1; row < startRow; row++) {
    for (let col = 1; col <= columns - colSpan + 1; col++) {
      if (fits(col, row)) return { col, row }
    }
  }

  return { col: 1, row: maxRow }
}

export function resolveOverlaps<T extends GridItem>(widgets: T[], columns: number): T[] {
  const disabled = widgets.filter((item) => item.enabled === false)
  const enabled = widgets
    .filter((item) => item.enabled !== false)
    .sort((a, b) => a.row - b.row || a.col - b.col || a.id.localeCompare(b.id))

  const placed: T[] = []
  for (const item of enabled) {
    const colSpan = Math.min(Math.max(1, item.colSpan), columns)
    const slot = findFreeSlot(item, placed, columns, { col: item.col, row: item.row })
    placed.push({ ...item, col: slot.col, row: slot.row, colSpan })
  }

  const byId = new Map([...placed, ...disabled].map((item) => [item.id, item]))
  return widgets.map((item) => byId.get(item.id) ?? item)
}

/** 旧默认：倒计时占 1–2 行，天气从第 2 行同列开始，会叠在一起 */
export function isLegacyStackedHomeLayout(widgets: GridItem[]): boolean {
  const attendance = widgets.find((item) => item.id === 'attendance')
  const weather = widgets.find((item) => item.id === 'weather')
  if (!attendance || !weather) return false
  return (
    attendance.col === 1 &&
    attendance.row === 1 &&
    attendance.colSpan === 2 &&
    attendance.rowSpan === 2 &&
    weather.col === 1 &&
    weather.row === 2 &&
    weather.colSpan === 2 &&
    weather.rowSpan === 1
  )
}

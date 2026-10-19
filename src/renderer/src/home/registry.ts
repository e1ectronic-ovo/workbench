import type { Component } from 'vue'
import HomeAttendance from '../components/HomeAttendance.vue'
import HomeNotes from '../components/HomeNotes.vue'
import HomeWeather from '../components/HomeWeather.vue'

export type HomeWidgetId = 'attendance' | 'weather' | 'notes'

export interface HomeWidgetGridDef {
  col: number
  row: number
  colSpan: number
  rowSpan: number
}

export interface HomeWidgetDef {
  id: HomeWidgetId
  name: string
  description: string
  defaultEnabled: boolean
  component: Component
  grid: HomeWidgetGridDef
}

/** 首页组件注册表；新增功能时在此追加条目即可 */
export const HOME_WIDGET_DEFS: HomeWidgetDef[] = [
  {
    id: 'attendance',
    name: '下班倒计时',
    description: '记录上班时间，实时显示距离下班还有多久',
    defaultEnabled: true,
    component: HomeAttendance,
    grid: { col: 1, row: 1, colSpan: 2, rowSpan: 2 }
  },
  {
    id: 'weather',
    name: '天气',
    description: '显示当地天气与三日预报',
    defaultEnabled: true,
    component: HomeWeather,
    grid: { col: 3, row: 1, colSpan: 2, rowSpan: 2 }
  },
  {
    id: 'notes',
    name: '便签',
    description: '本地几条备忘，关掉网页也还在',
    defaultEnabled: true,
    component: HomeNotes,
    grid: { col: 1, row: 3, colSpan: 4, rowSpan: 2 }
  }
]

const defById = new Map(HOME_WIDGET_DEFS.map((d) => [d.id, d]))

export function homeWidgetDef(id: HomeWidgetId): HomeWidgetDef | undefined {
  return defById.get(id)
}

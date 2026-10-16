import type { Component } from 'vue'
import HomeAttendance from '../components/HomeAttendance.vue'
import HomeWeather from '../components/HomeWeather.vue'

export type HomeWidgetId = 'attendance' | 'weather'

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
    name: '今日打卡',
    description: '记录上班时间，自动推算下班时间',
    defaultEnabled: true,
    component: HomeAttendance,
    grid: { col: 1, row: 1, colSpan: 2, rowSpan: 1 }
  },
  {
    id: 'weather',
    name: '天气',
    description: '显示当地天气与三日预报',
    defaultEnabled: true,
    component: HomeWeather,
    grid: { col: 1, row: 2, colSpan: 2, rowSpan: 1 }
  }
]

const defById = new Map(HOME_WIDGET_DEFS.map((d) => [d.id, d]))

export function homeWidgetDef(id: HomeWidgetId): HomeWidgetDef | undefined {
  return defById.get(id)
}

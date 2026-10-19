import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  HOME_WIDGET_DEFS,
  homeWidgetDef,
  type HomeWidgetDef,
  type HomeWidgetGridDef,
  type HomeWidgetId
} from '../home/registry'
import { findFreeSlot, isLegacyStackedHomeLayout, resolveOverlaps } from '../lib/home-grid'

export interface HomeWidgetConfig {
  id: HomeWidgetId
  enabled: boolean
  col: number
  row: number
  colSpan: number
  rowSpan: number
}

export interface HomeLayoutSettings {
  /** 栅格列数 */
  columns: number
  /** 栅格间距 px */
  gap: number
  /** 组件背景不透明度 0–100，0 为全透明 */
  panelOpacity: number
}

interface HomeState {
  layout: HomeLayoutSettings
  widgets: HomeWidgetConfig[]
}

const STORAGE_KEY = 'workbench.home-v2'

const DEFAULT_LAYOUT: HomeLayoutSettings = {
  columns: 6,
  gap: 12,
  panelOpacity: 42
}

function defaultWidgetConfig(def: HomeWidgetDef): HomeWidgetConfig {
  return {
    id: def.id,
    enabled: def.defaultEnabled,
    ...def.grid
  }
}

function defaultState(): HomeState {
  return {
    layout: { ...DEFAULT_LAYOUT },
    widgets: HOME_WIDGET_DEFS.map(defaultWidgetConfig)
  }
}

function isGrid(x: unknown): x is HomeWidgetGridDef {
  if (!x || typeof x !== 'object') return false
  const g = x as Record<string, unknown>
  return (
    typeof g.col === 'number' &&
    typeof g.row === 'number' &&
    typeof g.colSpan === 'number' &&
    typeof g.rowSpan === 'number'
  )
}

function isWidgetConfig(x: unknown): x is HomeWidgetConfig {
  if (!x || typeof x !== 'object') return false
  const item = x as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    homeWidgetDef(item.id as HomeWidgetId) !== undefined &&
    typeof item.enabled === 'boolean' &&
    typeof item.col === 'number' &&
    typeof item.row === 'number' &&
    typeof item.colSpan === 'number' &&
    typeof item.rowSpan === 'number'
  )
}

function mergeWithRegistry(widgets: HomeWidgetConfig[]): HomeWidgetConfig[] {
  const source = isLegacyStackedHomeLayout(widgets)
    ? widgets.map((item) => {
        if (item.id !== 'weather') return item
        const weather = homeWidgetDef('weather')
        return weather ? { ...item, ...weather.grid } : item
      })
    : widgets
  const byId = new Map(source.map((w) => [w.id, w]))
  return HOME_WIDGET_DEFS.map((def) => {
    const existing = byId.get(def.id)
    if (!existing) return defaultWidgetConfig(def)
    // 便签曾默认放在第 5 列，窄布局时会落到视野外
    if (
      existing.id === 'notes' &&
      existing.col === 5 &&
      existing.row === 1 &&
      existing.colSpan === 2
    ) {
      return { ...existing, ...def.grid }
    }
    return existing
  })
}

interface LegacyWidgetConfig {
  id: HomeWidgetId
  enabled: boolean
  order?: number
  col?: number
  row?: number
  colSpan?: number
  rowSpan?: number
}

function migrateLegacy(raw: unknown): HomeState | null {
  if (!Array.isArray(raw)) return null
  const legacy = raw.filter((x): x is LegacyWidgetConfig => {
    if (!x || typeof x !== 'object') return false
    const item = x as Record<string, unknown>
    return (
      typeof item.id === 'string' &&
      homeWidgetDef(item.id as HomeWidgetId) !== undefined &&
      typeof item.enabled === 'boolean'
    )
  })

  if (!legacy.length) return null

  const widgets = HOME_WIDGET_DEFS.map((def) => {
    const saved = legacy.find((w) => w.id === def.id)
    if (!saved) return defaultWidgetConfig(def)
    if (isGrid(saved)) {
      return {
        id: def.id,
        enabled: saved.enabled,
        col: saved.col,
        row: saved.row,
        colSpan: saved.colSpan,
        rowSpan: saved.rowSpan
      }
    }
    const row = typeof saved.order === 'number' ? saved.order : def.grid.row
    return {
      id: def.id,
      enabled: saved.enabled,
      col: def.grid.col,
      row,
      colSpan: def.grid.colSpan,
      rowSpan: def.grid.rowSpan
    }
  })

  return { layout: { ...DEFAULT_LAYOUT }, widgets }
}

function loadState(): HomeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as Partial<HomeState>
      if (data.layout && data.widgets && Array.isArray(data.widgets)) {
        const layout: HomeLayoutSettings = {
          columns: clampInt(data.layout.columns, 4, 16, DEFAULT_LAYOUT.columns),
          gap: clampInt(data.layout.gap, 4, 32, DEFAULT_LAYOUT.gap),
          panelOpacity: clampInt(data.layout.panelOpacity, 0, 100, DEFAULT_LAYOUT.panelOpacity)
        }
        const widgets = resolveOverlaps(
          mergeWithRegistry(data.widgets.filter(isWidgetConfig)),
          layout.columns
        )
        return { layout, widgets }
      }
    }

    const legacyRaw = localStorage.getItem('workbench.home-widgets')
    if (legacyRaw) {
      const migrated = migrateLegacy(JSON.parse(legacyRaw) as unknown)
      if (migrated) {
        migrated.widgets = resolveOverlaps(
          mergeWithRegistry(migrated.widgets),
          migrated.layout.columns
        )
        return migrated
      }
    }
  } catch {
    /* ignore */
  }
  return defaultState()
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? Math.round(value) : fallback
  return Math.min(max, Math.max(min, n))
}

export const useHomeWidgetsStore = defineStore('homeWidgets', () => {
  const state = ref<HomeState>(loadState())

  const layout = computed(() => state.value.layout)

  const enabledWidgets = computed(() =>
    state.value.widgets
      .filter((w) => w.enabled)
      .map((config) => {
        const def = homeWidgetDef(config.id)
        if (!def) return null
        return { config, def }
      })
      .filter((x): x is { config: HomeWidgetConfig; def: HomeWidgetDef } => x !== null)
  )

  const panelStyleVars = computed(() => {
    const opacity = layout.value.panelOpacity
    return {
      '--home-cols': String(layout.value.columns),
      '--home-gap': `${layout.value.gap}px`,
      '--home-panel-alpha': `${opacity}%`,
      '--home-panel-bg': `color-mix(in srgb, var(--surface-raised) ${opacity}%, transparent)`,
      '--home-panel-border': `color-mix(in srgb, var(--border) ${Math.min(opacity + 18, 100)}%, transparent)`
    }
  })

  function persist(next: HomeState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  persist(state.value)

  function commit(patch: Partial<HomeState>) {
    state.value = { ...state.value, ...patch }
    persist(state.value)
  }

  function setLayout(patch: Partial<HomeLayoutSettings>) {
    const next: HomeLayoutSettings = { ...state.value.layout, ...patch }
    if (patch.columns !== undefined) {
      next.columns = clampInt(patch.columns, 4, 16, DEFAULT_LAYOUT.columns)
    }
    if (patch.gap !== undefined) {
      next.gap = clampInt(patch.gap, 4, 32, DEFAULT_LAYOUT.gap)
    }
    if (patch.panelOpacity !== undefined) {
      next.panelOpacity = clampInt(patch.panelOpacity, 0, 100, DEFAULT_LAYOUT.panelOpacity)
    }

    const widgets =
      patch.columns === undefined
        ? state.value.widgets
        : resolveOverlaps(state.value.widgets, next.columns)
    commit({ layout: next, widgets })
  }

  function setEnabled(id: HomeWidgetId, enabled: boolean) {
    const widgets = resolveOverlaps(
      state.value.widgets.map((w) => (w.id === id ? { ...w, enabled } : w)),
      state.value.layout.columns
    )
    commit({ widgets })
  }

  function setPosition(id: HomeWidgetId, col: number, row: number) {
    const columns = state.value.layout.columns
    const current = state.value.widgets.find((w) => w.id === id)
    if (!current) return

    const colSpan = Math.min(current.colSpan, columns)
    const others = state.value.widgets.filter((w) => w.id !== id && w.enabled)
    const slot = findFreeSlot(
      { ...current, colSpan, enabled: true },
      others,
      columns,
      { col, row }
    )

    const widgets = state.value.widgets.map((w) =>
      w.id === id ? { ...w, col: slot.col, row: slot.row, colSpan } : w
    )
    commit({ widgets })
  }

  function setSpan(id: HomeWidgetId, colSpan: number, rowSpan?: number) {
    const columns = state.value.layout.columns
    const current = state.value.widgets.find((w) => w.id === id)
    if (!current) return

    const span = clampInt(colSpan, 1, columns, current.colSpan)
    const rows = rowSpan !== undefined ? Math.max(1, Math.round(rowSpan)) : current.rowSpan
    const others = state.value.widgets.filter((w) => w.id !== id && w.enabled)
    const candidate = { ...current, colSpan: span, rowSpan: rows, enabled: true }
    const slot = findFreeSlot(candidate, others, columns, { col: current.col, row: current.row })

    const widgets = state.value.widgets.map((w) =>
      w.id === id ? { ...w, col: slot.col, row: slot.row, colSpan: span, rowSpan: rows } : w
    )
    commit({ widgets })
  }

  return {
    layout,
    enabledWidgets,
    allWidgets: computed(() => state.value.widgets),
    panelStyleVars,
    setLayout,
    setEnabled,
    setPosition,
    setSpan,
    definitions: computed(() => HOME_WIDGET_DEFS)
  }
})

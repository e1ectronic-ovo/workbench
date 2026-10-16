import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  DEFAULT_MODULES,
  createModuleId,
  moduleLabel,
  sortModules,
  type ModuleConfig
} from '../modules/registry'

export interface ModuleState {
  url: string
  title: string
  loading: boolean
}

const MODULES_KEY = 'workbench.modules'
const STATE_KEY = 'workbench.module-state'
const MODULE_SEED_KEY = 'workbench.module-seed'
const MODULE_SEED = 3

function applyModuleSeeds(list: ModuleConfig[]): { list: ModuleConfig[]; changed: boolean } {
  const applied = Number(localStorage.getItem(MODULE_SEED_KEY) || '1')
  let next = list
  let changed = false

  if (applied < 3) {
    const filtered = next.filter((m) => m.id !== 'doubao')
    if (filtered.length !== next.length) {
      next = filtered
      changed = true
    }
  }

  return { list: sortModules(next), changed }
}

function isValidModule(m: unknown): m is ModuleConfig {
  if (!m || typeof m !== 'object') return false
  const x = m as Record<string, unknown>
  return (
    typeof x.id === 'string' &&
    typeof x.name === 'string' &&
    typeof x.url === 'string' &&
    typeof x.color === 'string' &&
    (x.glyph === undefined || typeof x.glyph === 'string') &&
    (x.iconPath === undefined || typeof x.iconPath === 'string')
  )
}

function loadModules(): ModuleConfig[] {
  let loaded: ModuleConfig[]
  try {
    const raw = localStorage.getItem(MODULES_KEY)
    // 仅在从未保存过时使用默认；空数组表示用户清空了全部模块
    if (raw === null) {
      loaded = structuredClone(DEFAULT_MODULES)
    } else {
      const data = JSON.parse(raw) as unknown
      if (!Array.isArray(data)) loaded = structuredClone(DEFAULT_MODULES)
      else loaded = sortModules(data.filter(isValidModule))
    }
  } catch {
    loaded = structuredClone(DEFAULT_MODULES)
  }

  const seeded = applyModuleSeeds(loaded)
  try {
    localStorage.setItem(MODULE_SEED_KEY, String(MODULE_SEED))
    if (seeded.changed) {
      localStorage.setItem(MODULES_KEY, JSON.stringify(seeded.list))
    }
  } catch {
    /* ignore */
  }
  return seeded.list
}

function loadStates(modules: ModuleConfig[]): Record<string, ModuleState> {
  let persisted: Record<string, ModuleState> = {}
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (raw) {
      const data = JSON.parse(raw) as Record<string, ModuleState>
      if (data && typeof data === 'object') persisted = data
    }
  } catch {
    /* ignore */
  }

  return Object.fromEntries(
    modules.map((m) => [
      m.id,
      persisted[m.id] ?? { url: m.url, title: m.name, loading: false }
    ])
  )
}

export const useModulesStore = defineStore('modules', () => {
  const moduleList = ref<ModuleConfig[]>(loadModules())
  const states = ref<Record<string, ModuleState>>(loadStates(moduleList.value))
  const activeId = ref<string>(moduleList.value[0]?.id ?? '')

  // 首次启动把默认模块写入本地，避免「删了又变回来」的错觉
  if (localStorage.getItem(MODULES_KEY) === null) {
    try {
      localStorage.setItem(MODULES_KEY, JSON.stringify(moduleList.value))
    } catch {
      /* ignore */
    }
  }

  const modules = computed(() => sortModules(moduleList.value))
  const active = computed(() => modules.value.find((m) => m.id === activeId.value))
  const activeState = computed(() => states.value[activeId.value])

  function persistModules() {
    try {
      localStorage.setItem(MODULES_KEY, JSON.stringify(moduleList.value))
    } catch {
      /* ignore */
    }
  }

  function persistStates() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(states.value))
    } catch {
      /* ignore */
    }
  }

  function ensureState(m: ModuleConfig) {
    if (!states.value[m.id]) {
      states.value[m.id] = { url: m.url, title: m.name, loading: false }
    }
  }

  function activate(id: string) {
    if (moduleList.value.some((m) => m.id === id)) activeId.value = id
  }

  /** 侧栏点击：回到该网站配置的首页地址 */
  function openFromSidebar(id: string) {
    const m = moduleList.value.find((x) => x.id === id)
    if (!m) return
    activeId.value = id
    states.value = {
      ...states.value,
      [id]: { url: m.url, title: m.name, loading: false }
    }
    persistStates()
  }

  function setUrl(id: string, url: string) {
    const s = states.value[id]
    if (!s) return
    s.url = url
    persistStates()
  }

  function update(id: string, patch: Partial<ModuleState>) {
    const s = states.value[id]
    if (!s) return
    Object.assign(s, patch)
    persistStates()
  }

  function addModule(
    input: Omit<ModuleConfig, 'id' | 'order'> & { id?: string; order?: number }
  ) {
    const order =
      input.order ??
      (moduleList.value.reduce((max, m) => Math.max(max, m.order ?? 0), 0) || 0) + 1
    const next: ModuleConfig = {
      id: input.id || createModuleId(input.name),
      name: input.name.trim(),
      url: normalize(input.url) || input.url.trim(),
      glyph: (input.glyph || input.name).trim().slice(0, 2),
      iconPath: input.iconPath,
      color: input.color || '#14B8A6',
      order
    }
    moduleList.value = [...moduleList.value, next]
    ensureState(next)
    persistModules()
    persistStates()
    return next
  }

  function updateModule(id: string, patch: Partial<Omit<ModuleConfig, 'id'>>) {
    const idx = moduleList.value.findIndex((x) => x.id === id)
    if (idx < 0) return
    const m = { ...moduleList.value[idx] }
    if (patch.name !== undefined) m.name = patch.name.trim()
    if (patch.url !== undefined) m.url = normalize(patch.url) || patch.url.trim()
    if (patch.glyph !== undefined) m.glyph = patch.glyph.trim().slice(0, 2)
    if (patch.color !== undefined) m.color = patch.color
    if (patch.order !== undefined) m.order = patch.order
    if (patch.iconPath !== undefined) {
      if (patch.iconPath) m.iconPath = patch.iconPath
      else delete m.iconPath
    }
    const next = [...moduleList.value]
    next[idx] = m
    moduleList.value = next
    persistModules()
  }

  async function removeModule(id: string) {
    const exists = moduleList.value.some((m) => m.id === id)
    if (!exists) return false

    moduleList.value = moduleList.value.filter((m) => m.id !== id)

    const nextStates = { ...states.value }
    delete nextStates[id]
    states.value = nextStates

    if (activeId.value === id) {
      activeId.value = moduleList.value[0]?.id ?? ''
    }

    persistModules()
    persistStates()

    try {
      await window.workbench.removeModuleIcon(id)
    } catch {
      /* ignore */
    }
    return true
  }

  function moveModule(id: string, dir: -1 | 1) {
    const sorted = sortModules(moduleList.value)
    const i = sorted.findIndex((m) => m.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= sorted.length) return
    const a = sorted[i]
    const b = sorted[j]
    const ao = a.order ?? i + 1
    const bo = b.order ?? j + 1
    updateModule(a.id, { order: bo })
    updateModule(b.id, { order: ao })
  }

  async function setModuleIcon(id: string, sourcePath: string) {
    const saved = await window.workbench.saveModuleIcon(id, sourcePath)
    updateModule(id, { iconPath: saved })
    return saved
  }

  async function clearModuleIcon(id: string) {
    try {
      await window.workbench.removeModuleIcon(id)
    } catch {
      /* ignore */
    }
    updateModule(id, { iconPath: '' })
  }

  function resetModules() {
    moduleList.value = structuredClone(DEFAULT_MODULES)
    states.value = loadStates(moduleList.value)
    activeId.value = moduleList.value[0]?.id ?? ''
    try {
      localStorage.setItem(MODULE_SEED_KEY, String(MODULE_SEED))
    } catch {
      /* ignore */
    }
    persistModules()
    persistStates()
  }

  return {
    moduleList,
    modules,
    activeId,
    active,
    activeState,
    states,
    activate,
    openFromSidebar,
    setUrl,
    update,
    addModule,
    updateModule,
    removeModule,
    moveModule,
    setModuleIcon,
    clearModuleIcon,
    resetModules,
    moduleLabel
  }
})

export function normalize(input: string): string {
  const s = input.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(s)) return 'https://' + s
  return 'https://www.bing.com/search?q=' + encodeURIComponent(s)
}

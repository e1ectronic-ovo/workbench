import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ThemeId =
  | 'whale'
  | 'whale-night'
  | 'orca'
  | 'orca-night'
  | 'eva'
  | 'eva-red'
  | 'megumi'
  | 'custom'

/** 走 WhaleThemeDecor（位图场景层）的主题 */
export type SceneThemeId = 'whale' | 'whale-night' | 'orca' | 'orca-night'

/** 走 EvaThemeDecor（EVA 皮肤层）的主题 */
export type EvaThemeId = 'eva' | 'eva-red'

/** 位图场景皮肤（女仆工坊 / 虎鲸链路），不含 EVA */
export function isPathSceneTheme(id: ThemeId): id is SceneThemeId {
  return id === 'whale' || id === 'whale-night' || id === 'orca' || id === 'orca-night'
}

export function isEvaTheme(id: ThemeId): id is EvaThemeId {
  return id === 'eva' || id === 'eva-red'
}

/** 走 MegumiThemeDecor（单张立绘背景层）的主题 */
export type MegumiThemeId = 'megumi'

export function isMegumiTheme(id: ThemeId): id is MegumiThemeId {
  return id === 'megumi'
}
export type DensityId = 'comfortable' | 'compact'

export interface CustomThemeColors {
  bg: string
  surface: string
  sidebarBg: string
  text: string
}

export interface AppearanceSettings {
  theme: ThemeId
  accent: string
  custom?: CustomThemeColors
  density: DensityId
  showStatusBar: boolean
  showModuleLabels: boolean
}

export const WHALE_ACCENT = '#C5A468'
export const ORCA_ACCENT = '#086CFF'
/** EVA-01 的荧光绿，界面里的唯一高亮色 */
export const EVA_ACCENT = '#A3FF12'
/** 警戒态的血红，等同 --eva-key */
export const NERV_ACCENT = '#FF2D2D'
/** 加藤惠：贝雷帽的白 + 蝴蝶结的红，取蝴蝶结那一抹 */
export const MEGUMI_ACCENT = '#B85461'

export const DEFAULT_CUSTOM_COLORS: CustomThemeColors = {
  bg: '#eef4fc',
  surface: '#ffffff',
  sidebarBg: '#dce8f5',
  text: '#1a2b4a'
}

interface ThemeTokens {
  bg: string
  bgElevated: string
  surface: string
  surfaceSecondary: string
  surfaceRaised: string
  surfaceHover: string
  surfaceActive: string
  fillTertiary: string
  navHover: string
  navSelected: string
  navIcon: string
  sidebarBg: string
  border: string
  borderStrong: string
  text: string
  textSecondary: string
  textMuted: string
  onAccent: string
  scheme: 'dark' | 'light'
  chromeBg: string
  chromeFg: string
}

const APPEARANCE_KEY = 'workbench.appearance'

const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'whale',
  accent: WHALE_ACCENT,
  density: 'comfortable',
  showStatusBar: true,
  showModuleLabels: true
}

const THEMES: Record<ThemeId, ThemeTokens> = {
  whale: {
    bg: '#0a1220',
    bgElevated: 'rgba(12, 22, 42, 0.82)',
    surface: 'rgba(16, 28, 52, 0.78)',
    surfaceSecondary: 'rgba(10, 18, 36, 0.72)',
    surfaceRaised: 'rgba(20, 32, 58, 0.88)',
    surfaceHover: 'rgba(197, 164, 104, 0.1)',
    surfaceActive: 'rgba(197, 164, 104, 0.16)',
    fillTertiary: 'rgba(197, 164, 104, 0.12)',
    navHover: 'rgba(197, 164, 104, 0.08)',
    navSelected: 'rgba(197, 164, 104, 0.18)',
    navIcon: '#c5a468',
    sidebarBg: 'rgba(10, 18, 36, 0.38)',
    border: 'rgba(197, 164, 104, 0.2)',
    borderStrong: 'rgba(197, 164, 104, 0.34)',
    text: '#f0ebe0',
    textSecondary: '#b8c4d8',
    textMuted: '#7a8aa8',
    onAccent: '#1a1208',
    scheme: 'dark',
    chromeBg: 'rgba(10, 18, 36, 0.88)',
    chromeFg: '#b8c4d8'
  },
  'whale-night': {
    bg: '#060a14',
    bgElevated: 'rgba(8, 14, 28, 0.88)',
    surface: 'rgba(12, 20, 38, 0.82)',
    surfaceSecondary: 'rgba(6, 10, 20, 0.78)',
    surfaceRaised: 'rgba(14, 24, 44, 0.92)',
    surfaceHover: 'rgba(197, 164, 104, 0.1)',
    surfaceActive: 'rgba(197, 164, 104, 0.16)',
    fillTertiary: 'rgba(197, 164, 104, 0.14)',
    navHover: 'rgba(197, 164, 104, 0.08)',
    navSelected: 'rgba(197, 164, 104, 0.2)',
    navIcon: '#d4b87a',
    sidebarBg: 'rgba(6, 10, 20, 0.42)',
    border: 'rgba(197, 164, 104, 0.18)',
    borderStrong: 'rgba(197, 164, 104, 0.3)',
    text: '#ece6d8',
    textSecondary: '#a8b4c8',
    textMuted: '#6a7894',
    onAccent: '#1a1208',
    scheme: 'dark',
    chromeBg: 'rgba(6, 10, 20, 0.9)',
    chromeFg: '#a8b4c8'
  },
  orca: {
    bg: '#eef3fa',
    bgElevated: 'rgba(245, 248, 252, 0.82)',
    surface: 'rgba(255, 255, 255, 0.78)',
    surfaceSecondary: 'rgba(232, 238, 246, 0.72)',
    surfaceRaised: 'rgba(255, 255, 255, 0.86)',
    surfaceHover: 'rgba(8, 108, 255, 0.08)',
    surfaceActive: 'rgba(8, 108, 255, 0.14)',
    fillTertiary: 'rgba(8, 108, 255, 0.1)',
    navHover: 'rgba(8, 108, 255, 0.08)',
    navSelected: 'rgba(8, 108, 255, 0.16)',
    navIcon: '#086cff',
    sidebarBg: 'rgba(245, 248, 252, 0.42)',
    border: 'rgba(8, 108, 255, 0.16)',
    borderStrong: 'rgba(8, 108, 255, 0.28)',
    text: '#1a2433',
    textSecondary: '#4a5a70',
    textMuted: '#7a8798',
    onAccent: '#ffffff',
    scheme: 'light',
    chromeBg: 'rgba(245, 248, 252, 0.78)',
    chromeFg: '#4a5a70'
  },
  'orca-night': {
    bg: '#12161e',
    bgElevated: 'rgba(22, 28, 38, 0.86)',
    surface: 'rgba(28, 34, 46, 0.8)',
    surfaceSecondary: 'rgba(16, 20, 28, 0.76)',
    surfaceRaised: 'rgba(32, 38, 50, 0.88)',
    surfaceHover: 'rgba(8, 108, 255, 0.1)',
    surfaceActive: 'rgba(8, 108, 255, 0.16)',
    fillTertiary: 'rgba(8, 108, 255, 0.14)',
    navHover: 'rgba(8, 108, 255, 0.1)',
    navSelected: 'rgba(8, 108, 255, 0.2)',
    navIcon: '#6aa4ff',
    sidebarBg: 'rgba(16, 20, 28, 0.42)',
    border: 'rgba(8, 108, 255, 0.18)',
    borderStrong: 'rgba(8, 108, 255, 0.3)',
    text: '#e8eef8',
    textSecondary: '#9aa8bc',
    textMuted: '#6e7c90',
    onAccent: '#ffffff',
    scheme: 'dark',
    chromeBg: 'rgba(16, 20, 28, 0.82)',
    chromeFg: '#9aa8bc'
  },
  eva: {
    bg: '#08070d',
    bgElevated: 'rgba(13, 9, 24, 0.9)',
    surface: 'rgba(26, 17, 46, 0.86)',
    surfaceSecondary: 'rgba(10, 8, 19, 0.8)',
    surfaceRaised: 'rgba(33, 22, 57, 0.92)',
    surfaceHover: 'rgba(139, 92, 246, 0.16)',
    surfaceActive: 'rgba(139, 92, 246, 0.24)',
    fillTertiary: 'rgba(139, 92, 246, 0.14)',
    navHover: 'rgba(139, 92, 246, 0.15)',
    navSelected: 'rgba(163, 255, 18, 0.13)',
    navIcon: '#9d7fc8',
    sidebarBg: 'rgba(17, 11, 32, 0.46)',
    border: 'rgba(139, 92, 246, 0.28)',
    borderStrong: 'rgba(139, 92, 246, 0.46)',
    text: '#f1ebff',
    textSecondary: '#bca8d8',
    textMuted: '#8b78a8',
    onAccent: '#111607',
    scheme: 'dark',
    chromeBg: 'rgba(8, 7, 13, 0.9)',
    chromeFg: '#bca8d8'
  },
  'eva-red': {
    bg: '#0a0506',
    bgElevated: 'rgba(18, 8, 10, 0.9)',
    surface: 'rgba(38, 13, 15, 0.86)',
    surfaceSecondary: 'rgba(12, 6, 7, 0.8)',
    surfaceRaised: 'rgba(48, 16, 19, 0.92)',
    surfaceHover: 'rgba(255, 45, 45, 0.12)',
    surfaceActive: 'rgba(255, 45, 45, 0.2)',
    fillTertiary: 'rgba(255, 45, 45, 0.12)',
    navHover: 'rgba(255, 45, 45, 0.13)',
    navSelected: 'rgba(255, 45, 45, 0.16)',
    navIcon: '#c08484',
    sidebarBg: 'rgba(24, 9, 11, 0.5)',
    border: 'rgba(255, 45, 45, 0.26)',
    borderStrong: 'rgba(255, 45, 45, 0.42)',
    text: '#f7e9e7',
    textSecondary: '#d8bdbc',
    textMuted: '#a88686',
    onAccent: '#1b0606',
    scheme: 'dark',
    chromeBg: 'rgba(10, 5, 6, 0.9)',
    chromeFg: '#d8bdbc'
  },
  /**
   * 加藤惠 / 路人女主。素材是黄昏教室走廊里的立绘，整体偏亮偏淡，
   * 所以走 light scheme：深色字压在浅色底上，安静、低饱和，
   * 唯一的高饱和只留在蝴蝶结的红（accent）上。
   */
  megumi: {
    bg: '#eef2f6',
    bgElevated: 'rgba(255, 255, 255, 0.82)',
    surface: 'rgba(255, 255, 255, 0.76)',
    surfaceSecondary: 'rgba(246, 249, 252, 0.7)',
    surfaceRaised: 'rgba(255, 255, 255, 0.9)',
    surfaceHover: 'rgba(184, 84, 97, 0.08)',
    surfaceActive: 'rgba(184, 84, 97, 0.14)',
    fillTertiary: 'rgba(184, 84, 97, 0.1)',
    navHover: 'rgba(184, 84, 97, 0.07)',
    navSelected: 'rgba(184, 84, 97, 0.15)',
    navIcon: '#9d7a80',
    sidebarBg: 'rgba(255, 255, 255, 0.58)',
    border: 'rgba(120, 138, 160, 0.2)',
    borderStrong: 'rgba(120, 138, 160, 0.34)',
    text: '#2b3340',
    textSecondary: '#586474',
    textMuted: '#7d8797',
    onAccent: '#ffffff',
    scheme: 'light',
    chromeBg: 'rgba(255, 255, 255, 0.78)',
    chromeFg: '#586474'
  },
  custom: {
    bg: '#eef4fc',
    bgElevated: '#eef4fc',
    surface: '#ffffff',
    surfaceSecondary: '#dce8f5',
    surfaceRaised: '#ffffff',
    surfaceHover: 'rgba(0, 0, 0, 0.04)',
    surfaceActive: 'rgba(0, 0, 0, 0.06)',
    fillTertiary: 'rgba(118, 118, 128, 0.12)',
    navHover: 'rgba(0, 0, 0, 0.04)',
    navSelected: 'rgba(0, 0, 0, 0.06)',
    navIcon: '#6E6E73',
    sidebarBg: '#dce8f5',
    border: 'rgba(0, 0, 0, 0.06)',
    borderStrong: 'rgba(0, 0, 0, 0.1)',
    text: '#1a2b4a',
    textSecondary: '#4a6080',
    textMuted: '#6b82a6',
    onAccent: '#ffffff',
    scheme: 'light',
    chromeBg: '#eef4fc',
    chromeFg: '#4a6080'
  },
}

function parseHexColor(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const rgb = parseHexColor(hex)
  if (!rgb) return 0.5
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function buildCustomTokens(c: CustomThemeColors): ThemeTokens {
  const dark = luminance(c.bg) < 0.45
  const hover = dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)'
  const active = dark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.06)'
  const border = dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'
  const borderStrong = dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.1)'
  const secondary = dark ? 'rgba(232, 238, 248, 0.72)' : 'rgba(26, 43, 74, 0.68)'
  const muted = dark ? 'rgba(157, 176, 208, 0.72)' : 'rgba(26, 43, 74, 0.48)'
  return {
    bg: c.bg,
    bgElevated: c.bg,
    surface: c.surface,
    surfaceSecondary: c.sidebarBg,
    surfaceRaised: c.surface,
    surfaceHover: hover,
    surfaceActive: active,
    fillTertiary: dark ? 'rgba(118, 118, 128, 0.24)' : 'rgba(118, 118, 128, 0.12)',
    navHover: hover,
    navSelected: active,
    navIcon: muted,
    sidebarBg: c.sidebarBg,
    border,
    borderStrong,
    text: c.text,
    textSecondary: secondary,
    textMuted: muted,
    onAccent: dark ? '#ffffff' : '#ffffff',
    scheme: dark ? 'dark' : 'light',
    chromeBg: c.bg,
    chromeFg: secondary
  }
}

function resolveThemeTokens(a: AppearanceSettings): ThemeTokens {
  if (a.theme === 'custom' && a.custom) return buildCustomTokens(a.custom)
  return THEMES[a.theme] ?? THEMES.whale
}

function loadAppearance(): AppearanceSettings {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY)
    if (!raw) return { ...DEFAULT_APPEARANCE }
    const data = JSON.parse(raw) as Partial<AppearanceSettings>
    const merged = { ...DEFAULT_APPEARANCE, ...data }
    if (!THEMES[merged.theme]) merged.theme = DEFAULT_APPEARANCE.theme
    if (merged.theme === 'custom' && !merged.custom) {
      merged.custom = { ...DEFAULT_CUSTOM_COLORS }
    }
    return merged
  } catch {
    return { ...DEFAULT_APPEARANCE }
  }
}

function applyAppearance(a: AppearanceSettings) {
  const root = document.documentElement
  const t = resolveThemeTokens(a)
  root.style.setProperty('--bg', t.bg)
  root.style.setProperty('--bg-elevated', t.bgElevated)
  root.style.setProperty('--surface', t.surface)
  root.style.setProperty('--surface-secondary', t.surfaceSecondary)
  root.style.setProperty('--surface-raised', t.surfaceRaised)
  root.style.setProperty('--surface-hover', t.surfaceHover)
  root.style.setProperty('--surface-active', t.surfaceActive)
  root.style.setProperty('--fill-tertiary', t.fillTertiary)
  root.style.setProperty('--nav-hover', t.navHover)
  root.style.setProperty('--nav-selected', t.navSelected)
  root.style.setProperty('--nav-icon', t.navIcon)
  root.style.setProperty('--sidebar-bg', t.sidebarBg)
  root.style.setProperty('--border', t.border)
  root.style.setProperty('--border-strong', t.borderStrong)
  root.style.setProperty('--text', t.text)
  root.style.setProperty('--text-secondary', t.textSecondary)
  root.style.setProperty('--text-muted', t.textMuted)
  root.style.setProperty('--accent', a.accent)
  root.style.setProperty('--accent-hover', a.accent)
  root.style.setProperty('--accent-soft', `${a.accent}29`)
  root.style.setProperty('--border-focus', `${a.accent}a6`)
  root.style.setProperty('--on-accent', t.onAccent)
  // chrome 系列之前只在 token 表里定义、从来没写到 CSS 变量上，
  // 导致 whale-theme.css 里的 var(--chrome-bg) 取到空值、整条 background 失效
  root.style.setProperty('--chrome-bg', t.chromeBg)
  root.style.setProperty('--chrome-fg', t.chromeFg)
  const compact = a.density === 'compact'
  root.style.setProperty('--sidebar-w', compact ? '72px' : '232px')
  root.dataset.sidebarLabels = compact || !a.showModuleLabels ? 'false' : 'true'
  root.style.colorScheme = t.scheme
  root.dataset.theme = a.theme
  root.dataset.density = a.density
  root.dataset.scheme = t.scheme

  void window.workbench?.setChromeTheme?.({ backgroundColor: t.bg })
}

export const useSettingsStore = defineStore('settings', () => {
  const appearance = ref<AppearanceSettings>(loadAppearance())
  const openAtLogin = ref(false)
  const openAsHidden = ref(false)
  const loginReady = ref(false)

  function persistAppearance() {
    try {
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance.value))
    } catch {
      /* ignore */
    }
    applyAppearance(appearance.value)
  }

  function patchAppearance(patch: Partial<AppearanceSettings>) {
    const next: AppearanceSettings = { ...appearance.value, ...patch }
    if (patch.custom) {
      next.custom = { ...(appearance.value.custom ?? DEFAULT_CUSTOM_COLORS), ...patch.custom }
    }
    if (next.theme === 'custom' && !next.custom) {
      next.custom = { ...DEFAULT_CUSTOM_COLORS }
    }
    appearance.value = next
    persistAppearance()
  }

  function patchCustomColor(key: keyof CustomThemeColors, value: string) {
    patchAppearance({
      theme: 'custom',
      custom: { ...(appearance.value.custom ?? DEFAULT_CUSTOM_COLORS), [key]: value }
    })
  }

  function resetAppearance() {
    appearance.value = { ...DEFAULT_APPEARANCE }
    persistAppearance()
  }

  async function refreshLoginItem() {
    try {
      const s = await window.workbench.getOpenAtLogin()
      openAtLogin.value = s.openAtLogin
      openAsHidden.value = s.openAsHidden
      loginReady.value = true
    } catch {
      loginReady.value = false
    }
  }

  async function setOpenAtLogin(value: boolean) {
    try {
      const s = await window.workbench.setOpenAtLogin(value, openAsHidden.value)
      openAtLogin.value = s.openAtLogin
      openAsHidden.value = s.openAsHidden
      if (value && !s.openAtLogin) loginReady.value = false
    } catch {
      loginReady.value = false
    }
  }

  async function setOpenAsHidden(value: boolean) {
    try {
      const s = await window.workbench.setOpenAtLogin(openAtLogin.value, value)
      openAtLogin.value = s.openAtLogin
      openAsHidden.value = s.openAsHidden
    } catch {
      loginReady.value = false
    }
  }

  applyAppearance(appearance.value)

  return {
    appearance,
    openAtLogin,
    openAsHidden,
    loginReady,
    patchAppearance,
    patchCustomColor,
    resetAppearance,
    refreshLoginItem,
    setOpenAtLogin,
    setOpenAsHidden
  }
})

export { DEFAULT_APPEARANCE, THEMES }

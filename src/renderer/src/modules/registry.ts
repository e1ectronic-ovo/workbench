export type ModuleKind = 'web' | 'native'

export interface NativeAppConfig {
  /** 目标窗口所属进程名，例如 MuMuPlayer.exe 对应的 MuMuPlayer。 */
  processName: string
  /** 可选的窗口标题 / 类名，用于同一进程有多个窗口时精确定位。 */
  windowTitle?: string
  className?: string
  /** 可选：由鲸汐启动的模拟器或应用可执行文件。 */
  executablePath?: string
  arguments?: string
  /** 进入模块时若窗口不存在，是否自动启动。 */
  launchOnOpen?: boolean
}

export interface ModuleConfig {
  id: string
  name: string
  /** 旧配置没有该字段时按普通网站处理。 */
  kind?: ModuleKind
  url: string
  /** 无文字作后备图标（无 icon 文件时） */
  glyph?: string
  /** 用户选择的图标文件，经主进程保存后的本地路径 */
  iconPath?: string
  /** 激活态品牌色 */
  color: string
  /** 排序，越小越靠上 */
  order?: number
  /** kind === 'native' 时描述要嵌入的原生窗口。 */
  native?: NativeAppConfig
}

/**
 * 出厂不预置任何网站：侧栏默认是空的，站点由用户自己添加。
 * 老版本内置过的几个站点会在模块种子升级时被移除。
 */
export const DEFAULT_MODULES: ModuleConfig[] = []

export const PRESET_COLORS = [
  '#FE2C55',
  '#FB7299',
  '#E6162D',
  '#FF0050',
  '#0084FF',
  '#14B8A6',
  '#EA580C',
  '#8B5CF6',
  '#F59E0B',
  '#6EE7B7',
  '#38BDF8',
  '#F472B6'
]

export function sortModules(list: ModuleConfig[]): ModuleConfig[] {
  return [...list].sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
}

export function createModuleId(name: string): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\u4e00-\u9fff-]/gi, '')
      .slice(0, 24) || 'module'
  return `${base}-${Date.now().toString(36)}`
}

export function moduleLabel(m: ModuleConfig): string {
  return m.glyph?.trim() || m.name.trim().slice(0, 1) || '?'
}

export function isNativeModule(m: ModuleConfig): boolean {
  return m.kind === 'native'
}

export function moduleSubtitle(m: ModuleConfig): string {
  if (isNativeModule(m)) {
    const processName = m.native?.processName?.trim()
    return processName ? `原生应用 · ${processName}` : '原生应用 · 尚未绑定窗口'
  }
  return m.url
}

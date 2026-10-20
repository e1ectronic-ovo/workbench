export interface ModuleConfig {
  id: string
  name: string
  url: string
  /** 无文字作后备图标（无 icon 文件时） */
  glyph?: string
  /** 用户选择的图标文件，经主进程保存后的本地路径 */
  iconPath?: string
  /** 激活态品牌色 */
  color: string
  /** 排序，越小越靠上 */
  order?: number
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

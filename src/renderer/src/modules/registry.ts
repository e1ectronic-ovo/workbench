export type ModuleKind = 'web'

/**
 * 侧栏模块：一个模块就是一个站点，用内嵌浏览器打开。
 *
 * 曾经还有 kind === 'native'（把模拟器或本地程序的窗口嵌进模块区），
 * 那条路先后试过窗口句柄托管和内置安卓引擎，前者交互差、后者一个模拟器
 * 就要吃掉十几 G 磁盘和 4G 内存，性价比不成立，已经整体移除。
 *
 * kind 字段留着只为识别历史数据：读到 'native' 的旧模块会在加载时被丢弃。
 */
export interface ModuleConfig {
  id: string
  name: string
  /** 历史字段，现在只可能是 'web'。 */
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

export function moduleSubtitle(m: ModuleConfig): string {
  return m.url
}

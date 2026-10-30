export type ModuleKind = 'web' | 'builtin'

/**
 * 侧栏模块，两种形态：
 *
 * - `web`（默认）：一个站点，用内嵌浏览器打开，地址由用户填写。
 * - `builtin`：随安装包发布的内置应用。页面资源在 resources/apps/<name>/，
 *   通过 wbapp:// 专有协议加载，不联网、不指向任何远程地址。
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
  /** 历史字段，现在只可能是 'web' 或 'builtin'。 */
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

/** 内置应用清单：键对应 resources/apps/<键>/ 目录 */
export const BUILTIN_APPS = {
  greyfall: { name: '烬落', glyph: '烬', color: '#8B5CF6' }
} as const

export type BuiltinAppId = keyof typeof BUILTIN_APPS

/** 内置应用的入口地址（专有协议，主进程负责把请求映射到 resources/apps） */
export function builtinUrl(app: BuiltinAppId): string {
  return `wbapp://${app}/index.html`
}

export function isBuiltinModule(m: Pick<ModuleConfig, 'kind' | 'url'>): boolean {
  return m.kind === 'builtin' || /^wbapp:/i.test(m.url)
}

/**
 * 出厂预置内置应用（不预置任何网站：站点由用户自己添加）。
 * 内置应用属于随包功能，删掉后不会再被补回来。
 */
export const DEFAULT_MODULES: ModuleConfig[] = (
  Object.keys(BUILTIN_APPS) as BuiltinAppId[]
).map((id, i) => ({
  id,
  name: BUILTIN_APPS[id].name,
  kind: 'builtin' as const,
  url: builtinUrl(id),
  glyph: BUILTIN_APPS[id].glyph,
  color: BUILTIN_APPS[id].color,
  order: i + 1
}))

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
  if (isBuiltinModule(m)) return '内置应用 · 离线可用'
  return m.url
}

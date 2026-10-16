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

/** 出厂默认模块；用户可在设置里增删改，改动会持久化到本地 */
export const DEFAULT_MODULES: ModuleConfig[] = [
  {
    id: 'xiaohongshu',
    name: '小红书',
    url: 'https://www.xiaohongshu.com',
    glyph: '小',
    color: '#FE2C55',
    order: 1
  },
  {
    id: 'bilibili',
    name: 'B 站',
    url: 'https://www.bilibili.com',
    glyph: 'B',
    color: '#FB7299',
    order: 2
  },
  {
    id: 'weibo',
    name: '微博',
    url: 'https://weibo.com',
    glyph: '微',
    color: '#E6162D',
    order: 3
  },
  {
    id: 'douyin',
    name: '抖音',
    url: 'https://www.douyin.com',
    glyph: '抖',
    color: '#FF0050',
    order: 4
  },
  {
    id: 'zhihu',
    name: '知乎',
    url: 'https://www.zhihu.com',
    glyph: '知',
    color: '#0084FF',
    order: 5
  },
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com',
    glyph: 'G',
    color: '#6EE7B7',
    order: 6
  }
]

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

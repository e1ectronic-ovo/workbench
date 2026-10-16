export interface PageTab {
  id: string
  /** 当前地址（导航后会更新） */
  url: string
  /** webview 首次挂载地址，绑定后不再改动 */
  bootUrl: string
  title: string
  loading: boolean
}

export function createPageTab(url: string, title = '新标签页'): PageTab {
  const bootUrl = (url || 'about:blank').trim()
  return {
    id: `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    url: bootUrl,
    bootUrl,
    title,
    loading: true
  }
}

export function tabLabel(tab: PageTab): string {
  const t = tab.title.trim()
  if (t && t !== 'about:blank') return t
  try {
    const host = new URL(tab.url).hostname.replace(/^www\./, '')
    return host || '新标签页'
  } catch {
    return '新标签页'
  }
}

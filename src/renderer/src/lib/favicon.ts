/** 部分站点 /favicon.ico 不可用，补充已知 CDN 地址 */
const HOST_OVERRIDES: Record<string, string[]> = {
  'www.doubao.com': [
    'https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/favicon/new-doubao/64x64.png',
    'https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao/chat/favicon-doubao.png'
  ],
  'doubao.com': [
    'https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/favicon/new-doubao/64x64.png',
    'https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao/chat/favicon-doubao.png'
  ]
}

function hostKeys(hostname: string): string[] {
  const keys = [hostname]
  if (hostname.startsWith('www.')) keys.push(hostname.slice(4))
  else keys.push(`www.${hostname}`)
  return keys
}

/** 按优先级生成 favicon 候选地址，逐个尝试直到成功或回退默认图标 */
export function buildFaviconCandidates(url: string, size = 64): string[] {
  try {
    const u = new URL(url.trim())
    const host = u.hostname
    const origin = u.origin
    const seen = new Set<string>()
    const list: string[] = []

    const add = (href: string) => {
      if (!href || seen.has(href)) return
      seen.add(href)
      list.push(href)
    }

    for (const key of hostKeys(host)) {
      for (const href of HOST_OVERRIDES[key] ?? []) add(href)
    }

    add(`${origin}/favicon.ico`)
    add(`${origin}/favicon.png`)
    add(`${origin}/apple-touch-icon.png`)
    add(`https://${host}/favicon.ico`)
    add(`https://icons.duckduckgo.com/ip3/${host}.ico`)
    add(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`)

    return list
  } catch {
    return []
  }
}

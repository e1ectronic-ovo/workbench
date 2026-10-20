import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { ProxyProfile, ProxySubscriptionInfo } from '../../common/proxy'
import { countProxies, looksLikeClashConfig } from './config'
import { proxyDir } from './settings'

const INDEX_FILE = 'index.json'

interface IndexFile {
  activeId: string
  profiles: ProxyProfile[]
}

function dir(): string {
  const path = join(proxyDir(), 'profiles')
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
  return path
}

function indexFile(): string {
  return join(dir(), INDEX_FILE)
}

function textPath(id: string): string {
  return join(dir(), `${id}.yaml`)
}

function readIndex(): IndexFile {
  try {
    const raw = readFileSync(indexFile(), 'utf8')
    const data = JSON.parse(raw) as Partial<IndexFile>
    const profiles = Array.isArray(data.profiles)
      ? data.profiles.filter((p): p is ProxyProfile => !!p && typeof p.id === 'string')
      : []
    const activeId =
      typeof data.activeId === 'string' && profiles.some((p) => p.id === data.activeId)
        ? data.activeId
        : (profiles[0]?.id ?? '')
    return { activeId, profiles }
  } catch {
    return { activeId: '', profiles: [] }
  }
}

function writeIndex(index: IndexFile): void {
  const file = indexFile()
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(index, null, 2), 'utf8')
  renameSync(tmp, file)
}

function nameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function uniqueName(base: string, existing: ProxyProfile[], exceptId = ''): string {
  const name = base.trim() || '配置'
  const taken = new Set(existing.filter((p) => p.id !== exceptId).map((p) => p.name))
  if (!taken.has(name)) return name
  let n = 2
  while (taken.has(`${name} ${n}`)) n++
  return `${name} ${n}`
}

function newId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

let repaired = false

/**
 * 旧版本统计节点数时只认 2 空格缩进，4 空格的订阅会记成 0。
 * 这里做一次性自愈：读回文件重算，算得出就写回。
 */
function repairCounts(index: IndexFile): IndexFile {
  if (repaired) return index
  repaired = true

  const pending = index.profiles.filter((p) => !p.nodeCount)
  if (!pending.length) return index

  let changed = false
  const profiles = index.profiles.map((p) => {
    if (p.nodeCount) return p
    const text = getText(p.id)
    if (!text) return p
    const count = countProxies(text)
    if (!count) return p
    changed = true
    return { ...p, nodeCount: count }
  })

  if (changed) {
    const next = { activeId: index.activeId, profiles }
    writeIndex(next)
    return next
  }
  return index
}

export function listProfiles(): IndexFile {
  return repairCounts(readIndex())
}

export function activeProfile(): ProxyProfile | null {
  const index = listProfiles()
  return index.profiles.find((p) => p.id === index.activeId) ?? null
}

export function activeText(): string | null {
  const profile = activeProfile()
  if (!profile) return null
  try {
    return readFileSync(textPath(profile.id), 'utf8')
  } catch {
    return null
  }
}

export function getText(id: string): string | null {
  try {
    return readFileSync(textPath(id), 'utf8')
  } catch {
    return null
  }
}

export function addProfile(input: {
  name?: string
  nameSource?: 'auto' | 'manual'
  source: 'subscription' | 'file'
  url?: string
  text: string
  subscription?: ProxySubscriptionInfo
}): ProxyProfile {
  if (!looksLikeClashConfig(input.text)) {
    throw new Error('配置内容里找不到 proxies 或 proxy-groups 段')
  }
  const index = listProfiles()
  const id = newId()
  const baseName =
    input.name?.trim() || nameFromUrl(input.url ?? '') || `配置 ${index.profiles.length + 1}`

  writeFileSync(textPath(id), input.text, 'utf8')
  const profile: ProxyProfile = {
    id,
    name: uniqueName(baseName, index.profiles),
    nameSource: input.nameSource ?? (input.name?.trim() ? 'manual' : 'auto'),
    source: input.source,
    url: input.url ?? '',
    updatedAt: new Date().toISOString(),
    nodeCount: countProxies(input.text),
    ...(input.subscription ? { subscription: input.subscription } : {})
  }
  writeIndex({ activeId: id, profiles: [...index.profiles, profile] })
  return profile
}

export function updateContent(
  id: string,
  text: string,
  url?: string,
  options: {
    name?: string
    nameSource?: 'auto' | 'manual'
    subscription?: ProxySubscriptionInfo
  } = {}
): ProxyProfile | null {
  if (!looksLikeClashConfig(text)) throw new Error('配置内容里找不到 proxies 或 proxy-groups 段')
  const index = listProfiles()
  const existing = index.profiles.find((p) => p.id === id)
  if (!existing) return null

  writeFileSync(textPath(id), text, 'utf8')
  const next: ProxyProfile = {
    ...existing,
    url: url ?? existing.url,
    updatedAt: new Date().toISOString(),
    nodeCount: countProxies(text),
    ...(options.name?.trim()
      ? {
          name: uniqueName(options.name, index.profiles, id),
          nameSource: options.nameSource ?? 'manual'
        }
      : {}),
    ...(options.subscription ? { subscription: options.subscription } : {})
  }
  writeIndex({
    activeId: index.activeId,
    profiles: index.profiles.map((p) => (p.id === id ? next : p))
  })
  return next
}

export function setActive(id: string): ProxyProfile | null {
  const index = listProfiles()
  const profile = index.profiles.find((p) => p.id === id)
  if (!profile) return null
  writeIndex({ activeId: id, profiles: index.profiles })
  return profile
}

export function rename(id: string, name: string): ProxyProfile | null {
  const index = listProfiles()
  const existing = index.profiles.find((p) => p.id === id)
  if (!existing) return null
  const next: ProxyProfile = {
    ...existing,
    name: uniqueName(name, index.profiles, id),
    nameSource: 'manual'
  }
  writeIndex({
    activeId: index.activeId,
    profiles: index.profiles.map((p) => (p.id === id ? next : p))
  })
  return next
}

/** 删除后若删的正好是当前配置，自动切到剩下的第一个 */
export function remove(id: string): { activeId: string; profiles: ProxyProfile[] } {
  const index = listProfiles()
  const profiles = index.profiles.filter((p) => p.id !== id)
  try {
    if (existsSync(textPath(id))) unlinkSync(textPath(id))
  } catch {
    /* ignore */
  }
  const activeId =
    index.activeId === id ? (profiles[0]?.id ?? '') : index.activeId
  writeIndex({ activeId, profiles })
  return { activeId, profiles }
}

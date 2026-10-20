import { app } from 'electron'
import { randomBytes } from 'crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  defaultProxySettings,
  DEFAULT_CONTROLLER_PORT,
  DEFAULT_MIXED_PORT,
  type ProxyMode,
  type ProxySettings
} from '../../common/proxy'

const SETTINGS_FILE = 'settings.json'

/** 代理模块的工作目录：配置、订阅缓存、系统代理备份都放这里 */
export function proxyDir(): string {
  const dir = join(app.getPath('userData'), 'proxy')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function proxyFilePath(name: string): string {
  return join(proxyDir(), name)
}

export function createSecret(): string {
  return randomBytes(16).toString('hex')
}

function clampPort(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? Math.round(value) : Number(value)
  if (!Number.isFinite(n) || n < 1024 || n > 65535) return fallback
  return n
}

function normalizeMode(value: unknown): ProxyMode {
  return value === 'global' || value === 'direct' || value === 'rule' ? value : 'rule'
}

function normalize(raw: unknown): ProxySettings {
  const base = defaultProxySettings()
  if (!raw || typeof raw !== 'object') return { ...base, secret: createSecret() }
  const r = raw as Record<string, unknown>

  const mixedPort = clampPort(r.mixedPort, DEFAULT_MIXED_PORT)
  let controllerPort = clampPort(r.controllerPort, DEFAULT_CONTROLLER_PORT)
  // 两个端口撞在一起时内核会启动失败，这里直接错开
  if (controllerPort === mixedPort) {
    controllerPort = mixedPort === DEFAULT_CONTROLLER_PORT ? DEFAULT_CONTROLLER_PORT + 1 : DEFAULT_CONTROLLER_PORT
  }

  return {
    enabledOnStart: typeof r.enabledOnStart === 'boolean' ? r.enabledOnStart : base.enabledOnStart,
    corePath: typeof r.corePath === 'string' ? r.corePath : '',
    mixedPort,
    controllerPort,
    secret: typeof r.secret === 'string' && r.secret.length >= 8 ? r.secret : createSecret(),
    mode: normalizeMode(r.mode),
    subscriptionUrl: typeof r.subscriptionUrl === 'string' ? r.subscriptionUrl : '',
    allowLan: typeof r.allowLan === 'boolean' ? r.allowLan : base.allowLan,
    systemProxy: typeof r.systemProxy === 'boolean' ? r.systemProxy : base.systemProxy
  }
}

export function readSettings(): ProxySettings {
  try {
    const file = proxyFilePath(SETTINGS_FILE)
    if (!existsSync(file)) return normalize(null)
    return normalize(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    return normalize(null)
  }
}

/** 原子写入，避免断电/崩溃留下半截 JSON */
export function writeSettings(next: ProxySettings): ProxySettings {
  const normalized = normalize(next)
  const file = proxyFilePath(SETTINGS_FILE)
  const tmp = `${file}.tmp`
  try {
    writeFileSync(tmp, JSON.stringify(normalized, null, 2), 'utf8')
    renameSync(tmp, file)
  } catch {
    /* 磁盘只读等极端情况：内存里的设置继续生效 */
  }
  return normalized
}

export function patchSettings(patch: Partial<ProxySettings>): ProxySettings {
  return writeSettings({ ...readSettings(), ...patch })
}

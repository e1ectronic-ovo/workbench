import { execFile } from 'child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { proxyFilePath } from './settings'

const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
const BACKUP_FILE = 'system-proxy.json'
const DEFAULT_BYPASS = '<local>;localhost;127.*;10.*;172.16.*;172.17.*;172.18.*;172.19.*;192.168.*'

export interface SystemProxyState {
  supported: boolean
  enabled: boolean
  server: string
}

interface ProxySnapshot {
  enabled: boolean
  server: string
  override: string
}

/**
 * 读写系统代理。
 *
 * 这里**不能**用 reg.exe：某些受限环境（企业策略、安全软件、本机沙箱）会把 reg.exe
 * 列入程序黑名单，一旦 spawn 就被拦，轻则代理开关失效，重则整个进程被带走。
 * 改用 PowerShell 的注册表 provider，兼容性更好；进程启动开销靠批量读写摊掉。
 */
function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 12000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message))
          return
        }
        resolve(stdout)
      }
    )
  })
}

type RegistryType = 'REG_SZ' | 'REG_DWORD'

/** 批量写，减少 powershell 进程启动次数（每次约 200–300ms） */
async function writeValues(entries: Array<[string, RegistryType, string]>): Promise<void> {
  if (entries.length === 0) return
  const parts = entries.map(([name, type, value]) => {
    const psType = type === 'REG_DWORD' ? 'DWord' : 'String'
    const psValue = type === 'REG_DWORD' ? value : `'${value.replace(/'/g, "''")}'`
    return `Set-ItemProperty -Path '${REG_KEY}' -Name '${name}' -Value ${psValue} -Type ${psType}`
  })
  await runPowerShell(['$ErrorActionPreference = "Stop"', ...parts].join('; '))
}

/** 通知系统设置已变更，浏览器等 WinINET 客户端会立刻重读 */
function broadcastChange(): void {
  if (process.platform !== 'win32') return
  const script = [
    "$sig = '[DllImport(\"wininet.dll\", SetLastError=true)] public static extern bool InternetSetOption(IntPtr h, int o, IntPtr b, int l);'",
    '$t = Add-Type -MemberDefinition $sig -Name WbInternet -Namespace Wb -PassThru',
    '$t::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0) | Out-Null',
    '$t::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0) | Out-Null'
  ].join('; ')
  execFile(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { windowsHide: true },
    () => {}
  )
}

export function isSupported(): boolean {
  return process.platform === 'win32'
}

async function readRaw(): Promise<ProxySnapshot> {
  // 一次读完三个值；键不存在时全部按"未设置"处理
  const script = [
    `$k = Get-ItemProperty -Path '${REG_KEY}' -ErrorAction SilentlyContinue`,
    `if ($null -eq $k) { '||' } else { '{0}|{1}|{2}' -f ([string]$k.ProxyEnable), ([string]$k.ProxyServer), ([string]$k.ProxyOverride) }`
  ].join('; ')
  let out = ''
  try {
    out = (await runPowerShell(script)).trim()
  } catch {
    return { enabled: false, server: '', override: '' }
  }
  const [rawEnable = '', server = '', override = ''] = out.split('|')
  return {
    // PowerShell 里 REG_DWORD 取出来是 1 / 0
    enabled: rawEnable.trim() === '1',
    server: server.trim(),
    override: override.trim()
  }
}

export async function currentState(): Promise<SystemProxyState> {
  if (!isSupported()) return { supported: false, enabled: false, server: '' }
  const raw = await readRaw()
  return { supported: true, enabled: raw.enabled, server: raw.server }
}

function readBackup(): ProxySnapshot | null {
  try {
    const file = proxyFilePath(BACKUP_FILE)
    if (!existsSync(file)) return null
    return JSON.parse(readFileSync(file, 'utf8')) as ProxySnapshot
  } catch {
    return null
  }
}

function writeBackup(backup: ProxySnapshot): void {
  try {
    writeFileSync(proxyFilePath(BACKUP_FILE), JSON.stringify(backup, null, 2), 'utf8')
  } catch {
    /* ignore */
  }
}

function clearBackup(): void {
  try {
    const file = proxyFilePath(BACKUP_FILE)
    if (existsSync(file)) unlinkSync(file)
  } catch {
    /* ignore */
  }
}

async function restore(snapshot: ProxySnapshot): Promise<void> {
  const entries: Array<[string, RegistryType, string]> = [
    ['ProxyEnable', 'REG_DWORD', snapshot.enabled ? '1' : '0']
  ]
  if (snapshot.server) entries.push(['ProxyServer', 'REG_SZ', snapshot.server])
  if (snapshot.override) entries.push(['ProxyOverride', 'REG_SZ', snapshot.override])
  await writeValues(entries)
}

export async function enable(port: number): Promise<SystemProxyState> {
  if (!isSupported()) throw new Error('当前系统暂不支持自动接管系统代理')

  const server = `127.0.0.1:${port}`
  // 只在第一次接管时记录原始值，反复连接不会把"我们自己的值"当成原始值
  let backup = readBackup()
  if (!backup) {
    backup = await readRaw()
    writeBackup(backup)
  }

  try {
    await writeValues([
      ['ProxyEnable', 'REG_DWORD', '1'],
      ['ProxyServer', 'REG_SZ', server],
      ['ProxyOverride', 'REG_SZ', DEFAULT_BYPASS]
    ])

    // 写后校验：被安全软件拦下时不要把"以为设上了"的状态留给界面
    const check = await readRaw()
    if (!check.enabled || check.server !== server) {
      throw new Error('系统代理写入后被拦截，请检查安全软件')
    }
  } catch (e) {
    await restore(backup).catch(() => {})
    clearBackup()
    throw e
  }

  broadcastChange()
  return { supported: true, enabled: true, server }
}

export async function disable(): Promise<SystemProxyState> {
  if (!isSupported()) return { supported: false, enabled: false, server: '' }

  const backup = readBackup()
  if (backup) {
    await restore(backup)
    clearBackup()
  } else {
    await writeValues([['ProxyEnable', 'REG_DWORD', '0']])
  }

  broadcastChange()
  return currentState()
}

/**
 * 启动自检：上次如果是被强杀/崩溃，系统代理会指向已经不存在的内核，
 * 这里把备份还原回去，避免整机断网。
 */
export async function recoverOnStart(): Promise<void> {
  if (!isSupported()) return
  if (!readBackup()) return
  try {
    await disable()
  } catch {
    /* ignore */
  }
}

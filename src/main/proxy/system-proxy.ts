import { execFile } from 'child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { proxyFilePath } from './settings'

const REG_PATH = 'Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
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
 * 也不能用 `Set-ItemProperty -Type`：`-Type` 是注册表 provider 在绑定阶段补出来的
 * **动态参数**，补不出来就报 `NamedParameterNotFound: 找不到与参数名称"Type"匹配的参数`
 * （v0.4.0 起代理开关在整个应用里失效就是这个原因）。统一走 .NET 的 Registry API。
 *
 * 调 PowerShell 时两条硬规矩，都是为了绕开 execFile 在 Windows 上的参数转义：
 * 1. 脚本里**只用单引号**，不要出现双引号。Node 会把内部 `"` 转成 `\"`，
 *    而 powershell.exe 用自己的命令行解析，两边对不上时脚本会被拼坏。
 * 2. 结尾不要是反斜杠（会被当成续引号吃掉）。
 */
function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, timeout: 12000 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(tidyPowerShellError(stderr) || error.message))
          return
        }
        resolve(stdout)
      }
    )
  })
}

/** PowerShell 的报错是多行带箭头和 CategoryInfo 的大块，卡片上放不下，压成一行 */
function tidyPowerShellError(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return ''
  const message = lines.find((line) => /^[\w.$]+ : /.test(line)) ?? lines[0]
  const id = lines.find((line) => line.startsWith('FullyQualifiedErrorId'))
  const detail = id?.split(',').slice(0, 2).join(' ').replace('FullyQualifiedErrorId : ', '')
  return detail ? `${message}（${detail}）` : message
}

/**
 * 每个脚本开头都要加：把控制台输出编码切成 UTF-8。
 * 不然 PowerShell 报错走的是系统 ANSI 代码页（中文机器上是 GBK），按 utf8 解码
 * 得到的是一屏乱码，用户根本读不出哪里错了。
 */
const PS_UTF8 = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8'

type RegistryType = 'REG_SZ' | 'REG_DWORD'

/**
 * 批量写，减少 powershell 进程启动次数（每次约 200–300ms）。
 *
 * 这里走 `Microsoft.Win32.Registry` 而不是 `Set-ItemProperty -Type`：
 * 后者的 `-Type` 是注册表 provider 的**动态参数**，要由当前会话的 provider
 * 在绑定时补出来，一旦补不出来（实测在本机应用里）就报
 * `NamedParameterNotFound: 找不到与参数名称"Type"匹配的参数`，整个开关直接失灵。
 * .NET API 不吃 provider，任何 PowerShell 版本、任何语言模式都能用。
 */
async function writeValues(entries: Array<[string, RegistryType, string]>): Promise<void> {
  if (entries.length === 0) return
  const parts = entries.map(([name, type, value]) => {
    const kind = type === 'REG_DWORD' ? 'DWord' : 'String'
    const psValue = type === 'REG_DWORD' ? value : `'${value.replace(/'/g, "''")}'`
    return `$k.SetValue('${name}', ${psValue}, [Microsoft.Win32.RegistryValueKind]::${kind})`
  })
  const script = [
    PS_UTF8,
    "$ErrorActionPreference = 'Stop'",
    `$k = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('${REG_PATH}', $true)`,
    `if ($null -eq $k) { throw '打不开 Internet Settings 注册表键' }`,
    ...parts,
    '$k.Close()'
  ].join('; ')
  await runPowerShell(script)
}

/** 通知系统设置已变更，浏览器等 WinINET 客户端会立刻重读 */
function broadcastChange(): void {
  if (process.platform !== 'win32') return
  // C# 的 DllImport 必须带双引号，但脚本里不能出现双引号（见 runPowerShell），用 [char]34 拼出来
  const script = [
    '$q = [char]34',
    "$sig = '[DllImport(' + $q + 'wininet.dll' + $q + ', SetLastError=true)] public static extern bool InternetSetOption(IntPtr h, int o, IntPtr b, int l);'",
    '$t = Add-Type -MemberDefinition $sig -Name WbInternet -Namespace Wb -PassThru',
    '$t::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0) | Out-Null',
    '$t::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0) | Out-Null'
  ].join('; ')
  // 部分受限环境禁用 Add-Type；通知失败不影响已写好的设置，浏览器下次取配置照样能读到
  void runPowerShell(script).catch(() => {})
}

export function isSupported(): boolean {
  return process.platform === 'win32'
}

async function readRaw(): Promise<ProxySnapshot> {
  // 一次读完三个值；键不存在时全部按"未设置"处理
  const script = [
    PS_UTF8,
    `$k = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('${REG_PATH}')`,
    `if ($null -eq $k) { '||' } else { '{0}|{1}|{2}' -f ([string]$k.GetValue('ProxyEnable', 0)), ([string]$k.GetValue('ProxyServer', '')), ([string]$k.GetValue('ProxyOverride', '')) }`
  ].join('; ')
  let out = ''
  try {
    out = (await runPowerShell(script)).trim()
  } catch {
    return { enabled: false, server: '', override: '' }
  }
  const [rawEnable = '', server = '', override = ''] = out.split('|')
  return {
    // REG_DWORD 取出来是 1 / 0
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

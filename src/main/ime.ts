import { ipcMain, type BrowserWindow } from 'electron'

/**
 * 内置游戏只认键盘，系统输入法会把按键截走、弹候选框，操作就废了。
 *
 * Electron / Chromium 没有关闭输入法的接口，这里退到 Win32：把窗口的键盘布局
 * 临时切到美式键盘（没有输入法），离开该模块时切回原来的布局。
 * 只改这个窗口所在的 UI 线程，不动系统全局设置；切回来时用原来的 HKL 句柄恢复，
 * 用户原本用的是哪个输入法就还是哪个。
 *
 * 之所以不用「让页面保持无可编辑焦点」这种偏方：有些第三方输入法（如搜狗）
 * 是全局钩子，只有真正切掉输入法才稳。
 */

/** 美式键盘（美国）布局，Windows 自带，切过去输入法就不参与按键了 */
const EN_US_KLID = '00000409'
const EN_US_LANGUAGE = 0x0409n
const WM_INPUTLANGCHANGEREQUEST = 0x0050
const KLF_ACTIVATE = 0x0001

interface Win32Api {
  /** 返回窗口所属线程 ID，pid 是出参 */
  GetWindowThreadProcessId: (hwnd: bigint, pid: number[]) => number
  /** 返回线程当前的键盘布局句柄；低 16 位是语言 ID。小值可能以 Number 返回 */
  GetKeyboardLayout: (threadId: number) => bigint | number
  LoadKeyboardLayoutW: (klid: string, flags: number) => bigint | number
  /** 直接给调用线程（主进程 UI 线程）换布局；窗口不在前台时也能生效 */
  ActivateKeyboardLayout: (hkl: bigint, flags: number) => bigint | number
  PostMessageW: (hwnd: bigint, msg: number, wParam: bigint, lParam: bigint) => boolean
}

let win32Promise: Promise<Win32Api | null> | null = null

/** 懒加载 koffi：非 Windows 或依赖缺失时静默降级，不影响其它功能 */
function loadWin32(): Promise<Win32Api | null> {
  if (!win32Promise) {
    win32Promise = (async () => {
      if (process.platform !== 'win32') return null
      try {
        const mod = (await import('koffi')) as typeof import('koffi') & {
          default?: typeof import('koffi')
        }
        const koffi = mod.default ?? mod
        const user32 = koffi.load('user32.dll')
        return {
          GetWindowThreadProcessId: user32.func(
            'uint32_t GetWindowThreadProcessId(void *hWnd, _Out_ uint32_t *lpdwProcessId)'
          ),
          GetKeyboardLayout: user32.func('uint64_t GetKeyboardLayout(uint32_t idThread)'),
          LoadKeyboardLayoutW: user32.func(
            'void *LoadKeyboardLayoutW(const char16_t *pwszKLID, uint32_t Flags)'
          ),
          ActivateKeyboardLayout: user32.func(
            'void *ActivateKeyboardLayout(void *hkl, uint32_t Flags)'
          ),
          PostMessageW: user32.func(
            'bool PostMessageW(void *hWnd, uint32_t Msg, uintptr_t wParam, intptr_t lParam)'
          )
        } as unknown as Win32Api
      } catch {
        return null
      }
    })()
  }
  return win32Promise
}

let blocked = false
/** 进入屏蔽前的布局句柄；0 表示进入时本来就是美式键盘，不用还原 */
let previousLayout = 0n
/** 美式键盘的 HKL，屏蔽期间守卫用它把被手动切走的布局拉回来 */
let enLayout = 0n
/** 进入 / 离开可能连着触发，串行执行，避免布局切来切去打架 */
let queue: Promise<unknown> = Promise.resolve()

interface Target {
  api: Win32Api
  hwnd: bigint
  threadId: number
}

/** 守卫：用户按 Shift / Win+Space 手动切回中文时，把布局再拉回美式键盘 */
const GUARD_INTERVAL_MS = 1500
let guardTimer: ReturnType<typeof setInterval> | null = null

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function lowLanguage(hkl: bigint): bigint {
  return hkl & 0xffffn
}

/** 等输入法切换真正落地（WM_INPUTLANGCHANGEREQUEST 是异步处理的） */
async function waitForLayout(api: Win32Api, threadId: number, language: bigint): Promise<boolean> {
  for (let i = 0; i < 10; i++) {
    if (lowLanguage(BigInt(api.GetKeyboardLayout(threadId))) === language) return true
    await sleep(40)
  }
  return false
}

/** 把指定线程切到 hkl，并确认生效 */
async function switchLayout(
  api: Win32Api,
  hwnd: bigint,
  threadId: number,
  hkl: bigint
): Promise<boolean> {
  // 主进程的 JS 就跑在窗口 UI 线程上，直接激活比只发消息更可靠（窗口在后台也生效）；
  // 再补一条消息，覆盖渲染进程那边重新请求布局的情况。
  api.ActivateKeyboardLayout(hkl, 0)
  api.PostMessageW(hwnd, WM_INPUTLANGCHANGEREQUEST, 0n, hkl)
  return waitForLayout(api, threadId, lowLanguage(hkl))
}

function stopGuard(): void {
  if (guardTimer) {
    clearInterval(guardTimer)
    guardTimer = null
  }
}

function startGuard(target: Target): void {
  stopGuard()
  const hkl = enLayout
  if (!hkl) return
  guardTimer = setInterval(() => {
    if (!blocked) return stopGuard()
    try {
      if (lowLanguage(BigInt(target.api.GetKeyboardLayout(target.threadId))) === EN_US_LANGUAGE) {
        return
      }
      target.api.ActivateKeyboardLayout(hkl, 0)
      target.api.PostMessageW(target.hwnd, WM_INPUTLANGCHANGEREQUEST, 0n, hkl)
    } catch {
      // 窗口 / 布局句柄失效，别再纠缠
      stopGuard()
    }
  }, GUARD_INTERVAL_MS)
  // 别让定时器拖住进程退出
  guardTimer.unref?.()
}

/** 取窗口句柄、所属线程和 Win32 入口；拿不到就返回 null */
async function resolveTarget(win: BrowserWindow | null): Promise<Target | null> {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return null
  const api = await loadWin32()
  if (!api) return null

  const handle = win.getNativeWindowHandle()
  if (handle.length < 4) return null
  const hwnd = handle.length >= 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0))
  if (!hwnd) return null

  const pid = [0]
  const threadId = api.GetWindowThreadProcessId(hwnd, pid)
  if (!threadId) return null

  return { api, hwnd, threadId }
}

async function applyImeBlocked(win: BrowserWindow | null, want: boolean): Promise<boolean> {
  if (!want) {
    stopGuard()
    const restore = previousLayout
    previousLayout = 0n
    blocked = false
    if (!restore) return true
    const target = await resolveTarget(win)
    if (!target) return false
    await switchLayout(target.api, target.hwnd, target.threadId, restore)
    return true
  }

  const target = await resolveTarget(win)
  if (!target) return false
  const { api, hwnd, threadId } = target

  // 已经在屏蔽态：只确认布局没被切走，不动 previousLayout
  if (blocked) {
    if (!enLayout) return true
    if (lowLanguage(BigInt(api.GetKeyboardLayout(threadId))) !== EN_US_LANGUAGE) {
      api.ActivateKeyboardLayout(enLayout, 0)
      api.PostMessageW(hwnd, WM_INPUTLANGCHANGEREQUEST, 0n, enLayout)
    }
    startGuard(target)
    return true
  }

  const current = BigInt(api.GetKeyboardLayout(threadId))
  // 已经是美式键盘，不需要动，也就不需要还原
  if (lowLanguage(current) === EN_US_LANGUAGE) {
    previousLayout = 0n
    blocked = true
    startGuard(target)
    return true
  }

  const hkl = api.LoadKeyboardLayoutW(EN_US_KLID, KLF_ACTIVATE)
  if (!hkl) return false
  enLayout = BigInt(hkl)
  if (!(await switchLayout(api, hwnd, threadId, enLayout))) {
    // 切不过去就当没成功，别把状态记错
    return false
  }
  previousLayout = current
  blocked = true
  startGuard(target)
  return true
}

/** 串行化的开关入口；渲染层在进入 / 离开烬落时调用 */
export function setImeBlocked(win: BrowserWindow | null, want: boolean): Promise<boolean> {
  const run = queue.then(() => applyImeBlocked(win, want))
  queue = run.catch(() => false)
  return run
}

/** 窗口销毁 / 应用退出时兜底，避免守卫定时器残留 */
export function disposeIme(): void {
  stopGuard()
  blocked = false
  previousLayout = 0n
}

export function registerImeIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('ime:setBlocked', (event, want: boolean) => {
    const win = getWindow()
    if (!win || win.isDestroyed()) return false
    // 只接受应用壳自己的请求
    if (event.sender.id !== win.webContents.id) return false
    return setImeBlocked(win, !!want)
  })
}

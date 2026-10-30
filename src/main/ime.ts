import { ipcMain, type BrowserWindow } from 'electron'

/**
 * 内置游戏只认键盘，系统输入法会把按键截走、弹候选框，操作就废了。
 *
 * Electron / Chromium 没有关闭输入法的接口，这里退到 Win32：把窗口的键盘布局
 * 临时切到美式键盘（没有输入法），窗口失焦或离开该模块时切回原来的布局。
 * 只改这个窗口所在的 UI 线程，不动系统全局设置；切回来时用原来的 HKL 句柄恢复，
 * 用户原本用的是哪个输入法就还是哪个。
 *
 * 关键是「只在窗口聚焦时生效」：键盘布局虽然是按线程记的，但切换语言时系统会
 * 一起更新当前输入语言，用户 alt-tab 到别的应用时若布局还停在英文就会很难受，
 * 所以失焦即还原、回焦再切英文。
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
  /** 当前前台窗口 */
  GetForegroundWindow: () => bigint | number
}

interface Target {
  api: Win32Api
  hwnd: bigint
  threadId: number
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
          ActivateKeyboardLayout: user32.func('void *ActivateKeyboardLayout(void *hkl, uint32_t Flags)'),
          PostMessageW: user32.func(
            'bool PostMessageW(void *hWnd, uint32_t Msg, uintptr_t wParam, intptr_t lParam)'
          ),
          GetForegroundWindow: user32.func('void *GetForegroundWindow()')
        } as unknown as Win32Api
      } catch {
        return null
      }
    })()
  }
  return win32Promise
}

/** 当前模块是否要求屏蔽输入法（离开烬落后为 false） */
let desired = false
/** 布局此刻是否已经被切到美式键盘 */
let applied = false
/** 切到美式键盘前的布局句柄；0 表示本来就在美式键盘，不用还原 */
let previousLayout = 0n
/** 美式键盘的 HKL，守卫用它把被手动切走的布局拉回来 */
let enLayout = 0n
/** 屏蔽生效时用的窗口 / 线程，退出时靠它同步还原 */
let activeTarget: Target | null = null
/** 进入 / 离开 / 失焦 / 回焦可能连着触发，串行执行，避免布局切来切去打架 */
let queue: Promise<unknown> = Promise.resolve()

/** 守卫：用户按 Shift / Win+Space 手动切回中文时，把布局再拉回美式键盘 */
const GUARD_INTERVAL_MS = 1500
let guardTimer: ReturnType<typeof setInterval> | null = null
/** 已经挂过焦点监听的窗口，避免重复绑定 */
const wired = new WeakSet<BrowserWindow>()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function lowLanguage(hkl: bigint): bigint {
  return hkl & 0xffffn
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn)
  queue = run.catch(() => false)
  return run
}

/** 等输入法切换真正落地（WM_INPUTLANGCHANGEREQUEST 是异步处理的） */
async function waitForLayout(api: Win32Api, threadId: number, language: bigint): Promise<boolean> {
  // 第一次加载布局可能要几百毫秒，给足时间，避免刚启动时误判失败
  for (let i = 0; i < 30; i++) {
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

/** 首次切换失败（布局还没加载好等）时隔一会儿再试一次，别让游戏停在中文输入法下 */
let retryTimer: ReturnType<typeof setTimeout> | null = null

function stopRetry(): void {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

function scheduleRetry(win: BrowserWindow): void {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    if (!desired || applied || win.isDestroyed() || !win.isFocused()) return
    void enqueue(() => blockLayout(win))
  }, 600)
  retryTimer.unref?.()
}

function startGuard(win: BrowserWindow, target: Target): void {
  stopGuard()
  const hkl = enLayout
  if (!hkl) return
  guardTimer = setInterval(() => {
    // 失焦时已经还原成用户的输入法了，别再抢
    if (!applied || win.isDestroyed() || !win.isFocused()) return stopGuard()
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

/** 把布局切到美式键盘；窗口没聚焦或已在屏蔽态时什么都不做 */
async function blockLayout(win: BrowserWindow): Promise<boolean> {
  if (!desired || applied) return applied
  const target = await resolveTarget(win)
  if (!target) return false
  const { api, hwnd, threadId } = target

  const current = BigInt(api.GetKeyboardLayout(threadId))
  // 用户本来就在美式键盘：不用动，也不用还原
  if (lowLanguage(current) === EN_US_LANGUAGE) {
    previousLayout = 0n
    applied = true
    activeTarget = target
    startGuard(win, target)
    return true
  }

  const hkl = api.LoadKeyboardLayoutW(EN_US_KLID, KLF_ACTIVATE)
  if (!hkl) {
    scheduleRetry(win)
    return false
  }
  enLayout = BigInt(hkl)
  const ok = await switchLayout(api, hwnd, threadId, enLayout)
  // 切换偶尔会比等待窗口慢半拍：只要最后落在美式键盘上就算成功，
  // 否则记下「进入前」的布局安排一次重试，别把还原目标弄丢
  if (!ok && lowLanguage(BigInt(api.GetKeyboardLayout(threadId))) !== EN_US_LANGUAGE) {
    scheduleRetry(win)
    return false
  }
  previousLayout = current
  applied = true
  activeTarget = target
  startGuard(win, target)
  return true
}

/** 还原成进入前的布局 */
async function restoreLayout(win: BrowserWindow | null): Promise<boolean> {
  stopGuard()
  stopRetry()
  if (!applied) return true
  applied = false
  activeTarget = null
  const restore = previousLayout
  previousLayout = 0n
  if (!restore) return true
  const target = await resolveTarget(win)
  if (!target) return false
  await switchLayout(target.api, target.hwnd, target.threadId, restore)
  return true
}

/** 等前台窗口从自己换成别人；一直没换（比如点了任务栏空白处）就返回 0n */
async function waitForOtherForeground(api: Win32Api, self: bigint): Promise<bigint> {
  for (let i = 0; i < 10; i++) {
    await sleep(60)
    try {
      const foreground = BigInt(api.GetForegroundWindow())
      if (foreground && foreground !== self) return foreground
    } catch {
      return 0n
    }
  }
  return 0n
}

/**
 * 切到别的应用时把它也切回用户原来的输入法。
 *
 * Windows 的输入语言在这台机器上是全局的：我们把窗口切到美式键盘后，
 * 别的应用被激活时也会跟着变成英文，光还原自己的线程不够。这里在失焦后
 * 把当前前台窗口也拨回去，用户 alt-tab 过去就是原来的输入法。
 *
 * 用轮询而不是固定延时：blur 事件到达时前台窗口往往还没换过来，睡死后
 * 很可能捞到的还是自己（于是什么都不做，英文就留在别的应用里了）。
 */
async function restoreForeground(self: bigint, hkl: bigint): Promise<void> {
  if (!hkl) return
  const api = await loadWin32()
  if (!api) return
  try {
    const foreground = await waitForOtherForeground(api, self)
    if (!foreground) return

    const pid = [0]
    const threadId = api.GetWindowThreadProcessId(foreground, pid)
    if (!threadId) return
    // 前台线程已经是原布局就别动（用户在那个应用里本来就用这个输入法）
    if (lowLanguage(BigInt(api.GetKeyboardLayout(threadId))) === lowLanguage(hkl)) return
    // 跨进程投递布局切换；目标若是管理员权限窗口会被 UIPI 挡下，交给 catch
    api.PostMessageW(foreground, WM_INPUTLANGCHANGEREQUEST, 0n, hkl)
  } catch {
    // 前台窗口正在销毁 / 无权限，忽略
  }
}

/** 窗口的原生句柄（拿不到返回 0n） */
function windowHandle(win: BrowserWindow): bigint {
  try {
    const handle = win.getNativeWindowHandle()
    if (handle.length < 4) return 0n
    return handle.length >= 8 ? handle.readBigUInt64LE(0) : BigInt(handle.readUInt32LE(0))
  } catch {
    return 0n
  }
}

/**
 * 失焦就还原、回焦再屏蔽：别的应用要能用回用户自己的输入法。
 * 监听在第一次收到屏蔽请求时挂上（此时窗口已经创建）。
 */
function wireWindow(win: BrowserWindow): void {
  if (wired.has(win)) return
  wired.add(win)
  win.on('blur', () => {
    if (!applied) return
    const restore = previousLayout
    const self = windowHandle(win)
    void enqueue(() => restoreLayout(win)).then(() => {
      if (restore) void restoreForeground(self, restore)
    })
  })
  win.on('focus', () => {
    if (desired && !applied) void enqueue(() => blockLayout(win))
  })
  win.on('closed', () => {
    stopGuard()
    stopRetry()
    desired = false
    applied = false
    previousLayout = 0n
    activeTarget = null
  })
  // 关窗口 / 退出时来不及等异步，直接同步切回去，别让 Windows 记住这个应用是英文；
  // desired 不动：收进托盘后再打开，回到烬落仍会重新屏蔽
  win.on('close', () => {
    const target = activeTarget
    const restore = previousLayout
    const self = windowHandle(win)
    stopGuard()
    stopRetry()
    applied = false
    previousLayout = 0n
    activeTarget = null
    if (!target || !restore) return
    try {
      target.api.ActivateKeyboardLayout(restore, 0)
      target.api.PostMessageW(target.hwnd, WM_INPUTLANGCHANGEREQUEST, 0n, restore)
    } catch {
      // 窗口已经在销毁，忽略
    }
    // 退出前顺手把可能被带成英文的前台窗口拨回去
    void restoreForeground(self, restore)
  })
}

/** 串行化的开关入口；渲染层在进入 / 离开烬落时调用 */
export function setImeBlocked(win: BrowserWindow | null, want: boolean): Promise<boolean> {
  if (process.platform !== 'win32' || !win || win.isDestroyed()) return Promise.resolve(false)
  wireWindow(win)
  desired = want
  return enqueue(() => {
    if (!want) return restoreLayout(win)
    // 窗口不在前台时不抢布局，等它回到前台再切
    if (!win.isFocused()) return Promise.resolve(applied)
    return blockLayout(win)
  })
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

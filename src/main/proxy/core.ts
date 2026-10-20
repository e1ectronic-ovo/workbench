import { execFile, spawn, type ChildProcess } from 'child_process'

const MAX_LOG_LINES = 200

export interface CoreStartOptions {
  binPath: string
  workDir: string
  configPath: string
  /** 额外参数，留作调试用 */
  extraArgs?: string[]
}

/**
 * mihomo 子进程的托管：启动、日志收集、优雅退出。
 * 只负责进程本身，配置与 REST 由上层处理。
 */
export class MihomoCore {
  private child: ChildProcess | null = null
  private logs: string[] = []

  onExit?: (code: number | null) => void

  get pid(): number | null {
    return this.child?.pid ?? null
  }

  isRunning(): boolean {
    return this.child !== null && this.child.exitCode === null && !this.child.killed
  }

  start(options: CoreStartOptions): void {
    if (this.isRunning()) return

    const args = ['-d', options.workDir, '-f', options.configPath, ...(options.extraArgs ?? [])]
    const child = spawn(options.binPath, args, {
      cwd: options.workDir,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.child = child
    this.logs = []

    const push = (chunk: Buffer): void => {
      const text = chunk.toString('utf8')
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed) continue
        this.logs.push(trimmed)
        if (this.logs.length > MAX_LOG_LINES) this.logs.shift()
      }
    }

    child.stdout?.on('data', push)
    child.stderr?.on('data', push)

    child.on('error', (err) => {
      this.logs.push(`[spawn error] ${err.message}`)
    })

    child.on('exit', (code, signal) => {
      const wasCurrent = this.child === child
      this.child = null
      if (wasCurrent) this.onExit?.(code ?? (signal ? -1 : null))
    })
  }

  /** 同步强杀，供 app 退出路径使用 */
  killNow(): void {
    const child = this.child
    if (!child || child.pid == null) return
    this.child = null
    const pid = child.pid
    try {
      if (process.platform === 'win32') {
        execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, () => {})
      } else {
        child.kill('SIGKILL')
      }
    } catch {
      /* ignore */
    }
  }

  /** 优雅停止：先 TERM，超时再强杀 */
  async stop(timeoutMs = 2500): Promise<void> {
    const child = this.child
    if (!child || child.pid == null) {
      this.child = null
      return
    }

    const pid = child.pid
    const exited = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs)
      child.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })

    try {
      if (process.platform === 'win32') {
        // Windows 下 child.kill 不会带走子进程树
        execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, () => {})
      } else {
        child.kill('SIGTERM')
      }
    } catch {
      /* ignore */
    }

    await exited
    this.child = null
  }

  logTail(lines = 12): string[] {
    return this.logs.slice(-lines)
  }

  lastLogLine(): string {
    return this.logs.length ? this.logs[this.logs.length - 1] : ''
  }
}

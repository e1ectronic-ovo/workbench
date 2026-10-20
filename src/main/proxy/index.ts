import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { copyFileSync, existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { createServer } from 'net'
import {
  coreBinaryName,
  emptyProfile,
  emptyTraffic,
  type ProxyActionResult,
  type ProxyGroup,
  type ProxyMode,
  type ProxyProfile,
  type ProxyProfileInfo,
  type ProxySettings,
  type ProxySnapshot,
  type ProxyTraffic
} from '../../common/proxy'
import { MihomoClient, pickActiveGroup, toGroups } from './api'
import { configPath, fetchSubscription, writeConfig } from './config'
import { MihomoCore } from './core'
import * as profileStore from './profiles'
import { patchSettings, proxyDir, readSettings } from './settings'
import * as systemProxy from './system-proxy'

/**
 * 内核首次启动要先下载 GeoIP/GeoSite 数据（约 4 MB），网络差时可能超过一分钟，
 * 所以健康检查窗口给到 90 秒；超时通常是真的起不来了。
 */
const HEALTH_TIMEOUT = 90000
const POLL_INTERVAL = 1000

/** 内置的 geo 数据文件名，存在就预置到工作目录，省掉首次联网下载 */
const GEODATA_FILES = ['geoip.metadb', 'country.mmdb', 'geosite.dat', 'geoip.dat']

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** undici 的统一报错是 "fetch failed"，真实原因在 cause 里 */
function describeFetchError(error: unknown): string {
  const message = errorMessage(error)
  if (!/fetch failed/i.test(message)) return message
  const cause = (error as { cause?: { code?: string; message?: string } })?.cause
  const code = cause?.code
  if (code === 'ECONNREFUSED') return '控制端口还没有开始监听'
  if (code === 'ECONNRESET') return '控制端口连接被重置'
  if (code) return `${code}${cause?.message ? `（${cause.message}）` : ''}`
  return '连不上控制端口'
}

function portAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, '127.0.0.1')
  })
}

export class ProxyService {
  private settings: ProxySettings = readSettings()
  private status: ProxySnapshot['status'] = 'stopped'
  private error: string | null = null
  private version: string | null = null
  private client: MihomoClient | null = null
  private readonly core = new MihomoCore()
  private groups: ProxyGroup[] = []
  private traffic: ProxyTraffic = emptyTraffic()
  private totals: { up: number; down: number; at: number } | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private pollBusy = false
  private tick = 0
  private desiredRunning = false
  private crashCount = 0
  private startedAt = 0
  private systemProxyOn = false
  /** 最近一次启动时是否要求接管系统代理，崩溃重启时据此恢复 */
  private proxyRequested = false
  /** 正在测速的组名与批次令牌，用于旧批次自动作废 */
  private testingGroup: string | null = null
  private testToken = 0

  async init(): Promise<void> {
    // 上次异常退出可能把系统代理指向了不存在的内核，先还原
    await systemProxy.recoverOnStart().catch(() => {})
    this.systemProxyOn = false

    this.core.onExit = () => {
      if (!this.desiredRunning) return
      this.handleUnexpectedExit()
    }

    // 有配置就自动拉起内核（不再提供开关）
    if (profileStore.activeText() && this.coreReady()) {
      setTimeout(() => {
        void this.start()
      }, 1200)
    }
  }

  // ── 路径与能力 ──

  private defaultCorePath(): string {
    const dir = app.isPackaged
      ? join(process.resourcesPath, 'core')
      : join(app.getAppPath(), 'resources', 'core')
    return join(dir, coreBinaryName(process.platform))
  }

  /** 内核随应用分发，一律使用内置路径 */
  corePath(): string {
    return this.defaultCorePath()
  }

  coreReady(): boolean {
    return existsSync(this.corePath())
  }

  /**
   * 把随包分发的 GeoIP/GeoSite 数据预置到工作目录。
   * 不预置的话内核首次启动会先联网下载，代理本身还没起来时这一步最容易卡住。
   * 本地文件明显偏小说明上次下载被中断，直接换成完好的那份。
   */
  private seedGeodata(): void {
    const dir = app.isPackaged
      ? join(process.resourcesPath, 'core', 'geodata')
      : join(app.getAppPath(), 'resources', 'core', 'geodata')
    if (!existsSync(dir)) return

    for (const name of GEODATA_FILES) {
      const from = join(dir, name)
      if (!existsSync(from)) continue
      const to = join(proxyDir(), name)
      try {
        const bundled = statSync(from).size
        const local = existsSync(to) ? statSync(to).size : 0
        // 缺失、或比内置副本小一大截（上次下载被中断）时用内置副本覆盖
        if (bundled > 0 && local >= bundled * 0.6) continue
        copyFileSync(from, to)
      } catch {
        /* 数据可选，复制失败就让内核自己下载 */
      }
    }
  }

  // ── 生命周期 ──

  /**
   * 拉起内核。systemProxy 决定这次要不要顺手接管系统代理：
   * - 界面点「连接」→ true
   * - 只是打开节点列表要测速 → false（内核起来就能测，不动系统代理）
   */
  async start(options: { systemProxy?: boolean } = {}): Promise<ProxyActionResult> {
    const wantProxy = options.systemProxy ?? this.settings.systemProxy

    if (this.status === 'running') {
      if (wantProxy && !this.systemProxyOn) {
        this.proxyRequested = true
        const applied = await this.applySystemProxy(true)
        if (!applied.ok) return applied
      }
      return { ok: true }
    }
    if (this.status === 'starting') return { ok: true }

    this.error = null
    this.proxyRequested = wantProxy
    const settings = this.settings

    if (!this.coreReady()) {
      return this.fail('未找到代理内核。把 mihomo 可执行文件放到内核目录，或在设置里指定路径。')
    }
    const profileText = profileStore.activeText()
    if (!profileText) {
      return this.fail('还没有订阅或配置文件，先在设置里导入。')
    }

    this.status = 'starting'
    this.emit()

    try {
      const free = await portAvailable(settings.mixedPort)
      if (!free) {
        throw new Error(
          `代理端口 ${settings.mixedPort} 已被占用，可能是 FLClash / Clash Verge 正在运行。关掉它们或改端口后重试。`
        )
      }

      writeConfig(settings, profileText)
      this.seedGeodata()

      this.core.start({
        binPath: this.corePath(),
        workDir: proxyDir(),
        configPath: configPath()
      })

      const client = new MihomoClient(settings.controllerPort, settings.secret)
      await this.waitHealthy(client)

      this.client = client
      this.status = 'running'
      this.desiredRunning = true
      this.crashCount = 0
      this.startedAt = Date.now()
      this.version = (await client.version().catch(() => null))?.version ?? null

      if (settings.mode !== 'rule') {
        await client.setMode(settings.mode).catch(() => {})
      }

      await this.refreshGroups()
      this.startPolling()

      if (wantProxy) {
        const applied = await this.applySystemProxy(true)
        if (!applied.ok && applied.error) this.error = applied.error
      }

      this.emit()
      return { ok: true }
    } catch (e) {
      const detail = this.core.lastLogLine()
      await this.core.stop().catch(() => {})
      this.client = null
      this.desiredRunning = false
      this.status = 'error'
      this.error = detail ? `${errorMessage(e)}（${detail}）` : errorMessage(e)
      this.emit()
      return { ok: false, error: this.error }
    }
  }

  async stop(): Promise<ProxyActionResult> {
    this.desiredRunning = false
    this.stopPolling()

    if (this.systemProxyOn) {
      await this.applySystemProxy(false).catch(() => {})
    }

    this.client = null
    await this.core.stop().catch(() => {})
    this.status = 'stopped'
    this.error = null
    this.traffic = emptyTraffic()
    this.totals = null
    this.groups = []
    this.emit()
    return { ok: true }
  }

  async restart(): Promise<ProxyActionResult> {
    await this.stop()
    return this.start()
  }

  /** app 退出路径：还原系统代理、结束子进程 */
  async shutdown(): Promise<void> {
    this.desiredRunning = false
    this.stopPolling()
    if (this.systemProxyOn) await this.applySystemProxy(false).catch(() => {})
    this.core.killNow()
  }

  private fail(message: string): ProxyActionResult {
    this.status = this.status === 'running' ? 'running' : 'error'
    this.error = message
    this.emit()
    return { ok: false, error: message }
  }

  private handleUnexpectedExit(): void {
    this.client = null
    this.stopPolling()
    this.status = 'error'

    const now = Date.now()
    const recent = now - this.startedAt < 15000
    this.crashCount = recent ? this.crashCount + 1 : 1

    if (this.crashCount <= 2) {
      this.error = '内核意外退出，正在重试…'
      this.emit()
      setTimeout(() => {
        if (!this.desiredRunning) return
        void this.start({ systemProxy: this.proxyRequested })
      }, 1500)
      return
    }

    this.desiredRunning = false
    this.error = `内核反复退出：${this.core.lastLogLine() || '请检查配置文件'}`
    this.emit()
  }

  private async waitHealthy(client: MihomoClient): Promise<void> {
    const startedAt = Date.now()
    let lastError = '控制端口没有响应'

    while (Date.now() - startedAt < HEALTH_TIMEOUT) {
      if (!this.core.isRunning()) {
        const log = this.core.lastLogLine()
        throw new Error(log ? `内核进程已退出：${log}` : '内核进程已退出')
      }
      try {
        await client.version()
        return
      } catch (e) {
        // 内核还在初始化（首次启动会先下载 GeoIP 数据），继续等
        lastError = describeFetchError(e)
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    throw new Error(
      `内核 ${Math.round(HEALTH_TIMEOUT / 1000)} 秒内没有就绪：${lastError}。` +
        '首次启动需要下载 GeoIP 数据，网络受限时会比较慢，重试一次通常就好；' +
        '若反复失败，检查代理端口是否被其他客户端占用。'
    )
  }

  // ── 状态轮询 ──

  private startPolling(): void {
    this.stopPolling()
    this.pollTimer = setInterval(() => {
      void this.poll()
    }, POLL_INTERVAL)
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.pollBusy = false
  }

  private async poll(): Promise<void> {
    const client = this.client
    if (!client || this.pollBusy || this.status !== 'running') return
    this.pollBusy = true
    try {
      const connections = await client.connections()
      const now = Date.now()
      const totalUp = connections.uploadTotal ?? 0
      const totalDown = connections.downloadTotal ?? 0
      const list = Array.isArray(connections.connections) ? connections.connections.length : 0

      if (this.totals) {
        const seconds = Math.max((now - this.totals.at) / 1000, 0.2)
        const up = Math.max(totalUp - this.totals.up, 0)
        const down = Math.max(totalDown - this.totals.down, 0)
        this.traffic = {
          up: Math.round(up / seconds),
          down: Math.round(down / seconds),
          totalUp,
          totalDown,
          connections: list
        }
      } else {
        this.traffic = { up: 0, down: 0, totalUp, totalDown, connections: list }
      }
      this.totals = { up: totalUp, down: totalDown, at: now }

      this.tick++
      // 节点列表变化不频繁，两拍刷一次即可
      if (this.tick % 2 === 0) await this.refreshGroups()
    } catch {
      /* 内核重启中会短时不可用，保留上一次结果 */
    } finally {
      this.pollBusy = false
    }
  }

  private async refreshGroups(): Promise<void> {
    const client = this.client
    if (!client) return
    try {
      const payload = await client.proxies()
      this.groups = toGroups(payload)
    } catch {
      /* ignore */
    }
  }

  // ── 查询 ──

  async snapshot(): Promise<ProxySnapshot> {
    const active = pickActiveGroup(this.groups)
    const activeNode = active ? active.nodes.find((n) => n.name === active.now) : undefined
    const store = profileStore.listProfiles()
    const current = store.profiles.find((p) => p.id === store.activeId) ?? null

    const profile: ProxyProfileInfo = current
      ? {
          name: current.name,
          source: current.source,
          url: current.url,
          updatedAt: current.updatedAt,
          nodeCount: current.nodeCount,
          subscription: current.subscription ?? null
        }
      : emptyProfile()

    return {
      status: this.status,
      running: this.status === 'running',
      starting: this.status === 'starting',
      error: this.error,
      version: this.version,
      coreReady: this.coreReady(),
      corePath: this.corePath(),
      activeGroup: active?.name ?? '',
      activeNode: active?.now ?? '',
      activeDelay: activeNode?.delay ?? -1,
      traffic: this.traffic,
      profile,
      profiles: store.profiles,
      activeProfileId: store.activeId,
      settings: this.settings,
      systemProxy: this.systemProxyOn,
      nodeCount: active?.nodes.length ?? 0,
      groupCount: this.groups.length
    }
  }

  async listGroups(): Promise<ProxyGroup[]> {
    if (this.client) await this.refreshGroups()
    return this.groups
  }

  async logs(): Promise<string[]> {
    return this.core.logTail(40)
  }

  // ── 操作 ──

  async select(group: string, node: string): Promise<ProxyActionResult> {
    if (!this.client) return { ok: false, error: '内核没有运行' }
    try {
      await this.client.select(group, node)
      await this.refreshGroups()
      this.emit()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: errorMessage(e) }
    }
  }

  async testDelay(node: string): Promise<number> {
    if (!this.client) return -1
    try {
      const delay = await this.client.delay(node)
      const group = pickActiveGroup(this.groups)
      const target = group?.nodes.find((n) => n.name === node)
      if (target) target.delay = delay
      this.emit()
      return delay
    } catch {
      return -1
    }
  }

  /**
   * 整组并发测速。逐条推 proxy:test-progress，界面据此实时刷新延迟。
   * 新的一次测速会让上一批自动作废，避免切换分组时两批结果互相覆盖。
   */
  async testGroup(groupName: string): Promise<ProxyGroup | null> {
    const client = this.client
    if (!client) return null

    const group = this.groups.find((g) => g.name === groupName)
    if (!group || group.nodes.length === 0) return null

    const token = ++this.testToken
    this.testingGroup = groupName
    const total = group.nodes.length
    let tested = 0
    let cursor = 0

    const worker = async (): Promise<void> => {
      while (cursor < group.nodes.length) {
        if (token !== this.testToken) return
        const node = group.nodes[cursor++]
        let delay = -1
        try {
          delay = await client.delay(node.name, 4000)
        } catch {
          delay = -1
        }
        if (token !== this.testToken) return
        node.delay = delay
        node.alive = delay >= 0
        tested++
        this.emitEvent('proxy:test-progress', {
          group: groupName,
          node: node.name,
          delay,
          tested,
          total,
          done: tested >= total
        })
      }
    }

    // 单次并发 6 个：再高容易把机场打成限流，再低整组要等太久
    const workers = Math.min(6, group.nodes.length)
    await Promise.all(Array.from({ length: workers }, worker))

    if (token === this.testToken) {
      this.testingGroup = null
      this.emit()
    }
    return group
  }

  async setMode(mode: ProxyMode): Promise<ProxyActionResult> {
    this.settings = patchSettings({ mode })
    if (this.client) {
      try {
        await this.client.setMode(mode)
      } catch (e) {
        return { ok: false, error: errorMessage(e) }
      }
    } else {
      try {
        const text = profileStore.activeText()
        if (text) writeConfig(this.settings, text)
      } catch {
        /* 还没配置时写不了配置文件，忽略 */
      }
    }
    this.emit()
    return { ok: true }
  }

  async patchSettings(patch: Partial<ProxySettings>): Promise<ProxySnapshot> {
    const previous = this.settings
    this.settings = patchSettings(patch)

    const needsRestart =
      this.status === 'running' &&
      (previous.mixedPort !== this.settings.mixedPort ||
        previous.controllerPort !== this.settings.controllerPort ||
        previous.secret !== this.settings.secret ||
        previous.allowLan !== this.settings.allowLan)

    if (previous.systemProxy !== this.settings.systemProxy && this.status === 'running') {
      const applied = await this.applySystemProxy(this.settings.systemProxy)
      if (!applied.ok && applied.error) this.error = applied.error
      else this.error = null
    }

    if (needsRestart) {
      await this.restart()
    }

    this.emit()
    return this.snapshot()
  }

  async setSystemProxy(enabled: boolean): Promise<ProxyActionResult> {
    this.settings = patchSettings({ systemProxy: enabled })
    if (!enabled) {
      this.proxyRequested = false
      await this.applySystemProxy(false)
      return { ok: true }
    }
    if (this.status !== 'running') {
      return { ok: false, error: '先连接内核，再接管系统代理' }
    }
    this.proxyRequested = true
    const result = await this.applySystemProxy(true)
    return result
  }

  /**
   * 主页卡片上那个开关：只管"要不要让系统流量走代理"。
   * 关掉时内核继续运行，节点列表和测速照样可用。
   */
  async toggleProxy(enabled?: boolean): Promise<ProxyActionResult> {
    const want = enabled ?? !this.systemProxyOn
    this.settings = patchSettings({ systemProxy: want })
    this.proxyRequested = want

    if (!want) {
      await this.applySystemProxy(false)
      return { ok: true }
    }

    // 内核可能只是为了看节点而常驻着，这里补上系统代理即可
    if (this.status === 'running') {
      return this.applySystemProxy(true)
    }

    return this.start({ systemProxy: true })
  }

  private async applySystemProxy(enabled: boolean): Promise<ProxyActionResult> {
    if (!systemProxy.isSupported()) {
      this.systemProxyOn = false
      return { ok: false, error: '当前系统暂不支持自动接管系统代理' }
    }
    try {
      if (enabled) {
        await systemProxy.enable(this.settings.mixedPort)
        this.systemProxyOn = true
      } else {
        await systemProxy.disable()
        this.systemProxyOn = false
      }
      this.emit()
      return { ok: true }
    } catch (e) {
      this.systemProxyOn = false
      return { ok: false, error: errorMessage(e) }
    }
  }

  async importProfile(): Promise<ProxyActionResult & { profile?: ProxyProfile }> {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const result = win
      ? await dialog.showOpenDialog(win, {
          title: '选择 Clash / mihomo 配置文件',
          properties: ['openFile'],
          filters: [{ name: 'Clash 配置', extensions: ['yaml', 'yml'] }]
        })
      : await dialog.showOpenDialog({
          title: '选择 Clash / mihomo 配置文件',
          properties: ['openFile'],
          filters: [{ name: 'Clash 配置', extensions: ['yaml', 'yml'] }]
        })

    if (result.canceled || !result.filePaths[0]) return { ok: false, error: '已取消' }

    try {
      const file = result.filePaths[0]
      const text = readFileSync(file, 'utf8')
      const base = file.split(/[\\/]/).pop()?.replace(/\.ya?ml$/i, '')
      const profile = profileStore.addProfile({
        name: base,
        source: 'file',
        url: '',
        text
      })
      this.settings = patchSettings({ subscriptionUrl: '' })
      writeConfig(this.settings, text)
      if (this.status === 'running') await this.restart()
      this.emit()
      return { ok: true, profile }
    } catch (e) {
      return { ok: false, error: errorMessage(e) }
    }
  }

  async setSubscription(
    url: string,
    name?: string
  ): Promise<ProxyActionResult & { profile?: ProxyProfile }> {
    const trimmed = url.trim()
    if (!trimmed) return { ok: false, error: '请填写订阅地址' }
    try {
      const fetched = await fetchSubscription(trimmed)
      const requestedName = name?.trim() ?? ''
      // 同一个订阅地址并指定了名称时视为「更新」，否则新增一份配置
      const existing = profileStore
        .listProfiles()
        .profiles.find((p) => p.source === 'subscription' && p.url === trimmed)
      const autoName = fetched.name.trim()
      const adoptedName =
        requestedName || (existing?.nameSource === 'manual' ? '' : autoName)
      const profile = existing
        ? profileStore.updateContent(existing.id, fetched.text, trimmed, {
            name: adoptedName || undefined,
            nameSource: requestedName ? 'manual' : 'auto',
            subscription: fetched.subscription
          })
        : profileStore.addProfile({
            name: requestedName || autoName || undefined,
            nameSource: requestedName ? 'manual' : 'auto',
            source: 'subscription',
            url: trimmed,
            text: fetched.text,
            subscription: fetched.subscription
          })
      if (!profile) return { ok: false, error: '写入配置失败' }

      profileStore.setActive(profile.id)
      this.settings = patchSettings({ subscriptionUrl: trimmed })
      writeConfig(this.settings, fetched.text)
      if (this.status === 'running') await this.restart()
      this.emit()
      return { ok: true, profile }
    } catch (e) {
      return { ok: false, error: errorMessage(e) }
    }
  }

  /** 刷新当前配置；如果它是订阅就重新拉取，本地文件则提示重新导入 */
  async updateSubscription(): Promise<ProxyActionResult & { profile?: ProxyProfile }> {
    const active = profileStore.activeProfile()
    if (!active) return { ok: false, error: '还没有配置' }
    if (active.source !== 'subscription' || !active.url) {
      return { ok: false, error: '本地配置文件无法在线更新，请重新导入' }
    }
    return this.setSubscription(active.url)
  }

  async switchProfile(id: string): Promise<ProxyActionResult> {
    const profile = profileStore.setActive(id)
    if (!profile) return { ok: false, error: '找不到这份配置' }
    const text = profileStore.activeText()
    if (!text) return { ok: false, error: '配置内容为空' }

    try {
      writeConfig(this.settings, text)
    } catch (e) {
      return { ok: false, error: errorMessage(e) }
    }
    this.settings = patchSettings({ subscriptionUrl: profile.url })
    if (this.status === 'running') await this.restart()
    this.emit()
    return { ok: true }
  }

  async removeProfile(id: string): Promise<ProxyActionResult> {
    const wasActive = profileStore.listProfiles().activeId === id
    const next = profileStore.remove(id)
    if (wasActive) {
      const text = profileStore.activeText()
      if (text) {
        writeConfig(this.settings, text)
        if (this.status === 'running') await this.restart()
      } else if (this.status === 'running') {
        await this.stop()
      }
      this.settings = patchSettings({ subscriptionUrl: '' })
    }
    this.emit()
    return { ok: next.profiles.length >= 0 }
  }

  async renameProfile(id: string, name: string): Promise<ProxyActionResult> {
    const profile = profileStore.rename(id, name)
    if (!profile) return { ok: false, error: '找不到这份配置' }
    this.emit()
    return { ok: true }
  }

  /** 广播状态变化；测速进度等带载荷的事件走 emitEvent */
  private emit(): void {
    this.emitEvent('proxy:state')
  }

  private emitEvent(channel: string, payload?: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue
      if (payload === undefined) win.webContents.send(channel)
      else win.webContents.send(channel, payload)
    }
  }
}

export function registerProxyIpc(service: ProxyService): void {
  ipcMain.handle('proxy:snapshot', () => service.snapshot())
  ipcMain.handle('proxy:groups', () => service.listGroups())
  ipcMain.handle('proxy:logs', () => service.logs())
  ipcMain.handle('proxy:start', () => service.start())
  ipcMain.handle('proxy:startCore', () => service.start({ systemProxy: false }))
  ipcMain.handle('proxy:toggleProxy', (_e, enabled: boolean | undefined) =>
    service.toggleProxy(enabled)
  )
  ipcMain.handle('proxy:stop', () => service.stop())
  ipcMain.handle('proxy:restart', () => service.restart())
  ipcMain.handle('proxy:select', (_e, payload: { group: string; node: string }) =>
    service.select(payload.group, payload.node)
  )
  ipcMain.handle('proxy:testDelay', (_e, node: string) => service.testDelay(node))
  ipcMain.handle('proxy:testGroup', (_e, group: string) => service.testGroup(group))
  ipcMain.handle('proxy:setMode', (_e, mode: ProxyMode) => service.setMode(mode))
  ipcMain.handle('proxy:patchSettings', (_e, patch: Partial<ProxySettings>) =>
    service.patchSettings(patch)
  )
  ipcMain.handle('proxy:setSystemProxy', (_e, enabled: boolean) => service.setSystemProxy(enabled))
  ipcMain.handle('proxy:importProfile', () => service.importProfile())
  ipcMain.handle('proxy:setSubscription', (_e, payload: { url: string; name?: string }) =>
    service.setSubscription(payload.url, payload.name)
  )
  ipcMain.handle('proxy:updateSubscription', () => service.updateSubscription())
  ipcMain.handle('proxy:switchProfile', (_e, id: string) => service.switchProfile(id))
  ipcMain.handle('proxy:removeProfile', (_e, id: string) => service.removeProfile(id))
  ipcMain.handle('proxy:renameProfile', (_e, payload: { id: string; name: string }) =>
    service.renameProfile(payload.id, payload.name)
  )
}

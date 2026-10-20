import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  ProxyGroup,
  ProxyMode,
  ProxySettings,
  ProxySnapshot,
  ProxyTestProgress
} from '../../../common/proxy'

export const useProxyStore = defineStore('proxy', () => {
  const snapshot = ref<ProxySnapshot | null>(null)
  const groups = ref<ProxyGroup[]>([])
  const busy = ref(false)
  const notice = ref<string | null>(null)
  const noticeKind = ref<'ok' | 'error'>('ok')
  const testing = ref(false)
  const testProgress = ref({ tested: 0, total: 0, done: false })

  const api = () => window.workbench?.proxy

  /** 内核是否在跑：测速、切节点都依赖它 */
  const running = computed(() => snapshot.value?.running ?? false)
  /** 系统流量是否已走代理（卡片上那个开关） */
  const connected = computed(() => snapshot.value?.systemProxy ?? false)

  const profiles = computed(() => snapshot.value?.profiles ?? [])
  const activeProfile = computed(
    () => profiles.value.find((p) => p.id === snapshot.value?.activeProfileId) ?? null
  )

  const statusText = computed(() => {
    const s = snapshot.value
    if (!s) return '读取中'
    if (s.status === 'error') return '异常'
    if (s.status === 'starting') return '启动中'
    if (s.systemProxy) return '已连接'
    if (s.status === 'running') return '未接管'
    return '未连接'
  })

  function flash(message: string, kind: 'ok' | 'error' = 'ok'): void {
    notice.value = message
    noticeKind.value = kind
    window.setTimeout(() => {
      if (notice.value === message) notice.value = null
    }, 4000)
  }

  async function refresh(): Promise<void> {
    const proxy = api()
    if (!proxy) return
    try {
      snapshot.value = await proxy.snapshot()
    } catch {
      /* 主进程还没就绪 */
    }
  }

  async function loadGroups(): Promise<void> {
    const proxy = api()
    if (!proxy) return
    try {
      groups.value = await proxy.groups()
    } catch {
      /* ignore */
    }
  }

  /** 卡片开关：只管系统代理，内核保持运行 */
  async function toggleProxy(enabled?: boolean): Promise<void> {
    const proxy = api()
    if (!proxy || busy.value) return
    busy.value = true
    try {
      const result = await proxy.toggleProxy(enabled)
      if (!result.ok && result.error) flash(result.error, 'error')
    } catch (e) {
      flash(e instanceof Error ? e.message : '操作失败', 'error')
    } finally {
      busy.value = false
      await refresh()
    }
  }

  /** 只拉起内核，不接管系统代理：打开节点列表 / 测速前调用 */
  async function ensureCore(): Promise<boolean> {
    const proxy = api()
    if (!proxy) return false
    if (running.value) return true
    busy.value = true
    try {
      const result = await proxy.startCore()
      if (!result.ok) {
        if (result.error) flash(result.error, 'error')
        return false
      }
      await loadGroups()
      return true
    } finally {
      busy.value = false
      await refresh()
    }
  }

  /** 整组测速，进度由 applyTestProgress 逐条吃进来 */
  async function testGroup(name: string): Promise<void> {
    const proxy = api()
    if (!proxy || !name) return
    const group = groups.value.find((g) => g.name === name)
    if (!group?.nodes.length) return

    testing.value = true
    testProgress.value = { tested: 0, total: group.nodes.length, done: false }
    try {
      await proxy.testGroup(name)
    } catch {
      /* 网络异常时保留已有结果 */
    } finally {
      testing.value = false
    }
  }

  function applyTestProgress(payload: ProxyTestProgress): void {
    const group = groups.value.find((g) => g.name === payload.group)
    const node = group?.nodes.find((n) => n.name === payload.node)
    if (node) {
      node.delay = payload.delay
      node.alive = payload.delay >= 0
    }
    testProgress.value = {
      tested: payload.tested,
      total: payload.total,
      done: payload.done
    }
    if (payload.done) {
      testing.value = false
      if (group) sortByDelay(group)
    }
  }

  /** 快的排前面，测不出（-1）的沉底 */
  function sortByDelay(group: ProxyGroup): void {
    group.nodes.sort((a, b) => {
      const da = a.delay > 0 ? a.delay : Number.MAX_SAFE_INTEGER
      const db = b.delay > 0 ? b.delay : Number.MAX_SAFE_INTEGER
      return da - db
    })
  }

  async function selectNode(group: string, node: string): Promise<void> {
    const proxy = api()
    if (!proxy) return
    busy.value = true
    try {
      const result = await proxy.select(group, node)
      if (!result.ok) flash(result.error ?? '切换失败', 'error')
      await loadGroups()
      await refresh()
    } finally {
      busy.value = false
    }
  }

  async function testDelay(node: string): Promise<number> {
    const proxy = api()
    if (!proxy) return -1
    const delay = await proxy.testDelay(node)
    const group = groups.value.find((g) => g.nodes.some((n) => n.name === node))
    const target = group?.nodes.find((n) => n.name === node)
    if (target) target.delay = delay
    return delay
  }

  async function setMode(mode: ProxyMode): Promise<void> {
    const proxy = api()
    if (!proxy) return
    const result = await proxy.setMode(mode)
    if (!result.ok) flash(result.error ?? '切换模式失败', 'error')
    await refresh()
  }

  async function patchSettings(patch: Partial<ProxySettings>): Promise<void> {
    const proxy = api()
    if (!proxy) return
    busy.value = true
    try {
      snapshot.value = await proxy.patchSettings(patch)
    } catch (e) {
      flash(e instanceof Error ? e.message : '保存失败', 'error')
    } finally {
      busy.value = false
    }
  }

  async function setSystemProxy(enabled: boolean): Promise<void> {
    const proxy = api()
    if (!proxy) return
    const result = await proxy.setSystemProxy(enabled)
    if (!result.ok && result.error) flash(result.error, 'error')
    await refresh()
  }

  async function setSubscription(url: string, name?: string): Promise<boolean> {
    const proxy = api()
    if (!proxy) return false
    busy.value = true
    try {
      const result = await proxy.setSubscription(url, name)
      if (!result.ok) {
        if (result.error && result.error !== '已取消') flash(result.error, 'error')
        return false
      }
      flash(`已导入${result.profile ? ` · ${result.profile.nodeCount} 个节点` : ''}`)
      await loadGroups()
      await refresh()
      return true
    } finally {
      busy.value = false
    }
  }

  async function switchProfile(id: string): Promise<void> {
    const proxy = api()
    if (!proxy || id === snapshot.value?.activeProfileId) return
    busy.value = true
    try {
      const result = await proxy.switchProfile(id)
      if (!result.ok) flash(result.error ?? '切换失败', 'error')
      await loadGroups()
      await refresh()
    } finally {
      busy.value = false
    }
  }

  async function removeProfile(id: string): Promise<void> {
    const proxy = api()
    if (!proxy) return
    busy.value = true
    try {
      const result = await proxy.removeProfile(id)
      if (!result.ok) flash(result.error ?? '删除失败', 'error')
      await refresh()
    } finally {
      busy.value = false
    }
  }

  async function renameProfile(id: string, name: string): Promise<void> {
    const proxy = api()
    if (!proxy || !name.trim()) return
    const result = await proxy.renameProfile(id, name.trim())
    if (!result.ok) flash(result.error ?? '重命名失败', 'error')
    await refresh()
  }

  async function importProfile(): Promise<void> {
    const proxy = api()
    if (!proxy) return
    busy.value = true
    try {
      const result = await proxy.importProfile()
      if (!result.ok) {
        if (result.error && result.error !== '已取消') flash(result.error, 'error')
        return
      }
      flash('配置已导入')
      await loadGroups()
      await refresh()
    } finally {
      busy.value = false
    }
  }

  async function updateSubscription(): Promise<void> {
    const proxy = api()
    if (!proxy) return
    busy.value = true
    try {
      const result = await proxy.updateSubscription()
      if (!result.ok) {
        if (result.error) flash(result.error, 'error')
        return
      }
      flash('订阅已刷新')
      await loadGroups()
      await refresh()
    } finally {
      busy.value = false
    }
  }

  return {
    snapshot,
    groups,
    busy,
    notice,
    noticeKind,
    testing,
    testProgress,
    running,
    connected,
    profiles,
    activeProfile,
    statusText,
    refresh,
    loadGroups,
    toggleProxy,
    ensureCore,
    testGroup,
    applyTestProgress,
    selectNode,
    testDelay,
    setMode,
    patchSettings,
    setSystemProxy,
    setSubscription,
    switchProfile,
    removeProfile,
    renameProfile,
    importProfile,
    updateSubscription,
    flash
  }
})

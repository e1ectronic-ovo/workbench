<template>
  <div class="home-panel px">
    <header class="px-head">
      <span class="px-dot" :class="dotTone" aria-hidden="true"></span>
      <span class="px-title">网络代理</span>
      <span class="px-status">{{ proxy.statusText }}</span>
      <button
        v-if="canRestart"
        type="button"
        class="px-restart"
        :class="{ 'is-spinning': restarting }"
        :disabled="restarting || proxy.busy"
        :title="restarting ? '正在重启内核…' : '重启内核'"
        aria-label="重启内核"
        @click="onRestart"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
      <button
        type="button"
        class="px-switch"
        role="switch"
        :aria-checked="proxy.connected"
        :aria-label="proxy.connected ? '取消接管系统代理' : '接管系统代理'"
        :class="{ 'is-on': proxy.connected }"
        :disabled="!canToggle || proxy.busy"
        :title="proxy.connected ? '取消接管系统代理' : '接管系统代理'"
        @click="proxy.toggleProxy()"
      >
        <span class="px-switch__knob" aria-hidden="true"></span>
      </button>
    </header>

    <!-- 失败原因与操作反馈：之前只写进状态，卡片上完全看不到 -->
    <p v-if="alertText" class="px-alert" :class="`is-${alertKind}`">{{ alertText }}</p>

    <!-- 内核缺失（安装包不完整时才会出现） -->
    <div v-if="snapshot && !snapshot.coreReady" class="px-empty">
      <p class="px-empty__text">未找到代理内核，安装包可能不完整。重新安装或更新到最新版本即可恢复。</p>
    </div>

    <!-- 没有配置 -->
    <div v-else-if="snapshot && !snapshot.activeProfileId" class="px-empty">
      <p class="px-empty__text">导入 Clash 订阅后，这里会显示节点与实时流量。</p>
      <div class="px-empty__row">
        <button type="button" class="px-btn px-btn--primary" @click="openSubscribe">导入订阅</button>
        <button type="button" class="px-btn" @click="proxy.importProfile()">本地文件</button>
      </div>
    </div>

    <template v-else-if="snapshot">
      <button
        type="button"
        class="px-node"
        :class="{ 'is-off': !proxy.running }"
        :disabled="proxy.busy"
        :title="proxy.running ? '切换节点 / 测速' : '打开节点列表'"
        @click="onNodeClick"
      >
        <span class="px-node__body">
          <span class="px-node__name">{{ nodeLabel }}</span>
          <span class="px-node__meta">{{ metaLine }}</span>
        </span>
        <span v-if="proxy.running && snapshot.activeDelay > 0" class="px-delay" :class="delayTone">
          {{ snapshot.activeDelay }}ms
        </span>
        <svg class="px-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>

      <p v-if="snapshot.status === 'starting'" class="px-hint">
        {{ slowStart ? '首次启动要下载 GeoIP 数据（约 4 MB），请稍候…' : '正在启动内核…' }}
      </p>
      <p v-else-if="proxy.running && !proxy.connected" class="px-hint">内核已就绪，系统流量还没走代理</p>

      <div class="px-rule"></div>

      <div class="px-traffic">
        <span class="px-stat"><i class="is-up">↑</i>{{ formatRate(snapshot.traffic.up) }}</span>
        <span class="px-stat"><i class="is-down">↓</i>{{ formatRate(snapshot.traffic.down) }}</span>
        <span class="px-conn">{{ snapshot.traffic.connections }} 连接</span>
      </div>

      <!-- 本次连接的累计消耗：只统计走代理节点的流量，连接结束后保留显示 -->
      <div v-if="proxy.running" class="px-session">
        <span>本次连接</span>
        <span class="px-session__total">
          ↑{{ formatTrafficSize(snapshot.traffic.sessionUp) }}
          ↓{{ formatTrafficSize(snapshot.traffic.sessionDown) }}
        </span>
      </div>

      <div v-if="subscriptionUsage" class="px-quota" :class="subscriptionTone">
        <div class="px-quota__top">
          <span class="px-quota__label">订阅流量</span>
          <strong class="px-quota__remaining">{{ subscriptionRemainingText }}</strong>
        </div>
        <div v-if="subscriptionUsage.total > 0" class="px-quota__track" aria-hidden="true">
          <span :style="{ width: `${subscriptionPercentValue}%` }"></span>
        </div>
        <div class="px-quota__meta">
          <span>{{ subscriptionMetaText }}</span>
          <span>{{ subscriptionExpiryText }}</span>
        </div>
      </div>

      <svg v-if="!sparkIdle" class="px-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="pxSparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.22" />
            <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <polygon :points="sparkArea" fill="url(#pxSparkFill)" />
        <polyline :points="sparkPoints" fill="none" stroke="var(--accent)" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      </svg>
      <div v-else class="px-spark-empty" aria-hidden="true">
        <span class="px-spark-empty__line"></span>
        <span class="px-spark-empty__text">暂无流量</span>
      </div>

      <footer class="px-foot">
        <div class="px-modes" role="group" aria-label="代理模式">
          <button
            v-for="m in modes"
            :key="m.id"
            type="button"
            class="px-modes__item"
            :class="{ 'is-on': snapshot.settings.mode === m.id }"
            :disabled="!proxy.running"
            @click="proxy.setMode(m.id)"
          >
            {{ m.label }}
          </button>
        </div>

        <div class="px-profile">
          <button type="button" class="px-profile__btn" :disabled="proxy.busy" @click="profileOpen = !profileOpen">
            {{ activeProfileName }}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <div v-if="profileOpen" class="px-pop" role="menu">
            <button
              v-for="p in proxy.profiles"
              :key="p.id"
              type="button"
              class="px-pop__item"
              :class="{ 'is-on': p.id === snapshot.activeProfileId }"
              @click="pickProfile(p.id)"
            >
              <span class="px-pop__name">{{ p.name }}</span>
              <span class="px-pop__sub">{{ profileItemMeta(p) }}</span>
              <svg v-if="p.id === snapshot.activeProfileId" class="px-pop__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </button>
            <div class="px-pop__rule"></div>
            <button type="button" class="px-pop__action" @click="openSubscribe">导入订阅…</button>
            <button type="button" class="px-pop__action" @click="importLocal">导入本地文件…</button>
          </div>
        </div>
      </footer>
    </template>

    <p v-else class="px-empty__text">正在读取代理状态…</p>
  </div>

  <!-- 节点选择 -->
  <Teleport to="body">
    <div v-if="nodesOpen" class="mac-sheet-backdrop" @click.self="nodesOpen = false">
      <div class="mac-sheet px-sheet">
        <header class="px-sheet__head">
          <div class="px-sheet__title-wrap">
            <h2 class="px-sheet__title">选择节点</h2>
            <p class="px-sheet__sub">{{ sheetSubtitle }}</p>
          </div>
          <div class="px-sheet__tools">
            <button
              type="button"
              class="px-test"
              :disabled="proxy.testing || !currentGroup"
              @click="testCurrentGroup"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
              {{ proxy.testing ? `${proxy.testProgress.tested}/${proxy.testProgress.total}` : '测速' }}
            </button>
            <button type="button" class="px-icon" aria-label="关闭" @click="nodesOpen = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </header>

        <div v-if="proxy.testing" class="px-bar" aria-hidden="true">
          <span :style="{ width: `${testPercent}%` }"></span>
        </div>

        <div v-if="selectableGroups.length > 1" class="px-tabs">
          <button
            v-for="g in selectableGroups"
            :key="g.name"
            type="button"
            class="px-tabs__item"
            :class="{ 'is-on': activeGroupName === g.name }"
            @click="switchGroup(g.name)"
          >
            {{ g.name }}
          </button>
        </div>

        <label class="px-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" />
          </svg>
          <input v-model="keyword" placeholder="搜索节点" spellcheck="false" />
        </label>

        <ul v-if="visibleNodes.length" class="px-list">
          <li v-for="node in visibleNodes" :key="node.name">
            <button
              type="button"
              class="px-item"
              :class="{ 'is-on': currentGroup?.now === node.name }"
              @click="pick(node.name)"
            >
              <span class="px-item__name">{{ node.name }}</span>
              <span
                class="px-delay px-item__delay"
                :class="delayClassOf(node.delay)"
                title="点击只测这个节点"
                @click.stop="proxy.testDelay(node.name)"
              >
                {{ node.delay > 0 ? `${node.delay}ms` : '—' }}
              </span>
            </button>
          </li>
        </ul>
        <p v-else class="px-list__empty">没有匹配的节点</p>
      </div>
    </div>
  </Teleport>

  <!-- 导入订阅 -->
  <Teleport to="body">
    <div v-if="subscribeOpen" class="mac-sheet-backdrop" @click.self="subscribeOpen = false">
      <form class="mac-sheet px-sub" @submit.prevent="submitSubscription">
        <h2 class="px-sub__title">导入订阅</h2>
        <p class="px-sub__hint">支持多份配置；导入后可随时在这里或其他配置之间切换。</p>

        <label class="px-field">
          <span>名称（可选，留空自动读取）</span>
          <input v-model="subscribeName" placeholder="自动使用订阅返回的名称" maxlength="24" />
        </label>
        <label class="px-field">
          <span>Clash 订阅地址</span>
          <input v-model="subscribeUrl" placeholder="https://…" spellcheck="false" />
        </label>

        <p v-if="subscribeError" class="px-sub__error">{{ subscribeError }}</p>

        <div class="px-sub__actions">
          <button type="button" class="px-btn" @click="subscribeOpen = false">取消</button>
          <button type="submit" class="px-btn px-btn--primary" :disabled="proxy.busy || !subscribeUrl.trim()">
            {{ proxy.busy ? '下载中…' : '导入' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ProxyMode, ProxyProfile, ProxySubscriptionUsage } from '../../../common/proxy'
import {
  formatSubscriptionExpiry,
  formatSubscriptionRemaining,
  formatTrafficSize,
  subscriptionPercent,
  subscriptionUsed
} from '../lib/proxy-format'
import { useProxyStore } from '../stores/proxy'

const proxy = useProxyStore()

const snapshot = computed(() => proxy.snapshot)
const samples = ref<number[]>([])
const nodesOpen = ref(false)
const activeGroupName = ref('')
const keyword = ref('')
const subscribeOpen = ref(false)
const subscribeUrl = ref('')
const subscribeName = ref('')
const subscribeError = ref('')
const slowStart = ref(false)
const restarting = ref(false)
const profileOpen = ref(false)

const modes: { id: ProxyMode; label: string }[] = [
  { id: 'rule', label: '规则' },
  { id: 'global', label: '全局' },
  { id: 'direct', label: '直连' }
]

const canToggle = computed(() => {
  const s = snapshot.value
  if (!s) return false
  if (s.status === 'starting') return false
  return s.coreReady && !!s.activeProfileId
})

/** 只要内核和配置都在就给重启入口：卡在异常/启动中时它才是唯一的自救手段 */
const canRestart = computed(() => {
  const s = snapshot.value
  if (!s) return false
  return s.coreReady && !!s.activeProfileId
})

const alertText = computed(() => proxy.notice || snapshot.value?.error || '')
const alertKind = computed(() => (proxy.notice ? proxy.noticeKind : 'error'))

async function onRestart(): Promise<void> {
  if (restarting.value) return
  restarting.value = true
  try {
    const ok = await proxy.restart()
    if (ok) proxy.flash('内核已重启')
  } finally {
    restarting.value = false
  }
}

const dotTone = computed(() => {
  const s = snapshot.value
  if (!s) return 'is-idle'
  if (s.status === 'error') return 'is-error'
  if (s.status === 'starting') return 'is-pending'
  if (s.systemProxy) return 'is-on'
  if (s.status === 'running') return 'is-ready'
  return 'is-idle'
})

const nodeLabel = computed(() => {
  const s = snapshot.value
  if (!s) return '—'
  if (s.status === 'starting') return '正在启动内核…'
  if (!s.running) return '打开节点列表'
  return s.activeNode || '未选择节点'
})

const metaLine = computed(() => {
  const s = snapshot.value
  if (!s) return ''
  if (s.status === 'starting') return '首次启动可能需要下载 GeoIP 数据'
  if (!s.running) return `${s.profile.nodeCount || 0} 个节点 · 点此测速`
  const group = s.activeGroup && s.activeGroup !== 'GLOBAL' ? s.activeGroup : '全局'
  return `${group} · ${s.nodeCount} 个节点`
})

const activeProfileName = computed(() => proxy.activeProfile?.name ?? '配置')

/** 弹层里每份配置的摘要：节点数 + 订阅流量剩余（有的话） */
function profileItemMeta(p: ProxyProfile): string {
  const usage = p.subscription?.usage
  const remaining = usage ? formatSubscriptionRemaining(usage) : ''
  return `${p.nodeCount} 节点${remaining ? ` · ${remaining}` : ''}`
}

const subscriptionUsage = computed<ProxySubscriptionUsage | null>(
  () => proxy.activeProfile?.subscription?.usage ?? null
)

const subscriptionRemainingText = computed(() => {
  const usage = subscriptionUsage.value
  return usage ? formatSubscriptionRemaining(usage) : ''
})

const subscriptionMetaText = computed(() => {
  const usage = subscriptionUsage.value
  if (!usage) return ''
  const used = `已用 ${formatTrafficSize(subscriptionUsed(usage))}`
  return usage.total > 0 ? `${used} / ${formatTrafficSize(usage.total)}` : used
})

const subscriptionExpiryText = computed(() => {
  const usage = subscriptionUsage.value
  return usage ? formatSubscriptionExpiry(usage.expire) : ''
})

const subscriptionPercentValue = computed(() => {
  const usage = subscriptionUsage.value
  return usage ? subscriptionPercent(usage) : 0
})

const subscriptionTone = computed(() => {
  if (subscriptionPercentValue.value >= 90) return 'is-danger'
  if (subscriptionPercentValue.value >= 70) return 'is-warn'
  return ''
})

const delayTone = computed(() => delayClassOf(snapshot.value?.activeDelay ?? -1))

const sparkPoints = computed(() => {
  const data = samples.value
  if (data.length < 2) return '0,28 100,28'
  const max = Math.max(...data, 1)
  const step = 100 / (data.length - 1)
  return data
    .map((v, i) => `${(i * step).toFixed(2)},${(28 - (v / max) * 25).toFixed(2)}`)
    .join(' ')
})

const sparkArea = computed(() => `${sparkPoints.value} 100,28 0,28`)
const sparkIdle = computed(() => !samples.value.some((v) => v > 0))

const selectableGroups = computed(() =>
  proxy.groups.filter((g) => g.selectable && g.name !== 'GLOBAL' && g.nodes.length > 0)
)

const currentGroup = computed(() => {
  const name = activeGroupName.value || snapshot.value?.activeGroup
  return proxy.groups.find((g) => g.name === name) ?? selectableGroups.value[0] ?? null
})

const visibleNodes = computed(() => {
  const list = currentGroup.value?.nodes ?? []
  const q = keyword.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((n) => n.name.toLowerCase().includes(q))
})

const sheetSubtitle = computed(() => {
  const group = currentGroup.value
  if (!group) return '加载中…'
  const tested = group.nodes.filter((n) => n.delay > 0).length
  return tested ? `${group.nodes.length} 个节点 · ${tested} 个已测速` : `${group.nodes.length} 个节点 · 未测速`
})

const testPercent = computed(() => {
  const { tested, total } = proxy.testProgress
  if (!total) return 0
  return Math.min(100, Math.round((tested / total) * 100))
})

watch(
  () => snapshot.value?.status,
  (status) => {
    slowStart.value = false
    if (status !== 'starting') return
    const at = Date.now()
    window.setTimeout(() => {
      if (snapshot.value?.status === 'starting' && Date.now() - at >= 9000) slowStart.value = true
    }, 9000)
  }
)

watch(nodesOpen, async (open) => {
  if (!open) return
  keyword.value = ''
  await proxy.loadGroups()
  activeGroupName.value = snapshot.value?.activeGroup || selectableGroups.value[0]?.name || ''
})

function onDocPointerDown(e: PointerEvent): void {
  const el = e.target as HTMLElement | null
  if (el?.closest('.px-profile')) return
  profileOpen.value = false
}

watch(profileOpen, (open) => {
  if (open) {
    void proxy.refresh()
    document.addEventListener('pointerdown', onDocPointerDown, true)
  } else {
    document.removeEventListener('pointerdown', onDocPointerDown, true)
  }
})

function delayClassOf(delay: number): string {
  if (delay <= 0) return 'is-unknown'
  if (delay < 200) return 'is-good'
  if (delay < 500) return 'is-mid'
  return 'is-slow'
}

function formatRate(bytes: number): string {
  if (!bytes) return '0 B/s'
  if (bytes < 1024) return `${bytes} B/s`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB/s`
}

async function onNodeClick(): Promise<void> {
  if (!proxy.running) {
    const ok = await proxy.ensureCore()
    if (!ok) return
  }
  nodesOpen.value = true
}

function switchGroup(name: string): void {
  activeGroupName.value = name
}

function testCurrentGroup(): void {
  const group = currentGroup.value
  if (!group) return
  void proxy.testGroup(group.name)
}

async function pick(name: string): Promise<void> {
  const group = currentGroup.value
  if (!group) return
  await proxy.selectNode(group.name, name)
  nodesOpen.value = false
}

async function pickProfile(id: string): Promise<void> {
  profileOpen.value = false
  await proxy.switchProfile(id)
}

function openSubscribe(): void {
  profileOpen.value = false
  subscribeName.value = ''
  subscribeError.value = ''
  subscribeOpen.value = true
}

async function importLocal(): Promise<void> {
  profileOpen.value = false
  await proxy.importProfile()
}

async function submitSubscription(): Promise<void> {
  subscribeError.value = ''
  const ok = await proxy.setSubscription(subscribeUrl.value, subscribeName.value.trim() || undefined)
  if (!ok) {
    subscribeError.value = proxy.notice || '导入失败'
    return
  }
  subscribeOpen.value = false
  subscribeUrl.value = ''
  if (!proxy.connected) await proxy.toggleProxy(true)
}

let timer: number | undefined
let offState: (() => void) | undefined
let offTest: (() => void) | undefined

function tick(): void {
  if (document.visibilityState !== 'visible') return
  void refreshSample()
}

async function refreshSample(): Promise<void> {
  await proxy.refresh()
  const traffic = proxy.snapshot?.traffic
  const down = traffic?.down ?? 0
  const hasConnections = (traffic?.connections ?? 0) > 0
  if (proxy.running && (down > 0 || hasConnections)) {
    samples.value = [...samples.value, down].slice(-32)
  } else if (samples.value.length) {
    // 内核停了、或所有代理连接都已结束：清掉旧曲线，回到「暂无流量」占位
    samples.value = []
  }
}

onMounted(async () => {
  await proxy.refresh()
  offState = window.workbench?.proxy?.onState(() => {
    void proxy.refresh()
  })
  offTest = window.workbench?.proxy?.onTestProgress((payload) => {
    proxy.applyTestProgress(payload)
  })
  timer = window.setInterval(tick, 1500)
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  offState?.()
  offTest?.()
})
</script>

<style scoped>
.px {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ── 头部 ── */
.px-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.px-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
  transition: background var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
}

.px-dot.is-on {
  background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 20%, transparent);
}

.px-dot.is-ready {
  background: var(--accent);
}

.px-dot.is-pending {
  background: var(--warning);
  animation: px-pulse 1s ease-in-out infinite;
}

.px-dot.is-error {
  background: var(--destructive);
}

@keyframes px-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.px-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.01em;
}

.px-status {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-right: auto;
}

.px-switch {
  width: 34px;
  height: 20px;
  padding: 2px;
  border-radius: 999px;
  background: var(--fill-tertiary);
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  transition: background var(--dur) var(--ease);
}

/* 重启内核：只在头部露一个小图标，不抢开关的注意力 */
.px-restart {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  flex-shrink: 0;
  color: var(--text-muted);
  transition: color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}

.px-restart:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text);
}

.px-restart:disabled {
  opacity: 0.45;
}

.px-restart svg {
  width: 13px;
  height: 13px;
}

.px-restart.is-spinning {
  color: var(--accent);
  opacity: 1;
}

.px-restart.is-spinning svg {
  animation: px-spin 0.9s linear infinite;
}

@keyframes px-spin {
  to { transform: rotate(360deg); }
}

/* 失败原因 / 操作反馈 */
.px-alert {
  margin: -4px 0 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  line-height: 1.5;
  word-break: break-word;
  background: color-mix(in srgb, var(--destructive) 12%, transparent);
  color: var(--destructive);
}

.px-alert.is-ok {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
}

.px-switch.is-on {
  background: var(--success);
}

.px-switch:disabled {
  opacity: 0.42;
}

.px-switch__knob {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.22);
  transition: transform var(--dur) var(--ease);
}

.px-switch.is-on .px-switch__knob {
  transform: translateX(14px);
}

/* ── 节点块 ── */
.px-node {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  margin: 0 -2px;
  border-radius: var(--radius-md);
  text-align: left;
  transition: background var(--dur-fast) var(--ease);
}

.px-node:hover:not(:disabled) {
  background: var(--surface-hover);
}

.px-node:disabled {
  cursor: default;
}

.px-node__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.px-node__name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: -0.015em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.px-node.is-off .px-node__name {
  color: var(--text-secondary);
}

.px-node__meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.px-chevron {
  width: 14px;
  height: 14px;
  color: var(--text-muted);
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity var(--dur-fast) var(--ease), transform var(--dur-fast) var(--ease);
}

.px-node:hover .px-chevron {
  opacity: 1;
  transform: translateX(1px);
}

.px-delay {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  padding: 2px 6px;
  border-radius: 999px;
  flex-shrink: 0;
  background: var(--fill-tertiary);
  color: var(--text-secondary);
}

.px-delay.is-good {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 14%, transparent);
}

.px-delay.is-mid {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 16%, transparent);
}

.px-delay.is-slow {
  color: var(--destructive);
  background: color-mix(in srgb, var(--destructive) 13%, transparent);
}

.px-delay.is-unknown {
  color: var(--text-muted);
  background: transparent;
  padding-left: 0;
  padding-right: 0;
}

.px-hint {
  margin: 4px 0 0;
  padding-left: 8px;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--text-muted);
}

.px-rule {
  height: 1px;
  background: var(--border);
  margin: 10px -2px;
  opacity: 0.8;
}

/* ── 流量 ── */
.px-traffic {
  display: flex;
  align-items: baseline;
  gap: 14px;
}

.px-stat {
  font-size: var(--text-sm);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text);
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
}

.px-stat i {
  font-style: normal;
  font-size: 11px;
  opacity: 0.75;
}

.px-stat i.is-up {
  color: var(--accent-warm);
}

.px-stat i.is-down {
  color: var(--accent);
}

.px-conn {
  margin-left: auto;
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.px-session {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-top: 5px;
  font-size: 10px;
  color: var(--text-muted);
}

.px-session__total {
  font-variant-numeric: tabular-nums;
}

.px-quota {
  margin-top: 9px;
  padding: 7px 9px 6px;
  border-radius: 8px;
  background: var(--fill-tertiary);
}

.px-quota__top,
.px-quota__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.px-quota__label,
.px-quota__meta {
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.px-quota__remaining {
  font-size: var(--text-xs);
  font-weight: 650;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.px-quota__track {
  height: 3px;
  margin: 6px 0 5px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--border-strong);
}

.px-quota__track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width var(--dur) var(--ease), background var(--dur) var(--ease);
}

.px-quota.is-warn .px-quota__track span {
  background: var(--warning);
}

.px-quota.is-danger .px-quota__track span {
  background: var(--destructive);
}

.px-quota.is-warn .px-quota__remaining {
  color: var(--warning);
}

.px-quota.is-danger .px-quota__remaining {
  color: var(--destructive);
}

.px-spark {
  width: 100%;
  flex: 1 1 auto;
  min-height: 30px;
  margin-top: 6px;
  display: block;
}

.px-spark-empty {
  flex: 1 1 auto;
  min-height: 30px;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.px-spark-empty__line {
  width: 62%;
  height: 1px;
  background: repeating-linear-gradient(
    90deg,
    var(--border-strong) 0 5px,
    transparent 5px 10px
  );
  opacity: 0.9;
}

.px-spark-empty__text {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}

/* ── 底部 ── */
.px-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
}

.px-modes {
  display: inline-flex;
  gap: 2px;
}

.px-modes__item {
  font-size: var(--text-xs);
  color: var(--text-muted);
  padding: 3px 8px;
  border-radius: 6px;
  transition: color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}

.px-modes__item:hover:not(:disabled) {
  color: var(--text);
  background: var(--surface-hover);
}

.px-modes__item.is-on {
  color: var(--text);
  font-weight: 600;
  background: var(--fill-tertiary);
}

.px-modes__item:disabled {
  opacity: 0.4;
}

.px-profile {
  position: relative;
  flex-shrink: 0;
}

.px-profile__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 120px;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  padding: 3px 6px;
  border-radius: 6px;
  transition: color var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}

.px-profile__btn:hover:not(:disabled) {
  color: var(--text);
  background: var(--surface-hover);
}

.px-profile__btn svg {
  width: 11px;
  height: 11px;
  opacity: 0.6;
  flex-shrink: 0;
}

.px-pop {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 22;
  width: 190px;
  padding: 4px;
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  animation: px-pop-in 140ms var(--ease);
}

@keyframes px-pop-in {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: none; }
}

.px-pop__item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  text-align: left;
}

.px-pop__item:hover {
  background: var(--surface-hover);
}

.px-pop__name {
  font-size: var(--text-sm);
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.px-pop__sub {
  margin-left: auto;
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.px-pop__item.is-on .px-pop__name {
  font-weight: 600;
}

.px-pop__check {
  width: 12px;
  height: 12px;
  color: var(--accent);
  flex-shrink: 0;
}

.px-pop__rule {
  height: 1px;
  background: var(--border);
  margin: 4px 2px;
}

.px-pop__action {
  display: block;
  width: 100%;
  text-align: left;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  padding: 6px 8px;
  border-radius: 6px;
}

.px-pop__action:hover {
  background: var(--surface-hover);
  color: var(--text);
}

/* ── 空状态 ── */
.px-empty {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 0;
}

.px-empty__text {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--text-muted);
}

.px-empty__row {
  display: flex;
  gap: 6px;
}

.px-path {
  display: block;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  background: var(--fill-tertiary);
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.4;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.px-btn {
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text);
  background: var(--fill-tertiary);
  transition: filter var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}

.px-btn:hover:not(:disabled) {
  background: var(--surface-hover);
}

.px-btn--primary {
  background: var(--accent);
  color: var(--on-accent);
}

.px-btn--primary:hover:not(:disabled) {
  filter: brightness(1.06);
  background: var(--accent);
}

.px-btn:disabled {
  opacity: 0.45;
}

/* ── 节点弹层 ── */
.px-sheet {
  width: min(430px, 100%);
  max-height: min(80vh, 580px);
  display: flex;
  flex-direction: column;
  padding: var(--space-4);
}

.px-sheet__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.px-sheet__title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: 600;
  letter-spacing: -0.01em;
}

.px-sheet__sub {
  margin: 2px 0 0;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.px-sheet__tools {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.px-test {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  font-variant-numeric: tabular-nums;
  transition: filter var(--dur-fast) var(--ease);
}

.px-test:hover:not(:disabled) {
  filter: brightness(0.97);
}

.px-test:disabled {
  opacity: 0.6;
}

.px-test svg {
  width: 12px;
  height: 12px;
}

.px-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  color: var(--text-muted);
}

.px-icon:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.px-icon svg {
  width: 14px;
  height: 14px;
}

.px-bar {
  height: 2px;
  border-radius: 2px;
  background: var(--fill-tertiary);
  overflow: hidden;
  margin-bottom: var(--space-3);
}

.px-bar span {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 130ms linear;
}

.px-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.px-tabs::-webkit-scrollbar {
  display: none;
}

.px-tabs__item {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  background: var(--fill-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
}

.px-tabs__item.is-on {
  background: var(--accent);
  color: var(--on-accent);
  font-weight: 600;
}

.px-search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 9px;
  margin-bottom: 6px;
  border-radius: 7px;
  background: var(--fill-tertiary);
  color: var(--text-muted);
}

.px-search svg {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.px-search input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: 0;
  font-size: var(--text-sm);
  color: var(--text);
}

.px-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.px-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px 7px 10px;
  border-radius: 6px;
  text-align: left;
}

.px-item:hover {
  background: var(--surface-hover);
}

.px-item.is-on {
  background: var(--accent-soft);
}

.px-item.is-on::before {
  content: '';
  position: absolute;
  left: 3px;
  top: 8px;
  bottom: 8px;
  width: 2px;
  border-radius: 2px;
  background: var(--accent);
}

.px-item__name {
  flex: 1;
  min-width: 0;
  font-size: var(--text-sm);
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.px-item.is-on .px-item__name {
  font-weight: 600;
}

.px-item__delay {
  cursor: pointer;
}

.px-item__delay:hover {
  filter: brightness(0.96);
}

.px-list__empty {
  margin: 24px 0;
  text-align: center;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* ── 订阅弹层 ── */
.px-sub {
  width: min(390px, 100%);
}

.px-sub__title {
  margin: 0 0 4px;
  font-size: var(--text-lg);
  font-weight: 600;
}

.px-sub__hint {
  margin: 0 0 var(--space-3);
  font-size: var(--text-xs);
  line-height: 1.5;
  color: var(--text-muted);
}

.px-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 10px;
}

.px-field span {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.px-field input {
  height: 30px;
  padding: 0 9px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--bg);
  font-size: var(--text-sm);
  transition: border-color var(--dur-fast) var(--ease);
}

.px-field input:focus {
  border-color: var(--border-focus);
}

.px-sub__error {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--destructive);
}

.px-sub__actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: var(--space-4);
}
</style>

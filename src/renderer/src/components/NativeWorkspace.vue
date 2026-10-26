<template>
  <section class="native-workspace">
    <header class="native-toolbar">
      <div class="native-status">
        <span class="native-dot" :class="{ 'is-on': embedded, 'is-busy': busy, 'is-error': !!error }" />
        <div class="native-status__text">
          <strong>{{ module.name }}</strong>
          <span>{{ statusText }}</span>
        </div>
      </div>

      <div class="native-actions">
        <button
          v-if="native?.executablePath"
          type="button"
          class="native-btn native-btn--primary"
          :disabled="busy || !supported"
          @click="launchApp"
        >
          {{ busy ? '启动中…' : embedded ? '重新启动' : '启动并嵌入' }}
        </button>
        <button
          v-else
          type="button"
          class="native-btn native-btn--primary"
          :disabled="busy || !supported || (!native?.processName && !isAndroidApp)"
          @click="mountExisting"
        >
          {{ busy ? '查找中…' : embedded ? '重新嵌入' : '查找并嵌入' }}
        </button>
        <button
          type="button"
          class="native-btn"
          :disabled="busy || !embedded"
          @click="detach"
        >
          解除嵌入
        </button>
      </div>
    </header>

    <div ref="stage" class="native-stage">
      <div v-if="!embedded" class="native-empty">
        <div class="native-empty__icon">▣</div>
        <h2>{{ emptyTitle }}</h2>
        <p v-if="error" class="native-empty__error">{{ error }}</p>
        <p v-else>{{ emptyHint }}</p>
        <button
          v-if="native?.executablePath && !busy && supported"
          type="button"
          class="native-btn native-btn--primary"
          @click="launchApp"
        >
          启动模拟器并嵌入
        </button>
        <button
          v-else-if="native?.processName && !busy && supported"
          type="button"
          class="native-btn native-btn--primary"
          @click="mountExisting"
        >
          查找并嵌入
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ModuleConfig } from '../modules/registry'
import type {
  AndroidMountPayload,
  AndroidStatus,
  AndroidWindowInfo
} from '../types/global'

const props = defineProps<{
  module: ModuleConfig
  active: boolean
}>()

const stage = ref<HTMLElement | null>(null)
const busy = ref(false)
const error = ref('')
const status = ref<AndroidStatus | null>(null)
const embedded = computed(
  () => props.active && status.value?.embedded === true && !error.value
)

const native = computed(() => props.module.native)

/**
 * 原生窗口托管只有 WPF 外壳提供。Electron 壳没有可用的 HWND 托管通道，
 * 这里必须整体降级成提示态，而不是让组件在挂载期直接抛异常。
 */
const bridge = window.workbench?.android
const supported = !!bridge
const UNSUPPORTED = '当前外壳不支持原生窗口嵌入。请使用 WPF 外壳（desktop/）启动鲸汐后再试。'

const statusText = computed(() => {
  if (!supported) return '当前外壳不支持原生嵌入'
  if (!props.active) return '已停用'
  if (busy.value) return '正在连接原生窗口…'
  if (error.value) return error.value
  if (embedded.value) {
    const processName = status.value?.processName || native.value?.processName || ''
    const title = status.value?.title?.trim()
    return title ? `${processName} · ${title}` : `${processName} · 已嵌入`
  }
  return native.value?.processName ? '等待嵌入' : '未配置窗口'
})

let resizeObserver: ResizeObserver | null = null
let resizeFrame = 0
let offStatus: (() => void) | undefined
let mountVersion = 0
let mounted = false
let detachRequested = false

/** 内置引擎的窗口进程名：模块没显式配 processName 时由 launchApp 回填。 */
const engineProcess = ref('')
const isAndroidApp = computed(
  () => props.module.native?.mode === 'android' && !!props.module.native?.androidPackage
)

const emptyTitle = computed(() => {
  if (isAndroidApp.value) return '安卓应用尚未启动'
  return native.value?.processName ? '原生窗口尚未嵌入' : '还没有绑定原生应用'
})

const emptyHint = computed(() => {
  if (isAndroidApp.value) {
    return '进入这个模块会自动启动引擎并打开应用；首次开机需要 1–3 分钟。'
  }
  if (!native.value?.processName) {
    return '请到「设置 → 网站」编辑这个模块，选择模拟器或目标应用窗口。'
  }
  return '鲸汐会把这个进程的原生窗口放进当前区域；不是在截图，也不是视频投屏。'
})

function measure(): Pick<AndroidMountPayload, 'x' | 'y' | 'width' | 'height'> | null {
  const el = stage.value
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width < 2 || rect.height < 2) return null
  return {
    x: Math.max(0, rect.left),
    y: Math.max(0, rect.top),
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height)
  }
}

function mountPayload(): AndroidMountPayload | null {
  const config = native.value
  const rect = measure()
  const processName = config?.processName?.trim() || engineProcess.value
  if (!processName || !rect) return null
  return {
    processName,
    title: config.windowTitle,
    className: config.className,
    ...rect
  }
}

async function mountExisting() {
  if (!bridge) {
    error.value = UNSUPPORTED
    return
  }
  const payload = mountPayload()
  if (!payload) {
    error.value = native.value?.processName
      ? '内容区域尺寸无效，请稍后重试'
      : '请先在设置中为这个模块选择原生窗口'
    return
  }

  const version = ++mountVersion
  busy.value = true
  error.value = ''
  detachRequested = false
  try {
    const result = await bridge.mount(payload)
    if (version === mountVersion && props.active) status.value = result
  } catch (cause) {
    if (version === mountVersion) {
      status.value = null
      error.value = messageOf(cause)
    }
  } finally {
    if (version === mountVersion) busy.value = false
  }
}

async function launchApp() {
  if (!bridge) {
    error.value = UNSUPPORTED
    return
  }
  const payload = mountPayload()
  if (!payload) {
    error.value = '请先在设置中配置目标进程和启动程序'
    return
  }
  if (!native.value?.executablePath) {
    error.value = '没有配置模拟器或应用的可执行文件'
    return
  }

  const version = ++mountVersion
  busy.value = true
  error.value = ''
  detachRequested = false
  try {
    const result = await bridge.launch({
      ...payload,
      executablePath: native.value.executablePath,
      arguments: native.value.arguments
    })
    if (version === mountVersion && props.active) status.value = result
  } catch (cause) {
    if (version === mountVersion) {
      status.value = null
      error.value = messageOf(cause)
    }
  } finally {
    if (version === mountVersion) busy.value = false
  }
}

async function activate() {
  error.value = ''
  await nextTick()
  if (!props.active || !mounted) return
  if (!supported) {
    error.value = UNSUPPORTED
    return
  }
  if (detachRequested) {
    detachRequested = false
  }

  // 绑定的是内置引擎里的应用：先把包拉起来（会顺带启动引擎并开机），再托管它的窗口
  if (isAndroidApp.value) {
    await ensureAndroidAppRunning()
  }

  if (native.value?.launchOnOpen && native.value.executablePath) {
    await launchApp()
  } else {
    await mountExisting()
  }
}

async function ensureAndroidAppRunning() {
  const pkg = native.value?.androidPackage
  if (!pkg || !bridge) return

  const version = ++mountVersion
  busy.value = true
  try {
    const launched = await bridge.launchApp(pkg)
    if (launched?.windowProcess) {
      engineProcess.value = launched.windowProcess
    }
  } catch (cause) {
    if (version === mountVersion) {
      error.value = messageOf(cause)
    }
  } finally {
    if (version === mountVersion) busy.value = false
  }
}

async function deactivate() {
  ++mountVersion
  busy.value = false
  if (!bridge) return
  try {
    status.value = await bridge.deactivate()
  } catch {
    status.value = null
  }
}

async function detach() {
  mountVersion++
  detachRequested = true
  error.value = ''
  if (!bridge) return
  try {
    status.value = await bridge.detach()
  } catch (cause) {
    error.value = messageOf(cause)
  }
}

async function syncBounds() {
  if (!bridge || !props.active || !mounted || !status.value?.embedded) return
  const rect = measure()
  if (!rect) return
  try {
    await bridge.updateBounds(rect)
  } catch {
    /* The target may have closed while resizing. The next mount reports it. */
  }
}

function scheduleBoundsSync() {
  if (!props.active || resizeFrame) return
  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = 0
    void syncBounds()
  })
}

function onWindowResize() {
  scheduleBoundsSync()
}

function applyStatus(next: AndroidStatus) {
  if (!props.active) return
  const expected = native.value?.processName?.toLowerCase()
  const actual = next.processName?.toLowerCase()
  if (next.embedded && expected && actual && expected !== actual) return
  status.value = next
  if (next.embedded) error.value = ''
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : '原生窗口操作失败'
}

watch(
  () => props.active,
  (active) => {
    if (active) void activate()
    else void deactivate()
  },
  { immediate: true }
)

watch(
  () => [
    props.module.native?.processName,
    props.module.native?.windowTitle,
    props.module.native?.className,
    props.module.native?.executablePath,
    props.module.native?.arguments,
    props.module.native?.launchOnOpen
  ],
  () => {
    if (props.active && mounted) {
      detachRequested = false
      void activate()
    }
  }
)

onMounted(async () => {
  mounted = true
  offStatus = bridge?.onStatus(applyStatus)
  window.addEventListener('resize', onWindowResize)
  if (stage.value) {
    resizeObserver = new ResizeObserver(scheduleBoundsSync)
    resizeObserver.observe(stage.value)
  }
  if (props.active) void activate()
})

onBeforeUnmount(() => {
  mounted = false
  ++mountVersion
  offStatus?.()
  window.removeEventListener('resize', onWindowResize)
  resizeObserver?.disconnect()
  if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
  void bridge?.deactivate().catch(() => undefined)
})

// 防止脚本被当作未使用变量裁剪：这些类型也用于约束 IPC 返回结构。
void (null as AndroidWindowInfo | null)
</script>

<style scoped>
.native-workspace {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--bg);
}

.native-toolbar {
  height: 46px;
  flex: 0 0 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--border);
  background: var(--surface-secondary);
}

.native-status {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.native-status__text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.native-status__text strong {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
}

.native-status__text span {
  max-width: min(54vw, 640px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  font-size: var(--text-xs);
}

.native-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--text-muted);
}

.native-dot.is-on {
  background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 20%, transparent);
}

.native-dot.is-busy {
  background: var(--warning);
  animation: native-pulse 1s ease-in-out infinite;
}

.native-dot.is-error {
  background: var(--destructive);
}

@keyframes native-pulse {
  50% { opacity: 0.35; }
}

.native-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.native-btn {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
}

.native-btn:hover:not(:disabled) {
  border-color: var(--border-strong);
  color: var(--text);
}

.native-btn--primary {
  border-color: transparent;
  background: var(--accent);
  color: var(--accent-contrast, #041a17);
  font-weight: 600;
}

.native-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.native-stage {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 44%),
    var(--bg);
}

.native-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  text-align: center;
}

.native-empty__icon {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  margin-bottom: var(--space-4);
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface-secondary);
  color: var(--accent);
  font-size: 24px;
}

.native-empty h2 {
  margin: 0;
  color: var(--text);
  font-size: 17px;
  font-weight: 600;
}

.native-empty p {
  max-width: 440px;
  margin: var(--space-2) 0 var(--space-4);
  color: var(--text-muted);
  font-size: var(--text-sm);
  line-height: 1.65;
}

.native-empty__error {
  color: var(--destructive) !important;
  user-select: text;
}
</style>

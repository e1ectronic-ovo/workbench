<template>
  <section class="workspace">
    <header class="mac-toolbar workspace-toolbar">
      <div class="mac-toolbar__cluster">
        <button v-if="!isBuiltin" type="button" class="mac-icon-btn" @click="back" :disabled="!canBack" title="后退">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <button v-if="!isBuiltin" type="button" class="mac-icon-btn" @click="forward" :disabled="!canForward" title="前进">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
        </button>
        <button type="button" class="mac-icon-btn" @click="goHome" :title="isBuiltin ? '重新开始' : `回到首页 (${props.module.url})`">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 11.2 12 4.5l8 6.7" /><path d="M7 10.5V19h10v-8.5" />
          </svg>
        </button>
        <button
          v-if="!isBuiltin && !isWebView2"
          type="button"
          class="mac-icon-btn lights-toggle"
          :class="{ on: lightsOff }"
          :title="lightsOff ? '开灯（恢复网页原主题）' : '关灯（网页切换为深色主题）'"
          :aria-pressed="lightsOff"
          aria-label="开关灯"
          @click="toggleLights"
        >
          <svg
            v-if="!lightsOff"
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 18h6" /><path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V19h6v-2.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
            <path d="M12 6v3" />
            <path d="M3.5 8.5h-1" /><path d="M21.5 8.5h-1" />
            <path d="m5.2 3.7-.7-.7" /><path d="m18.8 3.7.7-.7" />
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 18h6" /><path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V19h6v-2.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" />
            <path d="M12 6v3" /><path d="m4 4 16 16" />
          </svg>
        </button>
        <button
          v-if="isWebView2 && !isBuiltin"
          type="button"
          class="mac-icon-btn"
          title="在系统浏览器中打开（iframe 被站点拒绝内嵌时用这个）"
          @click="openInBrowser"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
          </svg>
        </button>
      </div>
      <button
        v-if="!isBuiltin"
        type="button"
        class="mac-icon-btn url-toggle"
        :class="{ on: urlBarOpen }"
        @click="toggleUrlBar"
        title="地址栏 (Ctrl+L)"
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </button>
    </header>

    <div v-if="!isBuiltin" class="tabbar" role="tablist" aria-label="页面标签">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="tab"
        :class="{ active: tab.id === activeTabId, loading: tab.loading }"
        role="tab"
        :aria-selected="tab.id === activeTabId"
        @click="selectTab(tab.id)"
      >
        <span class="tab__label">{{ tabLabel(tab) }}</span>

        <span class="tab__actions">
          <button
            v-if="tab.audible || tab.muted"
            type="button"
            class="tab__btn"
            :class="{ 'is-on': tab.audible && !tab.muted, 'is-muted': tab.muted }"
            :title="tab.muted ? '取消静音' : '静音此标签'"
            :aria-label="tab.muted ? '取消静音' : '静音此标签'"
            @click.stop="toggleMute(tab.id)"
          >
            <svg v-if="tab.muted" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5 6 9H3v6h3l5 4V5z" />
              <path d="m17 9 4 5M21 9l-4 5" />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5 6 9H3v6h3l5 4V5z" />
              <path d="M16 9a4 4 0 0 1 0 6" />
            </svg>
          </button>

          <button
            v-if="tab.id === activeTabId"
            type="button"
            class="tab__btn"
            :class="{ 'is-on': tab.loading }"
            :title="tab.loading ? '停止加载' : '刷新此标签 (Ctrl+R)'"
            :aria-label="tab.loading ? '停止加载' : '刷新此标签'"
            @click.stop="reloadTab(tab.id)"
          >
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              :class="{ 'is-spin': tab.loading }"
            >
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" />
            </svg>
          </button>

          <button
            v-if="tabs.length > 1"
            type="button"
            class="tab__close"
            title="关闭标签"
            aria-label="关闭标签"
            @click.stop="closeTab(tab.id)"
          >
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </span>
      </button>
    </div>

    <Transition name="urlbar">
      <form v-if="urlBarOpen" class="urlbar" @submit.prevent="onSubmit">
        <input
          ref="urlInput"
          v-model="draft"
          class="url-input"
          type="text"
          :placeholder="placeholder"
          spellcheck="false"
          autocomplete="off"
        />
        <button type="submit" class="go" :disabled="!draft.trim()">跳转</button>
      </form>
    </Transition>

    <div class="viewport">
      <!-- Electron 外壳：用 <webview> 拿到完整导航/静音能力 -->
      <template v-if="!isWebView2">
        <webview
          v-for="tab in tabs"
          :key="tab.id"
          :ref="(el) => setWebviewRef(tab.id, el as HTMLElement | null)"
          v-show="tab.id === activeTabId"
          :src="tab.bootUrl"
          :partition="partition"
          :useragent="useragent"
          allowpopups
          class="wv"
        />
      </template>

      <!-- WPF 外壳：WebView2 不支持 <webview> 标签，降级成 iframe -->
      <template v-else>
        <iframe
          v-for="tab in tabs"
          :key="frameKey(tab.id)"
          v-show="tab.id === activeTabId"
          :src="tab.url"
          :title="tabLabel(tab)"
          class="wv"
          referrerpolicy="no-referrer"
          allow="clipboard-read; clipboard-write; fullscreen; autoplay; encrypted-media"
          @load="onFrameLoad(tab.id)"
        />
      </template>

      <Transition name="bar">
        <div v-if="activeTab?.loading" class="loading-bar">
          <div class="loading-fill" />
        </div>
      </Transition>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { GUEST_PARTITION, GUEST_USER_AGENT } from '../../../common/guest-session'
import { createPageTab, tabLabel as formatTabLabel, type PageTab } from '../lib/page-tabs'
import { isBuiltinModule, shouldBlockIme, type ModuleConfig } from '../modules/registry'
import { normalize, useModulesStore } from '../stores/modules'

/** <webview> 元素暴露的运行时方法（Electron.WebviewTag 在 renderer 里不可见，这里局部声明用到的子集）。 */
interface WebviewEl extends HTMLElement {
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
  reload(): void
  stop(): void
  loadURL(url: string): Promise<void>
  isLoadingMainFrame?(): boolean
  isCurrentlyAudible?(): boolean
  setAudioMuted?(muted: boolean): void
  /** <webview> 挂上访客进程后才能取到；导航过程中可能抛错 */
  getWebContentsId(): number
}

const props = defineProps<{
  module: ModuleConfig
  /** 该模块是否为当前可见模块（多模块常驻时用于隔离快捷键与状态同步） */
  active: boolean
}>()

const store = useModulesStore()

/**
 * 内置应用（resources/apps 里的本地页面，走 wbapp:// 协议）：
 * 只有一页、没有站外导航，工具栏退化成「重新开始 / 刷新」，标签栏与地址栏都不需要。
 */
const isBuiltin = computed(() => isBuiltinModule(props.module))

/**
 * WPF 外壳（WebView2）不支持 Electron 的 <webview> 标签，这里降级成 iframe。
 * 代价：站点可以拒绝被内嵌，且拿不到标题/前进后退——工具栏会相应禁用并提供「用浏览器打开」。
 */
const isWebView2 = window.workbench?.impl === 'webview2'
const frameNonces = ref<Record<string, number>>({})

function frameKey(tabId: string): string {
  return `${tabId}#${frameNonces.value[tabId] ?? 0}`
}

/** 强制重挂 iframe，实现刷新 */
function bumpFrame(tabId: string): void {
  frameNonces.value = { ...frameNonces.value, [tabId]: (frameNonces.value[tabId] ?? 0) + 1 }
}

function onFrameLoad(tabId: string): void {
  patchTab(tabId, { loading: false })
  if (tabId === activeTabId.value) syncModuleState()
}

function openInBrowser(): void {
  const url = activeTab.value?.url
  if (url) void window.workbench?.openExternal(url)
}

const homeUrl = store.states[props.module.id]?.url || props.module.url
const tabs = ref<PageTab[]>([createPageTab(homeUrl, props.module.name)])
const activeTabId = ref(tabs.value[0].id)

const canBack = ref(false)
const canForward = ref(false)
const urlBarOpen = ref(false)
const draft = ref(homeUrl)
const urlInput = ref<HTMLInputElement | null>(null)

const webviewRefs = new Map<string, WebviewEl>()
const attachedTabs = new Set<string>()

/** 每个网站窗口自己的灯，状态跟着模块走（重启后仍然记得） */
const lightsOff = ref(store.states[props.module.id]?.lightsOff ?? false)

/**
 * 烬落这类纯键盘内置应用：激活时把窗口切到美式键盘，屏蔽系统输入法；
 * 离开（切模块、回首页、卸载）时还原。
 */
const blockIme = computed(() => shouldBlockIme(props.module))
let imeBlocked = false

watch(
  () => props.active,
  (active) => {
    if (isWebView2 || !blockIme.value) return
    if (active === imeBlocked) return
    imeBlocked = active
    void window.workbench?.setImeBlocked?.(active)
  },
  { immediate: true }
)

const partition = GUEST_PARTITION
const useragent = GUEST_USER_AGENT

const activeTab = computed(() => tabs.value.find((t) => t.id === activeTabId.value))
const placeholder = computed(() => activeTab.value?.url || props.module.url)

let offOpenTab: (() => void) | undefined

function tabLabel(tab: PageTab) {
  return formatTabLabel(tab)
}

function patchTab(tabId: string, patch: Partial<PageTab>) {
  tabs.value = tabs.value.map((t) => (t.id === tabId ? { ...t, ...patch } : t))
}

function syncModuleState() {
  const tab = activeTab.value
  if (!tab || !props.active) return
  store.update(props.module.id, {
    url: tab.url,
    title: tab.title,
    loading: tab.loading,
    audible: tabs.value.some((t) => t.audible),
    muted: tabs.value.some((t) => t.muted)
  })
}

/** 声音状态无论模块是否可见都要同步，侧栏需要据此显示后台发声提示 */
function syncModuleAudio() {
  store.update(props.module.id, {
    audible: tabs.value.some((t) => t.audible),
    muted: tabs.value.some((t) => t.muted)
  })
}

function activeWv(): WebviewEl | undefined {
  return webviewRefs.get(activeTabId.value)
}

function syncNav(el?: WebviewEl) {
  if (isWebView2) {
    canBack.value = false
    canForward.value = false
    return
  }
  const target = el ?? activeWv()
  if (!target) {
    canBack.value = false
    canForward.value = false
    return
  }
  try {
    canBack.value = target.canGoBack()
    canForward.value = target.canGoForward()
  } catch {
    canBack.value = false
    canForward.value = false
  }
}

function syncAudio(tabId: string, el: WebviewEl) {
  let audible = false
  try {
    audible = el.isCurrentlyAudible?.() === true
  } catch {
    audible = false
  }
  const tab = tabs.value.find((t) => t.id === tabId)
  if (tab && tab.audible === audible) return
  patchTab(tabId, { audible })
  syncModuleAudio()
}

/**
 * 开关灯：让主进程通过 CDP 把该标签的页面换成深色主题。
 * 先让站点自己的 prefers-color-scheme 深色样式生效，站点没写深色样式时
 * 由 Chromium 自动压暗背景、提亮文字（图片保持原样），不是盖一层半透明遮罩。
 */
async function applyLights(el: WebviewEl, enabled = lightsOff.value): Promise<void> {
  if (isWebView2) return

  let id: number
  try {
    id = el.getWebContentsId()
  } catch {
    // 访客进程还没挂上，等 dom-ready 再来
    return
  }
  if (!id) return

  try {
    await window.workbench?.setGuestDarkMode?.(id, enabled)
  } catch {
    /* 页面已经关掉，或调试通道被开发者工具占用 */
  }
}

function toggleLights() {
  lightsOff.value = !lightsOff.value
  store.update(props.module.id, { lightsOff: lightsOff.value })
  for (const el of webviewRefs.values()) void applyLights(el)
}

function attachWebview(tabId: string, el: WebviewEl) {
  if (attachedTabs.has(tabId)) return
  attachedTabs.add(tabId)

  // 每次主文档加载完都重申一次深色设置：页面可能自己重置了媒体查询
  el.addEventListener('dom-ready', () => {
    void applyLights(el)
  })

  el.addEventListener('did-start-loading', () => {
    try {
      if (el.isLoadingMainFrame?.() !== false) patchTab(tabId, { loading: true })
    } catch {
      patchTab(tabId, { loading: true })
    }
    if (tabId === activeTabId.value) syncModuleState()
  })
  el.addEventListener('did-stop-loading', () => {
    patchTab(tabId, { loading: false })
    if (tabId === activeTabId.value) {
      syncNav(el)
      syncModuleState()
    }
    syncAudio(tabId, el)
  })

  // 发声状态：媒体开始/暂停时同步，延后复查一次以避开事件早于状态更新的时序差
  const onMedia = () => {
    syncAudio(tabId, el)
    window.setTimeout(() => syncAudio(tabId, el), 400)
  }
  el.addEventListener('media-started-playing', onMedia)
  el.addEventListener('media-paused', onMedia)
  el.addEventListener('page-title-updated', (e: Event) => {
    const t = (e as unknown as { title?: string }).title
    if (!t) return
    patchTab(tabId, { title: t })
    if (tabId === activeTabId.value) syncModuleState()
  })
  el.addEventListener('did-navigate', (e: Event) => {
    patchTab(tabId, { url: (e as unknown as { url: string }).url })
    if (tabId === activeTabId.value) {
      syncNav(el)
      syncModuleState()
    }
  })
  el.addEventListener('did-navigate-in-page', (e: Event) => {
    const nav = e as unknown as { url: string; isMainFrame: boolean }
    if (!nav.isMainFrame) return
    patchTab(tabId, { url: nav.url })
    if (tabId === activeTabId.value) {
      syncNav(el)
      syncModuleState()
    }
  })

  // 已经加载完的页面不会补发 dom-ready，挂载时先补一次
  void applyLights(el)
}

function setWebviewRef(tabId: string, el: HTMLElement | null) {
  if (el) {
    const wv = el as WebviewEl
    webviewRefs.set(tabId, wv)
    attachWebview(tabId, wv)
    if (tabId === activeTabId.value) syncNav(wv)
  } else {
    webviewRefs.delete(tabId)
    attachedTabs.delete(tabId)
  }
}

function selectTab(id: string) {
  if (activeTabId.value === id) return
  activeTabId.value = id
  const tab = tabs.value.find((t) => t.id === id)
  if (tab) {
    draft.value = tab.url
    syncNav()
    syncModuleState()
  }
}

function openTab(url: string) {
  const tab = createPageTab(url)
  tabs.value = [...tabs.value, tab]
  activeTabId.value = tab.id
  draft.value = tab.url
}

function closeTab(id: string) {
  if (tabs.value.length <= 1) return
  const idx = tabs.value.findIndex((t) => t.id === id)
  if (idx < 0) return

  webviewRefs.delete(id)
  attachedTabs.delete(id)
  const nextTabs = tabs.value.filter((t) => t.id !== id)
  tabs.value = nextTabs

  if (activeTabId.value === id) {
    const next = nextTabs[Math.max(0, idx - 1)]
    activeTabId.value = next.id
    draft.value = next.url
    nextTick(() => {
      syncNav()
      syncModuleState()
    })
  }
  syncModuleAudio()
}

function back() {
  if (isWebView2) return
  activeWv()?.goBack()
}
function forward() {
  if (isWebView2) return
  activeWv()?.goForward()
}

/** 刷新指定标签；加载中时改为停止 */
function reloadTab(tabId = activeTabId.value) {
  if (isWebView2) {
    bumpFrame(tabId)
    patchTab(tabId, { loading: true })
    return
  }
  const el = webviewRefs.get(tabId)
  if (!el) return
  const tab = tabs.value.find((t) => t.id === tabId)
  try {
    if (tab?.loading) el.stop()
    else el.reload()
  } catch {
    /* ignore */
  }
}

/** 该标签单独静音 / 取消静音（后台模块的声音也能从这里关掉） */
function toggleMute(tabId: string) {
  const tab = tabs.value.find((t) => t.id === tabId)
  if (!tab) return
  const next = !tab.muted
  const el = webviewRefs.get(tabId)
  try {
    el?.setAudioMuted?.(next)
  } catch {
    /* ignore */
  }
  patchTab(tabId, { muted: next, audible: next ? false : tab.audible })
  syncModuleAudio()
  if (!next) {
    window.setTimeout(() => {
      const cur = webviewRefs.get(tabId)
      if (cur) syncAudio(tabId, cur)
    }, 400)
  }
}

/** 站内导航：Electron 走 webview.loadURL，WPF 壳靠改 src + 重挂 iframe */
function navigateTo(tabId: string, url: string) {
  patchTab(tabId, { url })
  if (isWebView2) {
    patchTab(tabId, { loading: true })
    bumpFrame(tabId)
    return
  }
  try {
    webviewRefs.get(tabId)?.loadURL(url)
  } catch {
    /* ignore */
  }
}

/** 回到该网站配置的首页地址 */
function goHome() {
  const url = props.module.url
  if (!url) return
  navigateTo(activeTabId.value, url)
  store.setUrl(props.module.id, url)
  syncModuleState()
}

function toggleUrlBar() {
  urlBarOpen.value = !urlBarOpen.value
  if (urlBarOpen.value) {
    draft.value = activeTab.value?.url || props.module.url
    nextTick(() => {
      urlInput.value?.focus()
      urlInput.value?.select()
    })
  }
}

function onSubmit() {
  const s = draft.value.trim()
  if (!s) return
  const normalized = normalize(s)
  navigateTo(activeTabId.value, normalized)
  store.setUrl(props.module.id, normalized)
  syncModuleState()
}

function onKey(e: KeyboardEvent) {
  if (!props.active) return
  const ctrl = e.ctrlKey || e.metaKey
  if (!ctrl) return
  if (e.key.toLowerCase() === 'l') {
    // 内置应用没有地址栏
    if (isBuiltin.value) return
    e.preventDefault()
    toggleUrlBar()
  }
  if (e.key.toLowerCase() === 'r') {
    e.preventDefault()
    reloadTab()
  }
}

watch(activeTabId, () => {
  syncNav()
  syncModuleState()
})

// 从其它模块切回来时，同步导航按钮与状态栏
watch(
  () => props.active,
  (active) => {
    if (!active) return
    syncNav()
    syncModuleState()
    // 内置应用是键盘操作型（游戏），切进来就把焦点交给页面，免得用户先点一下
    if (isBuiltin.value) {
      nextTick(() => activeWv()?.focus())
    }
  },
  { immediate: true }
)

onMounted(() => {
  window.addEventListener('keydown', onKey)
  offOpenTab = window.workbench.onGuestOpenTab((payload) => {
    if (!props.active) return
    openTab(payload.url)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  offOpenTab?.()
  webviewRefs.clear()
  attachedTabs.clear()
  if (imeBlocked) {
    imeBlocked = false
    void window.workbench?.setImeBlocked?.(false)
  }
})

defineExpose({ webviewEl: activeWv })
</script>

<style scoped>
.workspace {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: transparent;
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.workspace-toolbar {
  justify-content: flex-start;
  background: color-mix(in srgb, var(--bg) 85%, transparent);
  backdrop-filter: blur(var(--blur-chrome));
  -webkit-backdrop-filter: blur(var(--blur-chrome));
  -webkit-app-region: no-drag;
}

.tabbar {
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  gap: 4px;
  padding: 4px 8px 0;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg) 85%, transparent);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  background: transparent;
  transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.tab:hover {
  color: var(--text);
  background: var(--surface-hover);
}

.tab.active {
  color: var(--text);
  background: var(--surface-raised);
  box-shadow: inset 0 0 0 1px var(--border);
}

.tab.loading .tab__label {
  opacity: 0.7;
}

.tab__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab__actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.tab__btn,
.tab__close {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease),
    color var(--dur-fast) var(--ease);
}

/* 发声 / 静音标记常态可见：否则后台模块在发声时无从下手 */
.tab__btn.is-on,
.tab__btn.is-muted,
.tab.active .tab__btn,
.tab__btn:focus-visible {
  opacity: 1;
}

.tab__btn.is-on {
  color: var(--accent);
}

.tab:hover .tab__btn,
.tab:hover .tab__close,
.tab.active .tab__close {
  opacity: 1;
}

.tab__btn:hover,
.tab__close:hover {
  background: var(--surface-active);
  color: var(--text);
}

.is-spin {
  animation: tab-spin 0.9s linear infinite;
}

@keyframes tab-spin {
  to {
    transform: rotate(360deg);
  }
}

.url-toggle.on,
.lights-toggle.on {
  background: var(--surface-active);
  color: var(--accent);
}

.urlbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border-bottom: 1px solid var(--border);
}

.url-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 var(--space-3);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  transition: border-color var(--dur) var(--ease);
}

.url-input:focus { border-color: var(--border-focus); }

.go {
  height: 32px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  background: var(--accent);
  color: var(--on-accent);
  font-size: var(--text-sm);
  font-weight: 500;
  transition: background var(--dur-fast) var(--ease);
  flex-shrink: 0;
}

.go:hover:not(:disabled) { background: var(--accent-hover); }
.go:disabled { background: var(--surface-raised); color: var(--text-muted); cursor: default; }

.urlbar-enter-active, .urlbar-leave-active {
  transition: max-height var(--dur) var(--ease), opacity var(--dur) var(--ease);
  overflow: hidden;
}
.urlbar-enter-from, .urlbar-leave-to { max-height: 0; opacity: 0; }
.urlbar-enter-to, .urlbar-leave-from { max-height: 56px; opacity: 1; }

.viewport {
  flex: 1 1 auto;
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: var(--bg);
}

.wv {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  display: flex;
  background: #fff;
}

/* WebView2 壳走 iframe，拿不到访客进程，开关灯按钮在那边直接隐藏 */
.loading-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 2;
  overflow: hidden;
  pointer-events: none;
}

.loading-fill {
  height: 100%;
  width: 24%;
  background: var(--accent);
  opacity: 0.7;
  animation: slide 1s ease-in-out infinite;
}

@keyframes slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

.bar-enter-active, .bar-leave-active { transition: opacity var(--dur) var(--ease); }
.bar-enter-from, .bar-leave-to { opacity: 0; }
</style>

<template>
  <section class="workspace">
    <header class="mac-toolbar workspace-toolbar">
      <div class="mac-toolbar__cluster">
        <button type="button" class="mac-icon-btn" @click="back" :disabled="!canBack" title="后退">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <button type="button" class="mac-icon-btn" @click="forward" :disabled="!canForward" title="前进">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
        </button>
        <button type="button" class="mac-icon-btn" @click="reload" title="刷新">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" />
          </svg>
        </button>
      </div>
      <button
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

    <div class="tabbar" role="tablist" aria-label="页面标签">
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
import type { ModuleConfig } from '../modules/registry'
import { normalize, useModulesStore } from '../stores/modules'

/** <webview> 元素暴露的运行时方法（Electron.WebviewTag 在 renderer 里不可见，这里局部声明用到的子集）。 */
interface WebviewEl extends HTMLElement {
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
  reload(): void
  loadURL(url: string): Promise<void>
  isLoadingMainFrame?(): boolean
}

const props = defineProps<{
  module: ModuleConfig
}>()

const store = useModulesStore()

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
  if (!tab) return
  store.update(props.module.id, {
    url: tab.url,
    title: tab.title,
    loading: tab.loading
  })
}

function activeWv(): WebviewEl | undefined {
  return webviewRefs.get(activeTabId.value)
}

function syncNav(el?: WebviewEl) {
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

function attachWebview(tabId: string, el: WebviewEl) {
  if (attachedTabs.has(tabId)) return
  attachedTabs.add(tabId)

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
  })
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
}

function back() {
  activeWv()?.goBack()
}
function forward() {
  activeWv()?.goForward()
}
function reload() {
  activeWv()?.reload()
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
  patchTab(activeTabId.value, { url: normalized })
  store.setUrl(props.module.id, normalized)
  activeWv()?.loadURL(normalized)
  syncModuleState()
}

function onKey(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey
  if (!ctrl) return
  if (e.key.toLowerCase() === 'l') {
    e.preventDefault()
    toggleUrlBar()
  }
  if (e.key.toLowerCase() === 'r') {
    e.preventDefault()
    reload()
  }
}

watch(activeTabId, () => {
  syncNav()
  syncModuleState()
})

onMounted(() => {
  window.addEventListener('keydown', onKey)
  syncModuleState()
  offOpenTab = window.workbench.onGuestOpenTab((payload) => {
    if (store.activeId !== props.module.id) return
    openTab(payload.url)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  offOpenTab?.()
  webviewRefs.clear()
  attachedTabs.clear()
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
  max-width: 200px;
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
  transition: opacity var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}

.tab:hover .tab__close,
.tab.active .tab__close {
  opacity: 1;
}

.tab__close:hover {
  background: var(--surface-active);
  color: var(--text);
}

.url-toggle.on {
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

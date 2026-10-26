<template>
  <div class="workbench">
    <WhaleThemeDecor v-if="pathVariant" :variant="pathVariant" />
    <EvaThemeDecor v-else-if="evaVariant" :variant="evaVariant" />
    <header class="window-chrome">
      <WindowControls v-if="customChrome" />
      <div v-else class="mac-traffic-spacer" aria-hidden="true" />
      <div class="window-chrome__drag" aria-hidden="true" />
    </header>

    <div class="app-body">
      <Sidebar
        :modules="store.modules"
        :active-id="store.activeId"
        :view="view"
        @select="onSelect"
        @home="onHome"
        @settings="onSettings"
      />

      <div class="main-pane">
        <TitleBar v-if="view === 'settings'" title="设置" />

        <div class="content-area" :class="{ 'is-home': view === 'home' }">
          <HomeDashboard v-show="view === 'home'" />

          <!--
            模块工作区常驻：首次进入时挂载，之后仅切换显隐，
            避免侧栏切换 / 进入设置再返回时重建 webview 导致页面刷新。
          -->
          <div v-show="view === 'module'" class="content-fill">
            <div class="workspaces">
              <template v-for="m in liveModules" :key="m.id">
                <Workspace
                  v-if="m.kind !== 'native'"
                  v-show="m.id === store.activeId"
                  :module="m"
                  :active="view === 'module' && m.id === store.activeId"
                />
                <NativeWorkspace
                  v-else
                  v-show="m.id === store.activeId"
                  :module="m"
                  :active="view === 'module' && m.id === store.activeId"
                />
              </template>
            </div>
          </div>

          <Transition name="fade-view" mode="out-in">
            <Settings v-if="view === 'settings'" key="settings" />
          </Transition>
        </div>

        <StatusBar v-if="settings.appearance.showStatusBar" :view="view" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
import Workspace from './components/Workspace.vue'
import NativeWorkspace from './components/NativeWorkspace.vue'
import StatusBar from './components/StatusBar.vue'
import HomeDashboard from './components/HomeDashboard.vue'
import Settings from './components/Settings.vue'
import WindowControls from './components/WindowControls.vue'
import WhaleThemeDecor from './components/WhaleThemeDecor.vue'
import EvaThemeDecor from './components/EvaThemeDecor.vue'
import { useReminderSync } from './composables/useReminderSync'
import { useModulesStore } from './stores/modules'
import { isEvaTheme, isPathSceneTheme, useSettingsStore } from './stores/settings'

type View = 'home' | 'module' | 'settings'

const customChrome = window.workbench?.platform !== 'darwin'

const store = useModulesStore()
const settings = useSettingsStore()
useReminderSync()
const view = ref<View>('home')

/** 已打开过的模块：工作区实例常驻，切换时不再销毁重建 */
const liveIds = ref<string[]>([])

const liveModules = computed(() => store.modules.filter((m) => liveIds.value.includes(m.id)))

function ensureLive(id: string) {
  if (!id) return
  if (!liveIds.value.includes(id)) liveIds.value = [...liveIds.value, id]
}

/** 位图场景皮肤（女仆工坊 / 虎鲸链路）——EVA 走自己的装饰层 */
const pathVariant = computed(() => {
  const theme = settings.appearance.theme
  return isPathSceneTheme(theme) ? theme : null
})

const evaVariant = computed(() => {
  const theme = settings.appearance.theme
  return isEvaTheme(theme) ? theme : null
})

function onSelect(id: string) {
  ensureLive(id)
  store.openFromSidebar(id)
  view.value = 'module'
}

// 模块被外部切换（如删除后的兜底激活）时也要保证工作区已挂载
watch(
  () => store.activeId,
  (id) => {
    if (view.value !== 'module') return
    ensureLive(id)
  }
)

function onHome() {
  view.value = 'home'
}

function onSettings() {
  view.value = 'settings'
}

function onKey(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey
  if (!ctrl) return
  if (e.key === ',') {
    e.preventDefault()
    onSettings()
  }
}

let offMaximized: (() => void) | undefined

onMounted(async () => {
  window.addEventListener('keydown', onKey)

  const applyMax = (max: boolean) => {
    document.documentElement.classList.toggle('is-maximized', max)
  }
  try {
    applyMax(await window.workbench.isMaximized())
    offMaximized = window.workbench.onMaximized(applyMax)
  } catch {
    /* ignore */
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  offMaximized?.()
})
</script>

<style scoped>
.workbench {
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--bg);
  border-radius: inherit;
  display: flex;
  flex-direction: column;
  position: relative;
}

.window-chrome {
  height: var(--window-chrome-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
}

.mac-traffic-spacer {
  width: 72px;
  flex-shrink: 0;
}

.window-chrome__drag {
  flex: 1;
  min-width: 0;
  height: 100%;
}

.app-body {
  flex: 1;
  min-height: 0;
  display: flex;
  position: relative;
  overflow: hidden;
}

.main-pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  position: relative;
  overflow: hidden;
}

.content-area {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.content-area.is-home {
  background: transparent;
}

.content-fill {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.workspaces {
  flex: 1;
  min-height: 0;
  position: relative;
}
</style>

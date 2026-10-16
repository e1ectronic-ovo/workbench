<template>
  <div class="workbench">
    <WhaleThemeDecor v-if="sceneVariant" :variant="sceneVariant" />
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
          <EmptyState v-show="view === 'home'" />
          <Transition name="fade-view" mode="out-in">
            <div v-if="view === 'module' && store.active" key="module" class="content-fill">
              <div class="workspaces">
                <Workspace
                  :key="`${store.activeId}:${workspaceKey}`"
                  :module="store.active"
                />
              </div>
            </div>
            <Settings v-else-if="view === 'settings'" key="settings" />
          </Transition>
        </div>

        <StatusBar v-if="settings.appearance.showStatusBar" :view="view" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import TitleBar from './components/TitleBar.vue'
import Sidebar from './components/Sidebar.vue'
import Workspace from './components/Workspace.vue'
import StatusBar from './components/StatusBar.vue'
import EmptyState from './components/EmptyState.vue'
import Settings from './components/Settings.vue'
import WindowControls from './components/WindowControls.vue'
import WhaleThemeDecor from './components/WhaleThemeDecor.vue'
import { useReminderSync } from './composables/useReminderSync'
import { useModulesStore } from './stores/modules'
import { isSceneTheme, useSettingsStore } from './stores/settings'

type View = 'home' | 'module' | 'settings'

const customChrome = window.workbench?.platform !== 'darwin'

const store = useModulesStore()
const settings = useSettingsStore()
useReminderSync()
const view = ref<View>('home')
const workspaceKey = ref(0)

const sceneVariant = computed(() => {
  const theme = settings.appearance.theme
  return isSceneTheme(theme) ? theme : null
})

function onSelect(id: string) {
  store.openFromSidebar(id)
  workspaceKey.value++
  view.value = 'module'
}

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

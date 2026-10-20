<template>
  <aside class="sidebar" :class="{ compact: !showLabels }">
    <nav class="sidebar-body" aria-label="导航">
      <p v-if="showLabels" class="sidebar-section">通用</p>
      <button
        type="button"
        class="nav-item"
        :class="{ active: view === 'home' }"
        @click="$emit('home')"
      >
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 11.2 12 4.5l8 6.7" />
            <path d="M7 10.5V19h10v-8.5" />
          </svg>
        </span>
        <span v-if="showLabels" class="nav-label">首页</span>
      </button>

      <p v-if="showLabels && modules.length" class="sidebar-section">网站</p>

      <button
        v-for="m in modules"
        :key="m.id"
        type="button"
        class="nav-item"
        :class="{ active: view === 'module' && activeId === m.id }"
        :title="m.name"
        @click="$emit('select', m.id)"
      >
        <span class="nav-icon module">
          <ModuleIcon :module="m" variant="nav" />
        </span>
        <span v-if="showLabels" class="nav-label">{{ m.name }}</span>
        <span
          v-if="audioBadges[m.id]"
          class="nav-audio"
          :class="{ 'is-muted': audioBadges[m.id] === 'muted' }"
          :title="audioBadges[m.id] === 'muted' ? `${m.name}：已静音` : `${m.name}：正在播放声音`"
        >
          <svg v-if="audioBadges[m.id] === 'muted'" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4V5z" />
            <path d="m17 9 4 5M21 9l-4 5" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5 6 9H3v6h3l5 4V5z" />
            <path d="M16 9a4 4 0 0 1 0 6" />
          </svg>
        </span>
      </button>

    </nav>

    <footer class="sidebar-foot">
      <button
        type="button"
        class="nav-item"
        :class="{ active: view === 'settings' }"
        @click="$emit('settings')"
      >
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3.5v2.2M12 18.3V20.5M3.5 12h2.2M18.3 12H20.5" />
          </svg>
        </span>
        <span v-if="showLabels" class="nav-label">设置</span>
      </button>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ModuleConfig } from '../modules/registry'
import { useModulesStore } from '../stores/modules'
import { useSettingsStore } from '../stores/settings'
import ModuleIcon from './ModuleIcon.vue'

const props = defineProps<{
  modules: ModuleConfig[]
  activeId: string
  view: 'home' | 'module' | 'settings'
}>()

defineEmits<{
  (e: 'select', id: string): void
  (e: 'home'): void
  (e: 'settings'): void
}>()

const settings = useSettingsStore()
const modulesStore = useModulesStore()

/** 后台模块发声时的角标：不看标签栏也能知道是谁在响 */
const audioBadges = computed(() => {
  const out: Record<string, 'playing' | 'muted'> = {}
  for (const m of props.modules) {
    const s = modulesStore.states[m.id]
    if (!s) continue
    if (s.muted) out[m.id] = 'muted'
    else if (s.audible) out[m.id] = 'playing'
  }
  return out
})

const showLabels = computed(
  () =>
    settings.appearance.density !== 'compact' && settings.appearance.showModuleLabels
)
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-w);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--sidebar-bg, var(--surface-secondary));
  border-right: 1px solid var(--border);
}

.sidebar-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 8px 4px;
}

.sidebar-foot {
  flex: 0 0 auto;
  margin-top: auto;
  padding: 6px 8px 10px;
  border-top: 1px solid var(--border);
  margin-left: 8px;
  margin-right: 8px;
}

.sidebar-section {
  margin: 8px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.sidebar-section:first-child {
  margin-top: 0;
}

.nav-item {
  width: 100%;
  min-height: 28px;
  padding: 4px 8px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text);
  text-align: left;
  transition: background var(--dur-fast) var(--ease);
}

.nav-item:hover {
  background: var(--nav-hover);
}

.nav-item.active {
  background: var(--nav-selected);
}

.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--nav-icon);
  transition: color var(--dur-fast) var(--ease);
}

.nav-icon.module {
  border-radius: 4px;
  overflow: hidden;
}

.nav-item.active .nav-icon {
  color: var(--text);
}

.nav-audio {
  margin-left: auto;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}

.nav-audio.is-muted {
  color: var(--text-muted);
}

.nav-label {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar.compact .sidebar-body,
.sidebar.compact .sidebar-foot {
  padding-left: 6px;
  padding-right: 6px;
}

.sidebar.compact .nav-item {
  justify-content: center;
  padding: 5px 0;
  min-height: 32px;
}

.sidebar.compact .sidebar-section {
  display: none;
}

.sidebar.compact .nav-icon {
  width: 20px;
  height: 20px;
}
</style>

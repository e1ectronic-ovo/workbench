<template>
  <aside class="sidebar" :class="{ compact: !showLabels }">
    <div class="sidebar-brand" aria-label="鲸汐 Whaletide">
      <span class="sidebar-brand__mark" aria-hidden="true">
        <img :src="appIcon" alt="" />
      </span>
      <span v-if="showLabels" class="sidebar-brand__wordmark">
        <strong>鲸汐</strong>
        <small>WHALETIDE</small>
      </span>
    </div>

    <nav class="sidebar-body" aria-label="主导航">
      <div class="sidebar-group sidebar-group--primary">
        <p v-if="showLabels" class="sidebar-section">工作台</p>
        <button
          type="button"
          class="nav-item"
          :class="{ active: view === 'home' }"
          :aria-current="view === 'home' ? 'page' : undefined"
          title="首页"
          @click="$emit('home')"
        >
          <span class="nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="4" width="6" height="6" rx="1.2" />
              <rect x="14" y="4" width="6" height="6" rx="1.2" />
              <rect x="4" y="14" width="6" height="6" rx="1.2" />
              <path d="M14 17h6M17 14v6" />
            </svg>
          </span>
          <span v-if="showLabels" class="nav-label">首页</span>
          <span v-if="showLabels" class="nav-meta">Tide Deck</span>
        </button>
      </div>

      <!-- 内置应用（随客户端发布）与用户添加的网站分开展示，语义不同 -->
      <div v-for="group in groups" :key="group.key" class="sidebar-group">
        <p v-if="showLabels" class="sidebar-section">{{ group.label }}</p>

        <button
          v-for="m in group.items"
          :key="m.id"
          type="button"
          class="nav-item"
          :class="{ active: view === 'module' && activeId === m.id }"
          :aria-current="view === 'module' && activeId === m.id ? 'page' : undefined"
          :title="m.name"
          @click="$emit('select', m.id)"
        >
          <span class="nav-icon module" aria-hidden="true">
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
      </div>
    </nav>

    <footer class="sidebar-foot">
      <button
        type="button"
        class="nav-item nav-item--settings"
        :class="{ active: view === 'settings' }"
        :aria-current="view === 'settings' ? 'page' : undefined"
        title="偏好设置"
        @click="$emit('settings')"
      >
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
            <path d="M4 7h10M18 7h2M4 12h2M10 12h10M4 17h7M15 17h5" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="8" cy="12" r="2" />
            <circle cx="13" cy="17" r="2" />
          </svg>
        </span>
        <span v-if="showLabels" class="nav-copy">
          <span class="nav-label">偏好设置</span>
          <small>主题、外观与快捷键</small>
        </span>
      </button>

      <button
        type="button"
        class="nav-item nav-item--collapse"
        :title="collapsed ? '展开侧栏' : '收起侧栏（只留图标）'"
        :aria-label="collapsed ? '展开侧栏' : '收起侧栏'"
        :aria-expanded="!collapsed"
        @click="toggleCollapsed"
      >
        <span class="nav-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2.2" />
            <path d="M9.5 4v16" />
            <path v-if="collapsed" d="m13.5 10 2 2-2 2" />
            <path v-else d="m16 10-2 2 2 2" />
          </svg>
        </span>
        <span v-if="showLabels" class="nav-label">{{ collapsed ? '展开侧栏' : '收起侧栏' }}</span>
      </button>
    </footer>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import appIcon from '../../../../resources/icon.png'
import { isBuiltinModule, type ModuleConfig } from '../modules/registry'
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

/** 内置应用和网站分开列，空分组自动隐藏 */
const groups = computed(() =>
  [
    { key: 'app', label: '应用', items: props.modules.filter(isBuiltinModule) },
    { key: 'web', label: '网站', items: props.modules.filter((m) => !isBuiltinModule(m)) }
  ].filter((g) => g.items.length > 0)
)

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

/** 侧栏是否处于收起态（只剩图标） */
const collapsed = computed(() => !showLabels.value)

/**
 * 一键收起 / 展开侧栏。
 * 收起走「紧凑密度」，展开顺手把标签开关打开——否则用户之前手动关过标签，
 * 点展开会看起来毫无反应。
 */
function toggleCollapsed() {
  if (collapsed.value) {
    settings.patchAppearance({ density: 'comfortable', showModuleLabels: true })
  } else {
    settings.patchAppearance({ density: 'compact' })
  }
}
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

.sidebar-brand {
  min-height: 66px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 14px 12px;
  border-bottom: 1px solid var(--border);
}

.sidebar-brand__mark {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 9px;
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, #fff 10%, transparent),
    0 8px 20px color-mix(in srgb, var(--accent) 18%, transparent);
}

.sidebar-brand__mark img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sidebar-brand__wordmark {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  line-height: 1.1;
}

.sidebar-brand__wordmark strong {
  font-size: 15px;
  font-weight: 650;
  letter-spacing: 0.08em;
  color: var(--text);
}

.sidebar-brand__wordmark small {
  margin-top: 4px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.16em;
  color: var(--text-muted);
}

.sidebar-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 9px 8px;
}

.sidebar-group + .sidebar-group {
  margin-top: 14px;
}

.sidebar-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 8px 6px;
  font-size: 9.5px;
  font-weight: 650;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.sidebar-section::after {
  content: '';
  flex: 1;
  height: 1px;
  background: color-mix(in srgb, var(--border) 72%, transparent);
}

.nav-item {
  position: relative;
  width: 100%;
  min-height: 32px;
  padding: 6px 9px;
  border: 1px solid transparent;
  border-radius: 9px;
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--text);
  text-align: left;
  transition:
    color var(--dur-fast) var(--ease),
    background-color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}

.nav-item::before {
  content: '';
  position: absolute;
  top: 7px;
  bottom: 7px;
  left: -1px;
  width: 2px;
  border-radius: 999px;
  background: var(--accent);
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease);
}

.nav-item:hover {
  background: var(--nav-hover);
}

.nav-item.active {
  background: color-mix(in srgb, var(--accent) 11%, var(--surface-raised));
  border-color: color-mix(in srgb, var(--accent) 24%, transparent);
}

.nav-item.active::before {
  opacity: 1;
}

.nav-icon {
  width: 19px;
  height: 19px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--nav-icon);
  transition: color var(--dur-fast) var(--ease);
}

.nav-icon.module {
  border-radius: 5px;
  overflow: hidden;
}

.nav-item.active .nav-icon {
  color: var(--accent);
}

.nav-label {
  min-width: 0;
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-meta {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 550;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  text-transform: uppercase;
  opacity: 0.8;
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

.nav-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nav-copy small {
  overflow: hidden;
  font-size: 9.5px;
  line-height: 1.25;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-foot {
  flex: 0 0 auto;
  padding: 8px 9px 10px;
  border-top: 1px solid var(--border);
}

.nav-item--settings {
  min-height: 42px;
}

.nav-item--collapse {
  min-height: 36px;
  margin-top: 2px;
  color: var(--text-muted);
}

.nav-item--collapse:hover {
  color: var(--text);
}

.sidebar.compact .sidebar-brand {
  min-height: 56px;
  justify-content: center;
  padding: 10px 8px;
}

.sidebar.compact .sidebar-brand__mark {
  width: 32px;
  height: 32px;
}

.sidebar.compact .sidebar-body,
.sidebar.compact .sidebar-foot {
  padding-left: 6px;
  padding-right: 6px;
}

.sidebar.compact .sidebar-group + .sidebar-group {
  margin-top: 10px;
}

.sidebar.compact .nav-item {
  justify-content: center;
  padding: 6px 0;
  min-height: 36px;
}

.sidebar.compact .nav-item::before {
  display: none;
}

.sidebar.compact .nav-icon {
  width: 21px;
  height: 21px;
}

.sidebar.compact .nav-item--settings {
  min-height: 38px;
}

.sidebar.compact .nav-item--collapse {
  min-height: 34px;
}
</style>

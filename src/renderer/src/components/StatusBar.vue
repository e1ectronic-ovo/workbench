<template>
  <footer class="statusbar">
    <div class="left">
      <span class="dot" :class="{ loading: isLoading }"></span>
      <span class="label">{{ label }}</span>
    </div>
    <div class="right">
      <span class="url" v-if="url">{{ url }}</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useModulesStore } from '../stores/modules'

const props = defineProps<{
  view: 'home' | 'module' | 'settings'
}>()

const store = useModulesStore()

const isLoading = computed(
  () => props.view === 'module' && (store.activeState?.loading ?? false)
)

const label = computed(() => {
  if (props.view === 'home') return '工作台'
  if (props.view === 'settings') return '设置'
  if (!store.active) return '鲸汐'
  const s = store.activeState
  if (!s) return store.active.name
  if (s.loading) return '加载中'
  return store.active.name
})

const url = computed(() =>
  props.view === 'module' ? store.activeState?.url || '' : ''
)
</script>

<style scoped>
.statusbar {
  height: var(--statusbar-h);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4);
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg) 90%, transparent);
  font-size: 11px;
  color: var(--text-muted);
}

.left,
.right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--success);
  flex-shrink: 0;
}

.dot.loading {
  background: var(--warning);
}

.label {
  color: var(--text-secondary);
  font-weight: 500;
}

.url {
  max-width: 60vw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
}
</style>

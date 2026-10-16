<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="menuEl"
      class="home-ctx"
      :style="{ left: `${x}px`, top: `${y}px` }"
      role="menu"
      @contextmenu.prevent
    >
      <template v-if="target === 'canvas'">
        <p class="home-ctx__title">首页布局</p>

        <div class="home-ctx__section">
          <span class="home-ctx__label">栅格列数</span>
          <div class="home-ctx__chips">
            <button
              v-for="n in columnOptions"
              :key="n"
              type="button"
              class="home-ctx__chip"
              :class="{ 'is-on': layout.columns === n }"
              role="menuitemradio"
              :aria-checked="layout.columns === n"
              @click="homeWidgets.setLayout({ columns: n })"
            >
              {{ n }}
            </button>
          </div>
        </div>

        <div class="home-ctx__section">
          <label class="home-ctx__slider">
            <span class="home-ctx__label">组件背景不透明度</span>
            <span class="home-ctx__value">{{ layout.panelOpacity }}%</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              :value="layout.panelOpacity"
              @input="onOpacity"
            />
          </label>
          <p class="home-ctx__hint">数值越低背景越透明</p>
        </div>

        <div class="home-ctx__divider" />

        <p class="home-ctx__label">显示组件</p>
        <button
          v-for="item in widgetRows"
          :key="item.config.id"
          type="button"
          class="home-ctx__row"
          role="menuitemcheckbox"
          :aria-checked="item.config.enabled"
          @click="homeWidgets.setEnabled(item.config.id, !item.config.enabled)"
        >
          <span class="home-ctx__check" :class="{ 'is-on': item.config.enabled }" aria-hidden="true">
            <svg v-if="item.config.enabled" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <span>{{ item.def.name }}</span>
        </button>

        <p class="home-ctx__foot">拖动组件可调整位置，不会自动排序</p>
      </template>

      <template v-else-if="targetWidget">
        <p class="home-ctx__title">{{ targetWidget.def.name }}</p>
        <button type="button" class="home-ctx__row" role="menuitem" @click="hideWidget">
          隐藏此组件
        </button>
        <div class="home-ctx__section">
          <span class="home-ctx__label">占据列宽</span>
          <div class="home-ctx__chips">
            <button
              v-for="n in spanOptions"
              :key="n"
              type="button"
              class="home-ctx__chip"
              :class="{ 'is-on': targetWidget.config.colSpan === n }"
              role="menuitemradio"
              @click="homeWidgets.setSpan(targetWidget.config.id, n)"
            >
              {{ n }}
            </button>
          </div>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { homeWidgetDef } from '../home/registry'
import { useHomeWidgetsStore, type HomeWidgetId } from '../stores/home-widgets'

const props = defineProps<{
  open: boolean
  x: number
  y: number
  target: 'canvas' | 'widget'
  widgetId?: HomeWidgetId | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const homeWidgets = useHomeWidgetsStore()
const menuEl = ref<HTMLElement | null>(null)

const layout = computed(() => homeWidgets.layout)
const columnOptions = [4, 6, 8, 12]

const widgetRows = computed(() =>
  homeWidgets.allWidgets
    .map((config) => {
      const def = homeWidgetDef(config.id)
      if (!def) return null
      return { config, def }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
)

const targetWidget = computed(() => {
  if (!props.widgetId) return null
  const config = homeWidgets.allWidgets.find((w) => w.id === props.widgetId)
  if (!config) return null
  const def = homeWidgetDef(config.id)
  if (!def) return null
  return { config, def }
})

const spanOptions = computed(() => {
  const max = layout.value.columns
  return Array.from({ length: max }, (_, i) => i + 1)
})

function onOpacity(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  homeWidgets.setLayout({ panelOpacity: v })
}

function hideWidget() {
  if (!props.widgetId) return
  homeWidgets.setEnabled(props.widgetId, false)
  emit('close')
}

function onDocPointer(e: PointerEvent) {
  if (!props.open) return
  const el = menuEl.value
  if (el && !el.contains(e.target as Node)) emit('close')
}

function onDocKey(e: KeyboardEvent) {
  if (props.open && e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener('pointerdown', onDocPointer, true)
      document.addEventListener('keydown', onDocKey)
    } else {
      document.removeEventListener('pointerdown', onDocPointer, true)
      document.removeEventListener('keydown', onDocKey)
    }
  }
)

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true)
  document.removeEventListener('keydown', onDocKey)
})
</script>

<style scoped>
.home-ctx {
  position: fixed;
  z-index: 1000;
  min-width: 220px;
  max-width: 280px;
  padding: 8px;
  border-radius: var(--radius-list);
  background: color-mix(in srgb, var(--surface-raised) 92%, transparent);
  backdrop-filter: blur(20px) saturate(1.1);
  -webkit-backdrop-filter: blur(20px) saturate(1.1);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-md);
}

.home-ctx__title {
  margin: 0 8px 6px;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text);
}

.home-ctx__section {
  padding: 4px 8px 8px;
}

.home-ctx__label {
  display: block;
  margin: 0 0 6px;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.home-ctx__value {
  float: right;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.home-ctx__hint,
.home-ctx__foot {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-muted);
}

.home-ctx__foot {
  padding: 6px 8px 2px;
}

.home-ctx__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.home-ctx__chip {
  min-width: 36px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--fill-tertiary);
  transition: background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease);
}

.home-ctx__chip:hover {
  color: var(--text);
}

.home-ctx__chip.is-on {
  color: var(--text);
  background: var(--surface-active);
  box-shadow: inset 0 0 0 1px var(--border-strong);
}

.home-ctx__slider input[type='range'] {
  width: 100%;
  accent-color: var(--accent);
}

.home-ctx__divider {
  height: 1px;
  margin: 4px 0;
  background: var(--border);
}

.home-ctx__row {
  width: 100%;
  min-height: 32px;
  padding: 6px 8px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-sm);
  color: var(--text);
  text-align: left;
  transition: background var(--dur-fast) var(--ease);
}

.home-ctx__row:hover {
  background: var(--surface-hover);
}

.home-ctx__check {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid var(--border-strong);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--on-accent);
}

.home-ctx__check.is-on {
  background: var(--accent);
  border-color: var(--accent);
}
</style>

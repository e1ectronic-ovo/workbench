<template>
  <Teleport to="body">
    <div
      v-if="open"
      ref="menuEl"
      class="home-ctx"
      :style="menuStyle"
      role="menu"
      :aria-label="target === 'canvas' ? '首页布局设置' : targetWidget ? `${targetWidget.def.name}组件设置` : '组件设置'"
      @contextmenu.prevent
      @keydown="onMenuKeydown"
    >
      <header class="home-ctx__header">
        <div class="home-ctx__heading">
          <span class="home-ctx__kicker">
            {{ target === 'canvas' ? 'TIDE DECK' : 'COMPONENT' }}
          </span>
          <span class="home-ctx__title">
            {{ target === 'canvas' ? '布局设置' : targetWidget?.def.name ?? '组件设置' }}
          </span>
        </div>
        <button
          type="button"
          class="home-ctx__close"
          aria-label="关闭菜单"
          @click="emit('close')"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div v-if="target === 'canvas'" class="home-ctx__body">
        <section class="home-ctx__group">
          <div class="home-ctx__label-row">
            <span class="home-ctx__label">栅格列数</span>
            <span class="home-ctx__value">{{ layout.columns }} 列</span>
          </div>
          <div class="home-ctx__chips" role="group" aria-label="栅格列数">
            <button
              v-for="(n, index) in columnOptions"
              :key="n"
              type="button"
              class="home-ctx__chip"
              :class="{ 'is-on': layout.columns === n }"
              role="menuitemradio"
              :aria-checked="layout.columns === n"
              :data-menu-autofocus="index === 0 ? '' : undefined"
              @click="homeWidgets.setLayout({ columns: n })"
            >
              {{ n }}
            </button>
          </div>
        </section>

        <section class="home-ctx__group">
          <label class="home-ctx__slider">
            <span class="home-ctx__label-row">
              <span class="home-ctx__label">组件背景不透明度</span>
              <span class="home-ctx__value">{{ layout.panelOpacity }}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              :value="layout.panelOpacity"
              @input="onOpacity"
            />
          </label>
          <p class="home-ctx__hint">数值越低，主题插画透出得越多。</p>
        </section>

        <div class="home-ctx__divider" />

        <section class="home-ctx__group home-ctx__group--widgets">
          <div class="home-ctx__label-row">
            <span class="home-ctx__label">显示组件</span>
            <span class="home-ctx__value">{{ enabledCount }} / {{ widgetRows.length }}</span>
          </div>
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
              <svg v-if="item.config.enabled" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.6">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <span class="home-ctx__row-copy">
              <span class="home-ctx__row-title">{{ item.def.name }}</span>
              <span class="home-ctx__row-meta">{{ item.def.description }}</span>
            </span>
          </button>
        </section>

        <footer class="home-ctx__foot">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <rect x="5" y="3" width="14" height="18" rx="2" />
            <path d="M12 3v18M5 11h14" />
          </svg>
          <span>右键工作台空白处也可打开此菜单</span>
        </footer>
      </div>

      <div v-else-if="targetWidget" class="home-ctx__body">
        <div class="home-ctx__position-card">
          <span class="home-ctx__position-main">第 {{ targetWidget.config.row }} 行</span>
          <span class="home-ctx__position-meta">
            第 {{ targetWidget.config.col }} 列 · 宽 {{ targetWidget.config.colSpan }} 列 · 高 {{ targetWidget.config.rowSpan }} 行
          </span>
        </div>

        <section class="home-ctx__group">
          <div class="home-ctx__label-row">
            <span class="home-ctx__label">移动位置</span>
            <span class="home-ctx__value">Alt + 方向键</span>
          </div>
          <div class="home-ctx__move-pad" role="group" aria-label="移动组件">
            <button
              type="button"
              class="home-ctx__move"
              :disabled="!canMoveUp"
              aria-label="向上移动"
              title="向上移动"
              @click="moveWidget(0, -1)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="m6 14 6-6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              class="home-ctx__move"
              :disabled="!canMoveLeft"
              aria-label="向左移动"
              title="向左移动"
              @click="moveWidget(-1, 0)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="m14 6-6 6 6 6" />
              </svg>
            </button>
            <span class="home-ctx__move-center" aria-hidden="true">
              {{ targetWidget.config.col }}<small>列</small>
            </span>
            <button
              type="button"
              class="home-ctx__move"
              :disabled="!canMoveRight"
              aria-label="向右移动"
              title="向右移动"
              @click="moveWidget(1, 0)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="m10 6 6 6-6 6" />
              </svg>
            </button>
            <button
              type="button"
              class="home-ctx__move"
              aria-label="向下移动"
              title="向下移动"
              @click="moveWidget(0, 1)"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="m6 10 6 6 6-6" />
              </svg>
            </button>
          </div>
        </section>

        <section class="home-ctx__group">
          <div class="home-ctx__label-row">
            <span class="home-ctx__label">占据列宽</span>
            <span class="home-ctx__value">{{ targetWidget.config.colSpan }} 列</span>
          </div>
          <div class="home-ctx__chips" role="group" aria-label="组件列宽">
            <button
              v-for="n in spanOptions"
              :key="n"
              type="button"
              class="home-ctx__chip"
              :class="{ 'is-on': targetWidget.config.colSpan === n }"
              role="menuitemradio"
              :aria-checked="targetWidget.config.colSpan === n"
              @click="homeWidgets.setSpan(targetWidget.config.id, n)"
            >
              {{ n }}
            </button>
          </div>
        </section>

        <div class="home-ctx__divider" />

        <button type="button" class="home-ctx__row home-ctx__row--danger" role="menuitem" @click="hideWidget">
          <span class="home-ctx__danger-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M5 5l14 14M19 5 5 19" />
            </svg>
          </span>
          隐藏此组件
        </button>

        <footer class="home-ctx__foot">
          <span>拖拽右上方手柄可直接调整位置</span>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
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
const menuPosition = ref({ left: props.x, top: props.y })
let restoreFocusEl: HTMLElement | null = null

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

const enabledCount = computed(() => widgetRows.value.filter((item) => item.config.enabled).length)

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

const menuStyle = computed(() => ({
  left: `${menuPosition.value.left}px`,
  top: `${menuPosition.value.top}px`
}))

const canMoveUp = computed(() => !!targetWidget.value && targetWidget.value.config.row > 1)
const canMoveLeft = computed(() => !!targetWidget.value && targetWidget.value.config.col > 1)
const canMoveRight = computed(() => {
  if (!targetWidget.value) return false
  const max = layout.value.columns - targetWidget.value.config.colSpan + 1
  return targetWidget.value.config.col < max
})

function onOpacity(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  homeWidgets.setLayout({ panelOpacity: v })
}

function moveWidget(dx: number, dy: number) {
  const item = targetWidget.value
  if (!item) return
  const maxCol = Math.max(1, layout.value.columns - item.config.colSpan + 1)
  const col = Math.min(maxCol, Math.max(1, item.config.col + dx))
  const row = Math.max(1, item.config.row + dy)
  if (col === item.config.col && row === item.config.row) return
  homeWidgets.setPosition(item.config.id, col, row)
}

function hideWidget() {
  if (!props.widgetId) return
  homeWidgets.setEnabled(props.widgetId, false)
  emit('close')
}

function focusFirstControl() {
  const el = menuEl.value
  if (!el) return
  const preferred = el.querySelector<HTMLElement>(
    '[data-menu-autofocus]:not([disabled])'
  )
  const fallback = el.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
  )
  ;(preferred ?? fallback)?.focus({ preventScroll: true })
}

async function positionAndFocus() {
  await nextTick()
  const el = menuEl.value
  if (!el) return

  const margin = 12
  const width = el.offsetWidth
  const height = el.offsetHeight
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight

  let left = Math.max(margin, props.x)
  let top = Math.max(margin, props.y)
  if (left + width > viewportW - margin) {
    left = Math.max(margin, props.x - width)
  }
  if (top + height > viewportH - margin) {
    top = Math.max(margin, props.y - height)
  }

  menuPosition.value = { left, top }
  focusFirstControl()
}

function onDocPointer(e: PointerEvent) {
  if (!props.open) return
  const el = menuEl.value
  if (el && !el.contains(e.target as Node)) emit('close')
}

function onDocKey(e: KeyboardEvent) {
  if (!props.open || e.key !== 'Escape') return
  e.preventDefault()
  emit('close')
}

function onMenuKeydown(e: KeyboardEvent) {
  const el = menuEl.value
  if (!el) return
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') {
    return
  }
  if (
    e.target instanceof HTMLInputElement &&
    (e.target.type === 'range' || e.target.type === 'text' || e.target.type === 'search')
  ) {
    return
  }

  const controls = Array.from(
    el.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )
  )
  if (!controls.length) return

  e.preventDefault()
  const current = controls.indexOf(document.activeElement as HTMLElement)
  let next = 0
  if (e.key === 'End') next = controls.length - 1
  else if (e.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % controls.length
  else if (e.key === 'ArrowUp') next = current <= 0 ? controls.length - 1 : current - 1
  controls[next]?.focus({ preventScroll: false })
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      restoreFocusEl =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      document.addEventListener('pointerdown', onDocPointer, true)
      document.addEventListener('keydown', onDocKey)
      window.addEventListener('resize', positionAndFocus)
      void positionAndFocus()
    } else {
      document.removeEventListener('pointerdown', onDocPointer, true)
      document.removeEventListener('keydown', onDocKey)
      window.removeEventListener('resize', positionAndFocus)
      const target = restoreFocusEl
      restoreFocusEl = null
      if (target?.isConnected) void nextTick(() => target.focus({ preventScroll: true }))
    }
  }
)

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true)
  document.removeEventListener('keydown', onDocKey)
  window.removeEventListener('resize', positionAndFocus)
})
</script>

<style scoped>
.home-ctx {
  position: fixed;
  z-index: 1000;
  width: min(284px, calc(100vw - 24px));
  max-height: calc(100vh - 24px);
  overflow-y: auto;
  overscroll-behavior: contain;
  border-radius: 14px;
  background:
    linear-gradient(
      145deg,
      color-mix(in srgb, #fff 4%, transparent),
      transparent 42%
    ),
    color-mix(in srgb, var(--surface-raised) 95%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border-strong));
  box-shadow:
    0 24px 64px color-mix(in srgb, #000 24%, transparent),
    inset 0 1px 0 color-mix(in srgb, #fff 12%, transparent);
  backdrop-filter: blur(26px) saturate(1.16);
  -webkit-backdrop-filter: blur(26px) saturate(1.16);
  animation: home-menu-in var(--dur) var(--ease);
  scrollbar-width: thin;
}

@keyframes home-menu-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.home-ctx__header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 13px 10px 14px;
  background: color-mix(in srgb, var(--surface-raised) 94%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.home-ctx__heading {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.home-ctx__kicker {
  font-size: 8.5px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: 0.14em;
  color: var(--accent);
}

.home-ctx__title {
  font-size: 14px;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -0.02em;
  color: var(--text);
}

.home-ctx__close {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  border: 1px solid transparent;
  transition:
    color var(--dur-fast) var(--ease),
    background-color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}

.home-ctx__close:hover {
  color: var(--text);
  background: var(--surface-hover);
  border-color: var(--border);
}

.home-ctx__body {
  padding: 12px 10px 10px;
}

.home-ctx__group {
  padding: 0 4px;
}

.home-ctx__group + .home-ctx__group {
  margin-top: 13px;
}

.home-ctx__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 7px;
}

.home-ctx__label {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-secondary);
}

.home-ctx__value {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.home-ctx__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.home-ctx__chip {
  min-width: 34px;
  height: 29px;
  padding: 0 9px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 560;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--fill-tertiary) 72%, transparent);
  border: 1px solid transparent;
  transition:
    color var(--dur-fast) var(--ease),
    background-color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}

.home-ctx__chip:hover {
  color: var(--text);
  background: var(--surface-hover);
}

.home-ctx__chip.is-on {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 11%, var(--surface-raised));
  border-color: color-mix(in srgb, var(--accent) 34%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 8%, transparent);
}

.home-ctx__slider {
  display: block;
  padding: 0 4px;
}

.home-ctx__slider input[type='range'] {
  width: 100%;
  margin: 1px 0 0;
  accent-color: var(--accent);
  cursor: pointer;
}

.home-ctx__hint {
  margin: 5px 0 0;
  font-size: 10px;
  line-height: 1.45;
  color: var(--text-muted);
}

.home-ctx__divider {
  height: 1px;
  margin: 13px 4px;
  background: color-mix(in srgb, var(--border) 84%, transparent);
}

.home-ctx__group--widgets {
  display: flex;
  flex-direction: column;
}

.home-ctx__row {
  width: 100%;
  min-height: 32px;
  padding: 7px 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  text-align: left;
  transition: background-color var(--dur-fast) var(--ease);
}

.home-ctx__row:hover {
  background: var(--surface-hover);
}

.home-ctx__check {
  width: 16px;
  height: 16px;
  border-radius: 5px;
  border: 1px solid var(--border-strong);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--on-accent);
  transition:
    background-color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}

.home-ctx__check.is-on {
  background: var(--accent);
  border-color: var(--accent);
}

.home-ctx__row-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.home-ctx__row-title {
  font-size: 11.5px;
  font-weight: 520;
  line-height: 1.25;
}

.home-ctx__row-meta {
  overflow: hidden;
  font-size: 9.5px;
  line-height: 1.35;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-ctx__position-card {
  margin: 0 4px 12px;
  padding: 9px 10px;
  border-radius: 9px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: color-mix(in srgb, var(--accent) 7%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 17%, transparent);
}

.home-ctx__position-main {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.home-ctx__position-meta {
  font-size: 9.5px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.home-ctx__move-pad {
  width: 112px;
  margin: 1px auto 0;
  display: grid;
  grid-template-columns: repeat(3, 34px);
  grid-template-rows: repeat(3, 30px);
  gap: 3px;
  justify-content: center;
}

.home-ctx__move {
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--fill-tertiary) 70%, transparent);
  border: 1px solid transparent;
  transition:
    color var(--dur-fast) var(--ease),
    background-color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}

.home-ctx__move:nth-child(1) { grid-column: 2; grid-row: 1; }
.home-ctx__move:nth-child(2) { grid-column: 1; grid-row: 2; }
.home-ctx__move:nth-child(4) { grid-column: 3; grid-row: 2; }
.home-ctx__move:nth-child(5) { grid-column: 2; grid-row: 3; }

.home-ctx__move:hover:not(:disabled) {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 9%, var(--surface-raised));
  border-color: color-mix(in srgb, var(--accent) 24%, transparent);
}

.home-ctx__move:disabled {
  opacity: 0.3;
}

.home-ctx__move-center {
  grid-column: 2;
  grid-row: 2;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 650;
  line-height: 1;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 17%, transparent);
  font-variant-numeric: tabular-nums;
}

.home-ctx__move-center small {
  margin-top: 2px;
  font-size: 7.5px;
  font-weight: 500;
  color: var(--text-muted);
}

.home-ctx__row--danger {
  width: calc(100% - 8px);
  margin: 0 4px;
  color: var(--destructive);
  gap: 9px;
}

.home-ctx__row--danger:hover {
  background: var(--destructive-soft);
}

.home-ctx__danger-icon {
  width: 23px;
  height: 23px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--destructive) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--destructive) 18%, transparent);
}

.home-ctx__foot {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 4px 0;
  padding-top: 9px;
  border-top: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  font-size: 9.5px;
  line-height: 1.45;
  color: var(--text-muted);
}

@media (prefers-reduced-motion: reduce) {
  .home-ctx {
    animation: none;
  }
}
</style>

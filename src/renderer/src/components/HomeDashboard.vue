<template>
  <section
    class="workbench-home"
    :style="homeWidgets.panelStyleVars"
    @contextmenu.prevent="openCanvasMenu"
  >
    <div class="home-shell">
      <header class="home-masthead">
        <div class="home-masthead__copy">
          <div class="home-masthead__eyebrow">
            <span class="home-masthead__eyebrow-mark" aria-hidden="true"></span>
            <span>TIDE DECK</span>
            <span class="home-masthead__dot" aria-hidden="true">·</span>
            <span>{{ dateLabel }}</span>
          </div>
          <h1 class="home-masthead__title">{{ greeting }}</h1>
          <p class="home-masthead__subtitle">把今天需要关注的事放在眼前。</p>
        </div>

        <div class="home-masthead__actions">
          <div class="home-masthead__status" aria-label="工作台状态">
            <span class="home-masthead__status-dot" aria-hidden="true"></span>
            <span>{{ homeWidgets.enabledWidgets.length }} 个组件</span>
            <span class="home-masthead__status-sep" aria-hidden="true"></span>
            <span>本地保存</span>
          </div>
          <button
            type="button"
            class="home-layout-trigger"
            aria-haspopup="menu"
            :aria-expanded="menu.open && menu.target === 'canvas'"
            @click="openLayoutMenu"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M4 7h10M18 7h2M4 12h2M10 12h10M4 17h7M15 17h5" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="8" cy="12" r="2" />
              <circle cx="13" cy="17" r="2" />
            </svg>
            <span>布局设置</span>
          </button>
        </div>
      </header>

      <div
        v-if="homeWidgets.enabledWidgets.length"
        ref="gridEl"
        class="home-grid"
        :class="{ 'is-dragging': draggingId }"
      >
        <div
          v-for="{ config, def } in homeWidgets.enabledWidgets"
          :key="config.id"
          class="home-widget"
          :class="{ 'is-dragging': draggingId === config.id }"
          :style="widgetStyle(config)"
          @contextmenu.prevent.stop="openWidgetMenu($event, config.id)"
        >
          <button
            type="button"
            class="home-widget__handle"
            :aria-label="`调整「${def.name}」的位置，打开组件菜单`"
            :title="`拖动调整位置，Enter 打开组件菜单`"
            aria-haspopup="menu"
            :aria-expanded="menu.open && menu.target === 'widget' && menu.widgetId === config.id"
            :aria-keyshortcuts="'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown'"
            @pointerdown="startDrag($event, config.id)"
            @click="onHandleClick($event, config.id)"
            @keydown="onHandleKeydown($event, config.id)"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <circle cx="9" cy="7" r="1.35" />
              <circle cx="15" cy="7" r="1.35" />
              <circle cx="9" cy="12" r="1.35" />
              <circle cx="15" cy="12" r="1.35" />
              <circle cx="9" cy="17" r="1.35" />
              <circle cx="15" cy="17" r="1.35" />
            </svg>
          </button>
          <component :is="def.component" />
        </div>

        <div
          v-if="dragPreview"
          class="home-drop-preview"
          :style="previewStyle"
          aria-hidden="true"
        />
      </div>

      <div v-else class="home-empty">
        <span class="home-empty__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3.5" y="4" width="7" height="7" rx="1.4" />
            <rect x="13.5" y="4" width="7" height="7" rx="1.4" />
            <rect x="3.5" y="14" width="7" height="7" rx="1.4" />
            <rect x="13.5" y="14" width="7" height="7" rx="1.4" />
          </svg>
        </span>
        <p class="home-empty__title">工作台暂时是空的</p>
        <p class="home-empty__text">在布局设置里重新显示需要的组件，或调整当前栅格密度。</p>
        <button type="button" class="home-layout-trigger" @click="openLayoutMenu">打开布局设置</button>
      </div>
    </div>

    <HomeContextMenu
      :open="menu.open"
      :x="menu.x"
      :y="menu.y"
      :target="menu.target"
      :widget-id="menu.widgetId"
      @close="closeMenu"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import HomeContextMenu from './HomeContextMenu.vue'
import { findFreeSlot } from '../lib/home-grid'
import {
  useHomeWidgetsStore,
  type HomeWidgetConfig,
  type HomeWidgetId
} from '../stores/home-widgets'

const homeWidgets = useHomeWidgetsStore()
const gridEl = ref<HTMLElement | null>(null)

const menu = ref({
  open: false,
  x: 0,
  y: 0,
  target: 'canvas' as 'canvas' | 'widget',
  widgetId: null as HomeWidgetId | null
})

const draggingId = ref<HomeWidgetId | null>(null)
const dragPreview = ref<{ col: number; row: number; colSpan: number; rowSpan: number } | null>(
  null
)

let activePointerId: number | null = null
let dragMoved = false
let dragStartX = 0
let dragStartY = 0
let suppressHandleClick: HomeWidgetId | null = null
let suppressClickTimer: ReturnType<typeof setTimeout> | null = null

const now = ref(new Date())
const clockTimer = window.setInterval(() => {
  now.value = new Date()
}, 60_000)

const dateLabel = computed(() => {
  const day = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(
    now.value
  )
  const weekday = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' }).format(now.value)
  return `${day} · ${weekday}`
})

const greeting = computed(() => {
  const hour = now.value.getHours()
  if (hour < 6) return '夜深了'
  if (hour < 9) return '早上好'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

function widgetStyle(config: HomeWidgetConfig) {
  return {
    gridColumn: `${config.col} / span ${config.colSpan}`,
    gridRow: `${config.row} / span ${config.rowSpan}`
  }
}

const previewStyle = computed(() => {
  if (!dragPreview.value) return {}
  const p = dragPreview.value
  return {
    gridColumn: `${p.col} / span ${p.colSpan}`,
    gridRow: `${p.row} / span ${p.rowSpan}`
  }
})

function openMenuAt(x: number, y: number, target: 'canvas' | 'widget', id: HomeWidgetId | null) {
  menu.value = { open: true, x, y, target, widgetId: id }
}

function openCanvasMenu(e?: MouseEvent) {
  openMenuAt(e?.clientX ?? 120, e?.clientY ?? 120, 'canvas', null)
}

function openLayoutMenu(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  openMenuAt(rect.right - 286, rect.bottom + 8, 'canvas', null)
}

function openWidgetMenu(e: MouseEvent, id: HomeWidgetId) {
  openMenuAt(e.clientX, e.clientY, 'widget', id)
}

function openWidgetMenuFromHandle(e: MouseEvent, id: HomeWidgetId) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  openMenuAt(rect.right - 286, rect.bottom + 8, 'widget', id)
}

function closeMenu() {
  menu.value.open = false
}

function onHandleClick(e: MouseEvent, id: HomeWidgetId) {
  if (suppressHandleClick === id) {
    suppressHandleClick = null
    return
  }
  openWidgetMenuFromHandle(e, id)
}

function moveWidget(id: HomeWidgetId, dx: number, dy: number) {
  const config = homeWidgets.allWidgets.find((w) => w.id === id)
  if (!config) return
  const maxCol = Math.max(1, homeWidgets.layout.columns - config.colSpan + 1)
  const col = Math.min(maxCol, Math.max(1, config.col + dx))
  const row = Math.max(1, config.row + dy)
  if (col === config.col && row === config.row) return
  homeWidgets.setPosition(id, col, row)
}

function onHandleKeydown(e: KeyboardEvent, id: HomeWidgetId) {
  if (!e.altKey) return
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
  }
  const offset = directions[e.key]
  if (!offset) return
  e.preventDefault()
  moveWidget(id, offset[0], offset[1])
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest('input, button, label, select, textarea, a, .time-input, .link-btn')
}

function cellFromPoint(clientX: number, clientY: number, colSpan: number, rowSpan: number) {
  const grid = gridEl.value
  if (!grid) return null

  const rect = grid.getBoundingClientRect()
  const { columns, gap } = homeWidgets.layout
  const styles = getComputedStyle(grid)
  const padL = parseFloat(styles.paddingLeft) || 0
  const padT = parseFloat(styles.paddingTop) || 0
  const innerW = rect.width - padL - (parseFloat(styles.paddingRight) || 0)
  const cellW = (innerW - gap * (columns - 1)) / columns
  const rowH = parseFloat(styles.getPropertyValue('--home-row-h')) || 128

  const x = clientX - rect.left - padL
  const y = clientY - rect.top - padT
  if (x < 0 || y < 0) return null

  const col = Math.floor(x / (cellW + gap)) + 1
  const row = Math.floor(y / (rowH + gap)) + 1
  const maxCol = Math.max(1, columns - colSpan + 1)

  return {
    col: Math.min(Math.max(1, col), maxCol),
    row: Math.max(1, row),
    colSpan,
    rowSpan
  }
}

function snapPreview(
  id: HomeWidgetId,
  col: number,
  row: number,
  colSpan: number,
  rowSpan: number
) {
  const current = homeWidgets.allWidgets.find((w) => w.id === id)
  if (!current) return { col, row, colSpan, rowSpan }

  const others = homeWidgets.enabledWidgets
    .filter((w) => w.config.id !== id)
    .map((w) => w.config)
  const slot = findFreeSlot(
    { ...current, colSpan, rowSpan, enabled: true },
    others,
    homeWidgets.layout.columns,
    { col, row }
  )
  return { col: slot.col, row: slot.row, colSpan, rowSpan }
}

function startDrag(e: PointerEvent, id: HomeWidgetId) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  if (isInteractiveTarget(e.target)) return
  const widget = homeWidgets.enabledWidgets.find((w) => w.config.id === id)
  if (!widget) return

  e.preventDefault()
  e.stopPropagation()
  closeMenu()

  draggingId.value = id
  dragMoved = false
  dragStartX = e.clientX
  dragStartY = e.clientY
  activePointerId = e.pointerId
  dragPreview.value = snapPreview(
    id,
    widget.config.col,
    widget.config.row,
    widget.config.colSpan,
    widget.config.rowSpan
  )

  const handle = e.currentTarget as HTMLElement
  handle.setPointerCapture(e.pointerId)

  handle.addEventListener('pointermove', onDragMove)
  handle.addEventListener('pointerup', onDragEnd)
  handle.addEventListener('pointercancel', onDragEnd)
}

function onDragMove(e: PointerEvent) {
  if (draggingId.value === null || e.pointerId !== activePointerId) return
  if (Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) > 4) {
    dragMoved = true
  }

  const widget = homeWidgets.enabledWidgets.find((w) => w.config.id === draggingId.value)
  if (!widget) return

  const cell = cellFromPoint(
    e.clientX,
    e.clientY,
    widget.config.colSpan,
    widget.config.rowSpan
  )
  if (cell) {
    dragPreview.value = snapPreview(
      widget.config.id,
      cell.col,
      cell.row,
      cell.colSpan,
      cell.rowSpan
    )
  }
}

function onDragEnd(e: PointerEvent) {
  if (e.pointerId !== activePointerId) return

  const handle = e.currentTarget as HTMLElement
  handle.removeEventListener('pointermove', onDragMove)
  handle.removeEventListener('pointerup', onDragEnd)
  handle.removeEventListener('pointercancel', onDragEnd)
  if (handle.hasPointerCapture(e.pointerId)) {
    handle.releasePointerCapture(e.pointerId)
  }

  if (dragMoved && draggingId.value && dragPreview.value) {
    homeWidgets.setPosition(
      draggingId.value,
      dragPreview.value.col,
      dragPreview.value.row
    )
    suppressHandleClick = draggingId.value
    if (suppressClickTimer) clearTimeout(suppressClickTimer)
    suppressClickTimer = setTimeout(() => {
      suppressHandleClick = null
      suppressClickTimer = null
    }, 0)
  }

  draggingId.value = null
  dragPreview.value = null
  activePointerId = null
}

onBeforeUnmount(() => {
  window.clearInterval(clockTimer)
  if (suppressClickTimer) clearTimeout(suppressClickTimer)
  draggingId.value = null
  dragPreview.value = null
})
</script>

<style scoped>
.workbench-home {
  position: absolute;
  inset: 0;
  min-height: 0;
  padding: 0;
  background: transparent;
  overflow: auto;
}

.home-shell {
  min-height: 100%;
  padding: 22px 24px 24px;
}

.home-masthead {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 2px 2px 20px;
}

.home-masthead::after {
  content: '';
  position: absolute;
  left: 2px;
  right: 2px;
  bottom: 10px;
  height: 1px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 42%, transparent),
    color-mix(in srgb, var(--border) 80%, transparent) 34%,
    transparent 84%
  );
}

.home-masthead__copy {
  min-width: 0;
  max-width: 680px;
}

.home-masthead__eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 9.5px;
  font-weight: 650;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.home-masthead__eyebrow-mark {
  width: 16px;
  height: 2px;
  border-radius: 999px;
  background: var(--accent);
}

.home-masthead__dot {
  color: color-mix(in srgb, var(--text-muted) 65%, transparent);
}

.home-masthead__title {
  margin: 0;
  font-size: clamp(27px, 2.5vw, 34px);
  font-weight: 650;
  line-height: 1.16;
  letter-spacing: -0.045em;
  color: var(--text);
}

.home-masthead__subtitle {
  max-width: 520px;
  margin: 7px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.home-masthead__actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  padding-bottom: 1px;
}

.home-masthead__status {
  height: 32px;
  padding: 0 11px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 10.5px;
  font-weight: 500;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--surface-raised) 66%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  white-space: nowrap;
}

.home-masthead__status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 14%, transparent);
}

.home-masthead__status-sep {
  width: 1px;
  height: 12px;
  background: color-mix(in srgb, var(--border) 88%, transparent);
}

.home-layout-trigger {
  height: 34px;
  padding: 0 12px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  font-weight: 550;
  color: var(--text);
  background: color-mix(in srgb, var(--surface-raised) 72%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #fff 12%, transparent),
    0 6px 18px color-mix(in srgb, var(--accent) 9%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  transition:
    color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease),
    background-color var(--dur-fast) var(--ease),
    box-shadow var(--dur-fast) var(--ease);
}

.home-layout-trigger:hover {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 48%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, var(--surface-raised));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, #fff 14%, transparent),
    0 8px 24px color-mix(in srgb, var(--accent) 14%, transparent);
}

.home-layout-trigger svg {
  flex-shrink: 0;
}

.home-grid {
  --home-row-h: 128px;
  position: relative;
  min-height: 1px;
  display: grid;
  grid-template-columns: repeat(var(--home-cols), minmax(0, 1fr));
  grid-auto-rows: minmax(var(--home-row-h), auto);
  gap: var(--home-gap);
  align-content: start;
}

.home-grid.is-dragging {
  user-select: none;
}

.home-widget {
  --home-handle-size: 24px;
  --home-handle-gap: 10px;
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.home-widget.is-dragging {
  opacity: 0.48;
}

.home-widget__handle {
  position: absolute;
  top: var(--home-handle-gap);
  right: var(--home-handle-gap);
  z-index: 3;
  width: var(--home-handle-size);
  height: var(--home-handle-size);
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--surface-raised) 54%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
  cursor: grab;
  opacity: 0.66;
  transition:
    opacity var(--dur-fast) var(--ease),
    color var(--dur-fast) var(--ease),
    background-color var(--dur-fast) var(--ease),
    border-color var(--dur-fast) var(--ease);
}

.home-widget:hover .home-widget__handle,
.home-widget.is-dragging .home-widget__handle,
.home-widget__handle:focus-visible {
  opacity: 1;
}

.home-widget__handle:hover {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 38%, transparent);
}

.home-widget__handle:active {
  cursor: grabbing;
}

.home-drop-preview {
  border-radius: var(--radius-list);
  border: 1px dashed color-mix(in srgb, var(--accent) 55%, transparent);
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent) 14%, transparent),
      color-mix(in srgb, var(--accent) 5%, transparent)
    );
  pointer-events: none;
  min-height: var(--home-row-h);
}

.home-empty {
  max-width: 440px;
  margin: 56px auto 0;
  padding: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  border-radius: var(--radius-list);
  border: 1px solid color-mix(in srgb, var(--border) 86%, transparent);
  background: color-mix(in srgb, var(--surface-raised) 68%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.home-empty__icon {
  width: 44px;
  height: 44px;
  margin-bottom: 14px;
  border-radius: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
}

.home-empty__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.home-empty__text {
  max-width: 330px;
  margin: 7px 0 17px;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--text-muted);
}

.home-widget :deep(.home-panel) {
  flex: 1 1 auto;
  min-height: 0;
}

@media (max-width: 980px) {
  .home-shell {
    padding: 18px 18px 20px;
  }

  .home-masthead {
    gap: 16px;
  }

  .home-masthead__status {
    display: none;
  }

  .home-masthead__title {
    font-size: 27px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-layout-trigger,
  .home-widget__handle {
    transition: none;
  }
}
</style>

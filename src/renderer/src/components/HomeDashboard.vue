<template>
  <section
    class="workbench-home"
    :style="homeWidgets.panelStyleVars"
    @contextmenu.prevent="openCanvasMenu"
  >
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
        <div
          class="home-widget__handle"
          title="拖动调整位置"
          @pointerdown="startDrag($event, config.id)"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
            <circle cx="9" cy="7" r="1.4" />
            <circle cx="15" cy="7" r="1.4" />
            <circle cx="9" cy="12" r="1.4" />
            <circle cx="15" cy="12" r="1.4" />
            <circle cx="9" cy="17" r="1.4" />
            <circle cx="15" cy="17" r="1.4" />
          </svg>
        </div>
        <component :is="def.component" />
      </div>

      <div
        v-if="dragPreview"
        class="home-drop-preview"
        :style="previewStyle"
        aria-hidden="true"
      />
    </div>

    <p v-else class="home-empty" @contextmenu.prevent="openCanvasMenu">
      首页暂无组件。右键此处打开布局设置。
    </p>

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

function openCanvasMenu(e?: MouseEvent) {
  menu.value = {
    open: true,
    x: e?.clientX ?? 120,
    y: e?.clientY ?? 120,
    target: 'canvas',
    widgetId: null
  }
}

function openWidgetMenu(e: MouseEvent, id: HomeWidgetId) {
  menu.value = {
    open: true,
    x: e.clientX,
    y: e.clientY,
    target: 'widget',
    widgetId: id
  }
}

function closeMenu() {
  menu.value.open = false
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
  const rowH = 148

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

function startDrag(e: PointerEvent, id: HomeWidgetId) {
  if (isInteractiveTarget(e.target)) return
  const widget = homeWidgets.enabledWidgets.find((w) => w.config.id === id)
  if (!widget) return

  e.preventDefault()
  e.stopPropagation()
  closeMenu()

  draggingId.value = id
  activePointerId = e.pointerId
  dragPreview.value = {
    col: widget.config.col,
    row: widget.config.row,
    colSpan: widget.config.colSpan,
    rowSpan: widget.config.rowSpan
  }

  const handle = e.currentTarget as HTMLElement
  handle.setPointerCapture(e.pointerId)

  handle.addEventListener('pointermove', onDragMove)
  handle.addEventListener('pointerup', onDragEnd)
  handle.addEventListener('pointercancel', onDragEnd)
}

function onDragMove(e: PointerEvent) {
  if (draggingId.value === null || e.pointerId !== activePointerId) return
  const widget = homeWidgets.enabledWidgets.find((w) => w.config.id === draggingId.value)
  if (!widget) return

  const cell = cellFromPoint(
    e.clientX,
    e.clientY,
    widget.config.colSpan,
    widget.config.rowSpan
  )
  if (cell) dragPreview.value = cell
}

function onDragEnd(e: PointerEvent) {
  if (e.pointerId !== activePointerId) return

  const handle = e.currentTarget as HTMLElement
  handle.removeEventListener('pointermove', onDragMove)
  handle.removeEventListener('pointerup', onDragEnd)
  handle.removeEventListener('pointercancel', onDragEnd)
  handle.releasePointerCapture(e.pointerId)

  if (draggingId.value && dragPreview.value) {
    homeWidgets.setPosition(
      draggingId.value,
      dragPreview.value.col,
      dragPreview.value.row
    )
  }

  draggingId.value = null
  dragPreview.value = null
  activePointerId = null
}

onBeforeUnmount(() => {
  draggingId.value = null
  dragPreview.value = null
})
</script>

<style scoped>
.workbench-home {
  position: absolute;
  inset: 0;
  min-height: 0;
  padding: 12px 16px;
  background: transparent;
  overflow: auto;
}

.home-grid {
  --home-row-h: 148px;
  position: relative;
  min-height: 100%;
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
  position: relative;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.home-widget.is-dragging {
  opacity: 0.45;
}

.home-widget__handle {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--surface-raised) 55%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  cursor: grab;
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease), background var(--dur-fast) var(--ease);
}

.home-widget:hover .home-widget__handle,
.home-widget.is-dragging .home-widget__handle {
  opacity: 1;
}

.home-widget__handle:active {
  cursor: grabbing;
}

.home-drop-preview {
  border-radius: var(--radius-list);
  border: 1px dashed color-mix(in srgb, var(--accent) 55%, transparent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  pointer-events: none;
  min-height: var(--home-row-h);
}

.home-empty {
  margin: 0;
  padding: 8px 4px;
  font-size: var(--text-sm);
  color: var(--text-muted);
  line-height: 1.5;
}

.home-widget :deep(.home-panel) {
  flex: 1 1 auto;
  min-height: 0;
}
</style>

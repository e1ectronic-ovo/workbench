<template>
  <div class="home-panel notes">
    <div class="panel-head">
      <span class="panel-title">
        便签
        <span v-if="notes.pendingCount" class="panel-count">{{ notes.pendingCount }}</span>
      </span>
      <div class="panel-actions">
        <button
          v-if="notes.doneCount"
          type="button"
          class="link-btn link-btn--quiet"
          :title="`清除 ${notes.doneCount} 条已完成`"
          @click="notes.clearDone()"
        >
          清除已完成
        </button>
        <button
          type="button"
          class="link-btn"
          :disabled="!notes.canAdd"
          :title="notes.canAdd ? '新建一条便签（Ctrl+Enter）' : `最多 ${MAX_NOTES} 条`"
          @click="addAndFocus"
        >
          新建
        </button>
      </div>
    </div>

    <TransitionGroup
      v-if="notes.notes.length"
      tag="ul"
      name="note"
      class="notes-list"
    >
      <li
        v-for="note in sortedNotes"
        :key="note.id"
        class="notes-item"
        :class="{
          'is-done': note.done,
          'is-dragging': dragId === note.id,
          'is-drop-target': dropId === note.id && dragId !== note.id
        }"
        @dragover.prevent="onDragOver(note)"
        @drop.prevent="onDrop(note)"
      >
        <span
          v-if="note.color"
          class="notes-stripe"
          :style="{ background: colorValue(note.color) }"
          aria-hidden="true"
        />

        <span
          v-if="!note.done"
          class="notes-grip"
          draggable="true"
          title="拖动排序"
          @dragstart="onDragStart($event, note)"
          @dragend="onDragEnd"
        >
          <svg viewBox="0 0 10 16" width="8" height="13" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="4" r="1.1" />
            <circle cx="7" cy="4" r="1.1" />
            <circle cx="3" cy="8" r="1.1" />
            <circle cx="7" cy="8" r="1.1" />
            <circle cx="3" cy="12" r="1.1" />
            <circle cx="7" cy="12" r="1.1" />
          </svg>
        </span>
        <span v-else class="notes-grip notes-grip--placeholder" aria-hidden="true" />

        <button
          type="button"
          class="notes-check"
          :class="{ 'is-done': note.done }"
          :aria-pressed="note.done"
          :aria-label="note.done ? '标记为未完成' : '标记为已完成'"
          :title="note.done ? '标记为未完成' : '标记为已完成'"
          @click="notes.toggleDone(note.id)"
        >
          <svg
            v-if="note.done"
            viewBox="0 0 24 24"
            width="9"
            height="9"
            fill="none"
            stroke="currentColor"
            stroke-width="3.4"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
        </button>

        <textarea
          :ref="(el) => bindTextarea(note.id, el)"
          class="notes-input"
          :data-note-id="note.id"
          :value="note.text"
          rows="1"
          maxlength="200"
          placeholder="写一句…"
          :title="noteTitle(note)"
          @input="onInput(note.id, $event)"
          @keydown="onKeydown($event)"
        />

        <button
          type="button"
          class="notes-more"
          :class="{ 'has-remind': note.remindAt }"
          :title="note.remindAt ? `已设提醒：${formatRemind(note.remindAt)}` : '颜色 / 提醒'"
          @click="openMenu(note, $event)"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
        </button>

        <button
          type="button"
          class="mac-icon-btn notes-remove"
          aria-label="删除这条便签"
          title="删除"
          @click="notes.removeNote(note.id)"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </li>
    </TransitionGroup>

    <div v-else class="notes-empty">
      <p class="notes-empty__text">记下要带的东西、待回的话。关掉网页也还在。</p>
      <button type="button" class="mac-btn mac-btn--primary" @click="addAndFocus">
        写一条
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="menuOpen"
        class="notes-popover"
        :style="{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }"
      >
        <div class="popover-row">
          <span class="popover-label">颜色</span>
          <div class="popover-colors">
            <button
              v-for="c in NOTE_COLORS"
              :key="c.id"
              type="button"
              class="popover-color"
              :class="{ 'is-active': menuNote?.color === c.id }"
              :style="{ background: c.value }"
              :title="c.label"
              :aria-label="`标记为${c.label}色`"
              @click="pickColor(c.id)"
            />
            <button
              type="button"
              class="popover-color popover-color--none"
              :class="{ 'is-active': !menuNote?.color }"
              title="不标记"
              @click="pickColor(null)"
            >
              无
            </button>
          </div>
        </div>

        <div class="popover-row">
          <span class="popover-label">提醒</span>
          <input v-model="menuRemind" type="datetime-local" class="popover-time" />
        </div>

        <p v-if="menuError" class="popover-error">{{ menuError }}</p>

        <div class="popover-actions">
          <button
            v-if="menuNote?.remindAt"
            type="button"
            class="link-btn"
            @click="clearRemind"
          >
            清除提醒
          </button>
          <button type="button" class="mac-btn mac-btn--primary popover-ok" @click="applyRemind">
            确定
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  MAX_NOTES,
  NOTE_COLORS,
  useNotesStore,
  type HomeNote,
  type NoteColor
} from '../stores/notes'

const notes = useNotesStore()

/** 未完成的排前面，已完成的沉底；同组内按数组顺序（拖拽改的就是它） */
const sortedNotes = computed(() => [
  ...notes.notes.filter((note) => !note.done),
  ...notes.notes.filter((note) => note.done)
])

function colorValue(color: NoteColor): string {
  return NOTE_COLORS.find((c) => c.id === color)?.value ?? 'transparent'
}

function formatRemind(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function noteTitle(note: HomeNote): string {
  const d = new Date(note.updatedAt)
  const label = d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const remind = note.remindAt ? ` · ${formatRemind(note.remindAt)} 提醒` : ''
  return `${note.done ? '已完成' : '最后修改'} · ${label}${remind}`
}

function onInput(id: string, e: Event) {
  const el = e.target as HTMLTextAreaElement
  notes.setText(id, el.value)
  autoGrow(el)
}

/** Enter 换行，Ctrl/Cmd+Enter 另起一条 */
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter') return
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  void addAndFocus()
}

/* ── 多行自动增高 ── */

const MIN_TA_HEIGHT = 28
const MAX_TA_HEIGHT = 62
const textareas = new Map<string, HTMLTextAreaElement>()

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  const next = Math.min(Math.max(el.scrollHeight, MIN_TA_HEIGHT), MAX_TA_HEIGHT)
  el.style.height = `${next}px`
  el.style.overflowY = el.scrollHeight > MAX_TA_HEIGHT ? 'auto' : 'hidden'
}

/**
 * 面板用 v-show 收起时 scrollHeight 是 0，多行便签会被压成一行高度。
 * 等它真正出现在视口里再量一次，切走再回来也不会塌。
 */
const growthObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.target instanceof HTMLTextAreaElement) {
        autoGrow(entry.target)
      }
    }
  },
  { threshold: 0 }
)

function bindTextarea(id: string, el: unknown) {
  const prev = textareas.get(id)
  if (el instanceof HTMLTextAreaElement) {
    textareas.set(id, el)
    growthObserver.observe(el)
    autoGrow(el)
  } else {
    if (prev) growthObserver.unobserve(prev)
    if (textareas.get(id) === prev) textareas.delete(id)
  }
}

async function addAndFocus() {
  const id = notes.addNote()
  if (!id) return
  await nextTick()
  const el = document.querySelector<HTMLTextAreaElement>(`[data-note-id="${id}"]`)
  el?.focus()
  const end = el?.value.length ?? 0
  el?.setSelectionRange(end, end)
}

/* ── 拖拽排序 ── */

const dragId = ref<string | null>(null)
const dropId = ref<string | null>(null)

function onDragStart(e: DragEvent, note: HomeNote) {
  // 拖起来之后顺序会变，弹层还锚在原来那条上就会错位
  closeMenu()
  dragId.value = note.id
  dropId.value = null
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', note.id)
    const li = (e.currentTarget as HTMLElement).closest('.notes-item')
    if (li) e.dataTransfer.setDragImage(li as HTMLElement, 12, 12)
  }
}

function onDragOver(note: HomeNote) {
  if (!dragId.value) return
  dropId.value = note.id
}

function onDrop(note: HomeNote) {
  const from = dragId.value
  dragId.value = null
  dropId.value = null
  if (from && from !== note.id) notes.moveNote(from, note.id)
}

function onDragEnd() {
  dragId.value = null
  dropId.value = null
}

/* ── 颜色 / 提醒 弹出层 ── */

const menuOpen = ref(false)
const menuNoteId = ref<string | null>(null)
const menuRemind = ref('')
const menuError = ref('')
const menuPos = ref({ top: 0, left: 0 })
const MENU_WIDTH = 218

const menuNote = computed(() => notes.notes.find((note) => note.id === menuNoteId.value) ?? null)

function tsToInput(ts: number | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function inputToTs(value: string): number | null {
  if (!value) return null
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : null
}

function openMenu(note: HomeNote, e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  menuNoteId.value = note.id
  menuRemind.value = tsToInput(note.remindAt)
  menuError.value = ''
  menuPos.value = {
    top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 176)),
    left: Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8))
  }
  menuOpen.value = true
}

function closeMenu() {
  menuOpen.value = false
  menuError.value = ''
}

function pickColor(color: NoteColor | null) {
  const note = menuNote.value
  if (!note) return
  notes.setColor(note.id, note.color === color ? null : color)
}

function applyRemind() {
  const note = menuNote.value
  if (!note) return
  const ts = inputToTs(menuRemind.value)
  if (ts === null) {
    menuError.value = '先选一个时间'
    return
  }
  if (ts <= Date.now()) {
    menuError.value = '时间已经过去了'
    return
  }
  notes.setRemindAt(note.id, ts)
  closeMenu()
}

function clearRemind() {
  const note = menuNote.value
  if (!note) return
  notes.setRemindAt(note.id, null)
  menuRemind.value = ''
  closeMenu()
}

function onDocPointerDown(e: MouseEvent) {
  if (!menuOpen.value) return
  const el = e.target as HTMLElement | null
  if (!el) return
  if (el.closest('.notes-popover') || el.closest('.notes-more')) return
  closeMenu()
}

/** 面板在滚动容器里，一滚位置就飘了，直接关掉 */
function onAnyScroll() {
  if (menuOpen.value) closeMenu()
}

/* ── 提醒同步 ── */

let offFired: (() => void) | undefined

watch(
  () => notes.notes.map((note) => `${note.id}:${note.remindAt ?? 0}`).join('|'),
  () => {
    void notes.syncReminders()
  },
  { immediate: true }
)

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true)
  window.addEventListener('scroll', onAnyScroll, true)
  window.addEventListener('resize', onAnyScroll)
  // 首屏先量一次，别等 IntersectionObserver 回调（否则多行便签会先塌成一行再跳开）
  void nextTick(() => textareas.forEach((el) => autoGrow(el)))
  // 便签提醒弹过之后把时间清掉，避免下次同步又排一遍
  offFired = window.workbench.onReminderFired(({ key }) => {
    if (!key || !key.startsWith('note:')) return
    const id = key.slice('note:'.length)
    if (notes.notes.some((note) => note.id === id)) notes.setRemindAt(id, null)
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  window.removeEventListener('scroll', onAnyScroll, true)
  window.removeEventListener('resize', onAnyScroll)
  growthObserver.disconnect()
  offFired?.()
})
</script>

<style scoped>
.notes {
  display: flex;
  flex-direction: column;
  /* 面板跨两行，超出的部分在列表里滚动，别把整个网格撑高 */
  max-height: calc(var(--home-row-h, 148px) * 2);
  min-height: 0;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: 8px;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.panel-count {
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.notes-list {
  margin: 0 -4px 0 0;
  padding: 0 4px 0 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.notes-list::-webkit-scrollbar {
  width: 6px;
}

.notes-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 30%, transparent);
}

.notes-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding-left: 6px;
  border-radius: var(--radius-md);
}

.notes-item.is-dragging {
  opacity: 0.45;
}

.notes-item.is-drop-target::before {
  content: '';
  position: absolute;
  left: 6px;
  right: 0;
  top: -3px;
  height: 2px;
  border-radius: 999px;
  background: var(--accent);
}

/* 勾一下，条目换个位置时带点位移过渡，不然会突然跳 */
.note-move {
  transition: transform 0.18s var(--ease);
}

.notes-stripe {
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  border-radius: 999px;
}

.notes-grip {
  flex-shrink: 0;
  width: 10px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  opacity: 0;
  cursor: grab;
  transition: opacity 0.15s var(--ease);
}

.notes-item:hover .notes-grip:not(.notes-grip--placeholder) {
  opacity: 0.5;
}

.notes-grip:active {
  cursor: grabbing;
}

.notes-grip--placeholder {
  cursor: default;
}

.notes-check {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  margin-top: 6.5px;
  padding: 0;
  border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, var(--text-muted) 45%, transparent);
  background: transparent;
  color: var(--on-accent, #fff);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    border-color 0.15s var(--ease),
    background-color 0.15s var(--ease);
}

.notes-check:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.notes-check.is-done {
  border-color: var(--accent);
  background: var(--accent);
}

.notes-input {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 28px;
  max-height: 62px;
  padding: 5px 8px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: color-mix(in srgb, var(--surface-hover) 70%, transparent);
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
  line-height: 18px;
  resize: none;
  overflow-y: hidden;
  transition:
    background-color 0.15s var(--ease),
    color 0.15s var(--ease);
}

.notes-input:focus {
  border-color: var(--border-focus);
  outline: none;
  background: var(--bg);
}

.notes-item.is-done .notes-input {
  text-decoration: line-through;
  text-decoration-thickness: 1px;
  color: var(--text-muted);
  opacity: 0.7;
}

.notes-more {
  flex-shrink: 0;
  width: 20px;
  height: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s var(--ease);
}

.notes-item:hover .notes-more,
.notes-more:focus-visible,
.notes-more.has-remind {
  opacity: 0.75;
}

.notes-more:hover {
  opacity: 1;
  color: var(--accent);
}

.notes-more.has-remind {
  color: var(--accent);
}

.notes-remove {
  flex-shrink: 0;
  width: 20px;
  height: 28px;
  opacity: 0;
  transition: opacity 0.15s var(--ease);
}

.notes-item:hover .notes-remove,
.notes-remove:focus-visible {
  opacity: 0.55;
}

.notes-item:hover .notes-remove:hover {
  opacity: 1;
}

.notes-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0 2px;
}

.notes-empty__text {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-muted);
}

.link-btn {
  font-size: 12px;
  color: var(--text-muted);
  padding: 2px 6px;
  border-radius: 4px;
}

.link-btn:hover:not(:disabled) {
  color: var(--accent);
  background: var(--surface-hover);
}

.link-btn:disabled {
  opacity: 0.4;
}

.link-btn--quiet {
  font-size: 11px;
  color: var(--text-tertiary, var(--text-muted));
  opacity: 0.85;
}

/* ── 颜色 / 提醒 弹出层 ── */

.notes-popover {
  position: fixed;
  z-index: 1200;
  width: 218px;
  padding: 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--surface, var(--bg));
  box-shadow: 0 12px 32px rgb(0 0 0 / 32%);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.popover-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.popover-label {
  flex-shrink: 0;
  width: 26px;
  font-size: 11px;
  color: var(--text-muted);
}

.popover-colors {
  display: flex;
  align-items: center;
  gap: 6px;
}

.popover-color {
  width: 16px;
  height: 16px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.12s var(--ease);
}

.popover-color:hover {
  transform: scale(1.12);
}

.popover-color.is-active {
  border-color: var(--text);
  box-shadow: 0 0 0 2px var(--surface, var(--bg));
}

.popover-color--none {
  width: auto;
  height: 16px;
  padding: 0 5px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 14px;
}

.popover-color--none.is-active {
  border-color: var(--text);
  color: var(--text);
}

.popover-time {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 6px;
  border-radius: var(--radius-sm, 6px);
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 11px;
  font-family: var(--font-mono);
}

.popover-error {
  margin: 0;
  font-size: 11px;
  color: #ef4444;
}

.popover-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.popover-ok {
  margin-left: auto;
  height: 26px;
  padding: 0 12px;
  font-size: 12px;
}
</style>

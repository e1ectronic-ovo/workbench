import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { attendanceDateKey } from './attendance'

export type NoteColor = 'red' | 'amber' | 'green' | 'blue'

export const NOTE_COLORS: { id: NoteColor; label: string; value: string }[] = [
  { id: 'red', label: '红', value: '#ef4444' },
  { id: 'amber', label: '橙', value: '#f59e0b' },
  { id: 'green', label: '绿', value: '#22c55e' },
  { id: 'blue', label: '蓝', value: '#3b82f6' }
]

export interface HomeNote {
  id: string
  text: string
  /** 勾掉之后文字划线、变淡，并自动沉到列表底部 */
  done: boolean
  /** 左侧竖条的颜色，null 表示没标记 */
  color: NoteColor | null
  /** 到点弹系统通知；null 表示没设提醒。触发后会被清空 */
  remindAt: number | null
  updatedAt: number
}

const STORAGE_KEY = 'workbench.notes'
export const MAX_NOTES = 8

/** 主进程按 `note:<id>` 分辨是哪条便签的提醒 */
export function noteReminderKey(id: string): string {
  return `note:${id}`
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isNoteColor(value: unknown): value is NoteColor {
  return value === 'red' || value === 'amber' || value === 'green' || value === 'blue'
}

function loadNotes(): HomeNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data
      .filter((item): item is HomeNote => {
        if (!item || typeof item !== 'object') return false
        const note = item as Record<string, unknown>
        return typeof note.id === 'string' && typeof note.text === 'string'
      })
      .slice(0, MAX_NOTES)
      .map((note) => ({
        id: note.id,
        text: note.text,
        // 老数据没有这些字段，按「未完成 / 无色 / 无提醒」处理
        done: note.done === true,
        color: isNoteColor(note.color) ? note.color : null,
        remindAt:
          typeof note.remindAt === 'number' && Number.isFinite(note.remindAt) && note.remindAt > 0
            ? note.remindAt
            : null,
        updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : Date.now()
      }))
  } catch {
    return []
  }
}

/** 已经排进主进程的提醒 key，用来清掉那些便签已经删了的定时器 */
const scheduledKeys = new Set<string>()

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<HomeNote[]>(loadNotes())

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.value))
    } catch {
      /* ignore */
    }
  }

  function patch(id: string, next: Partial<HomeNote>) {
    notes.value = notes.value.map((note) => (note.id === id ? { ...note, ...next } : note))
    persist()
  }

  function addNote() {
    if (notes.value.length >= MAX_NOTES) return null
    const empty = notes.value.find((note) => !note.text.trim())
    if (empty) {
      // 复用空白便签时顺手把它从「已完成」里放出来，别让新建出来就是划掉的
      if (empty.done) patch(empty.id, { done: false })
      return empty.id
    }
    const next: HomeNote = {
      id: createId(),
      text: '',
      done: false,
      color: null,
      remindAt: null,
      updatedAt: Date.now()
    }
    notes.value = [next, ...notes.value]
    persist()
    return next.id
  }

  function setText(id: string, text: string) {
    patch(id, { text, updatedAt: Date.now() })
  }

  function removeNote(id: string) {
    notes.value = notes.value.filter((note) => note.id !== id)
    persist()
    // 定时器立刻撤掉，别等下一次 sync
    const key = noteReminderKey(id)
    if (scheduledKeys.delete(key)) void window.workbench.clearReminder(key)
  }

  /** 勾选 / 取消勾选；顺手刷新 updatedAt，hover 提示能看出什么时候划掉的 */
  function toggleDone(id: string) {
    const note = notes.value.find((item) => item.id === id)
    if (!note) return
    patch(id, { done: !note.done, updatedAt: Date.now() })
  }

  /** 清掉所有已完成的便签 */
  function clearDone() {
    const done = notes.value.filter((note) => note.done)
    if (!done.length) return
    notes.value = notes.value.filter((note) => !note.done)
    persist()
    done.forEach((note) => {
      const key = noteReminderKey(note.id)
      if (scheduledKeys.delete(key)) void window.workbench.clearReminder(key)
    })
  }

  function setColor(id: string, color: NoteColor | null) {
    patch(id, { color })
  }

  function setRemindAt(id: string, at: number | null) {
    patch(id, { remindAt: at, updatedAt: Date.now() })
  }

  /** 拖拽排序：把 dragId 挪到 targetId 的位置（已完成项也会被跳过，只影响组内相对顺序） */
  function moveNote(dragId: string, targetId: string) {
    if (dragId === targetId) return
    const list = [...notes.value]
    const from = list.findIndex((note) => note.id === dragId)
    if (from < 0) return
    const [moved] = list.splice(from, 1)
    const to = list.findIndex((note) => note.id === targetId)
    if (to < 0) {
      list.splice(from, 0, moved)
      return
    }
    list.splice(to, 0, moved)
    notes.value = list
    persist()
  }

  /**
   * 把带提醒的便签排进主进程，并撤掉已经不需要的定时器。
   * 每条便签一个 key，互不覆盖，也不会顶掉下班提醒。
   */
  async function syncReminders() {
    const wanted = new Set<string>()
    const now = Date.now()

    for (const note of notes.value) {
      const at = note.remindAt
      if (!at || at <= now) continue
      const key = noteReminderKey(note.id)
      wanted.add(key)
      await window.workbench.syncReminder(
        {
          enabled: true,
          fireAt: new Date(at).toISOString(),
          dateKey: attendanceDateKey(new Date(at)),
          title: '便签提醒',
          body: note.text.trim().slice(0, 80) || '这条便签到点了'
        },
        key
      )
    }

    for (const key of [...scheduledKeys]) {
      if (!wanted.has(key)) {
        scheduledKeys.delete(key)
        await window.workbench.clearReminder(key)
      }
    }
    wanted.forEach((key) => scheduledKeys.add(key))
  }

  const canAdd = computed(() => notes.value.length < MAX_NOTES)
  const doneCount = computed(() => notes.value.filter((note) => note.done).length)
  const pendingCount = computed(() => notes.value.length - doneCount.value)

  return {
    notes,
    canAdd,
    doneCount,
    pendingCount,
    addNote,
    setText,
    removeNote,
    toggleDone,
    clearDone,
    setColor,
    setRemindAt,
    moveNote,
    syncReminders
  }
})

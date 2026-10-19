import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface HomeNote {
  id: string
  text: string
  updatedAt: number
}

const STORAGE_KEY = 'workbench.notes'
export const MAX_NOTES = 8

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`
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
        updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : Date.now()
      }))
  } catch {
    return []
  }
}

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<HomeNote[]>(loadNotes())

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes.value))
    } catch {
      /* ignore */
    }
  }

  function addNote() {
    if (notes.value.length >= MAX_NOTES) return null
    const empty = notes.value.find((note) => !note.text.trim())
    if (empty) return empty.id
    const next: HomeNote = { id: createId(), text: '', updatedAt: Date.now() }
    notes.value = [next, ...notes.value]
    persist()
    return next.id
  }

  function setText(id: string, text: string) {
    notes.value = notes.value.map((note) =>
      note.id === id ? { ...note, text, updatedAt: Date.now() } : note
    )
    persist()
  }

  function removeNote(id: string) {
    notes.value = notes.value.filter((note) => note.id !== id)
    persist()
  }

  const canAdd = computed(() => notes.value.length < MAX_NOTES)

  return {
    notes,
    canAdd,
    addNote,
    setText,
    removeNote
  }
})

<template>
  <div class="home-panel notes">
    <div class="panel-head">
      <span class="panel-title">便签</span>
      <button
        type="button"
        class="link-btn"
        :disabled="!notes.canAdd"
        @click="addAndFocus"
      >
        新建
      </button>
    </div>

    <ul v-if="notes.notes.length" class="notes-list">
      <li v-for="note in notes.notes" :key="note.id" class="notes-item">
        <input
          class="notes-input"
          :data-note-id="note.id"
          :value="note.text"
          maxlength="120"
          placeholder="写一句…"
          @input="onInput(note.id, $event)"
          @keydown.enter.prevent="addAndFocus"
        />
        <button
          type="button"
          class="mac-icon-btn notes-remove"
          aria-label="删除这条便签"
          @click="notes.removeNote(note.id)"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </li>
    </ul>

    <div v-else class="notes-empty">
      <p class="notes-empty__text">记下要带的东西、待回的话。关掉网页也还在。</p>
      <button type="button" class="mac-btn mac-btn--primary" @click="addAndFocus">
        写一条
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick } from 'vue'
import { useNotesStore } from '../stores/notes'

const notes = useNotesStore()

function onInput(id: string, e: Event) {
  notes.setText(id, (e.target as HTMLInputElement).value)
}

async function addAndFocus() {
  const id = notes.addNote()
  if (!id) return
  await nextTick()
  const el = document.querySelector<HTMLInputElement>(`[data-note-id="${id}"]`)
  el?.focus()
}
</script>

<style scoped>
.panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: 8px;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.notes-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notes-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.notes-input {
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: color-mix(in srgb, var(--surface-hover) 70%, transparent);
  color: var(--text);
  font-size: 12px;
}

.notes-input:focus {
  border-color: var(--border-focus);
  outline: none;
  background: var(--bg);
}

.notes-remove {
  width: 24px;
  height: 24px;
  opacity: 0.55;
}

.notes-item:hover .notes-remove,
.notes-remove:focus-visible {
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
</style>

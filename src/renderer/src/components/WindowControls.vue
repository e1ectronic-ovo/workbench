<template>
  <div class="traffic-lights" role="group" aria-label="窗口控制">
    <button
      type="button"
      class="light close"
      title="关闭"
      aria-label="关闭"
      @click="close"
    >
      <svg viewBox="0 0 12 12" width="6" height="6" aria-hidden="true">
        <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      </svg>
    </button>
    <button
      type="button"
      class="light minimize"
      title="最小化"
      aria-label="最小化"
      @click="minimize"
    >
      <svg viewBox="0 0 12 12" width="8" height="8" aria-hidden="true">
        <path d="M2 6h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      </svg>
    </button>
    <button
      type="button"
      class="light maximize"
      :title="maximized ? '还原' : '最大化'"
      :aria-label="maximized ? '还原' : '最大化'"
      @click="toggleMaximize"
    >
      <svg v-if="!maximized" viewBox="0 0 12 12" width="7" height="7" aria-hidden="true">
        <path d="M2.5 4.5V9.5H7.5V4.5H2.5Z" stroke="currentColor" stroke-width="1.2" fill="none" />
        <path d="M4.5 2.5H9.5V7.5" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" />
      </svg>
      <svg v-else viewBox="0 0 12 12" width="8" height="8" aria-hidden="true">
        <path d="M3.5 5V3.5H5M7 3.5H8.5V5M8.5 7V8.5H7M5 8.5H3.5V7" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const maximized = ref(false)

let offMaximized: (() => void) | undefined

onMounted(async () => {
  try {
    maximized.value = await window.workbench.isMaximized()
    offMaximized = window.workbench.onMaximized((max) => {
      maximized.value = max
    })
  } catch {
    /* ignore */
  }
})

onBeforeUnmount(() => {
  offMaximized?.()
})

function close() {
  void window.workbench.closeWindow()
}

function minimize() {
  void window.workbench.minimizeWindow()
}

function toggleMaximize() {
  void window.workbench.maximizeWindow()
}
</script>

<style scoped>
.traffic-lights {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.light {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  transition: color 120ms ease, filter 120ms ease;
}

.light svg {
  opacity: 0;
  transition: opacity 120ms ease;
}

.traffic-lights:hover .light svg {
  opacity: 1;
}

.close {
  background: #ff5f57;
}

.minimize {
  background: #febc2e;
}

.maximize {
  background: #28c840;
}

.close:hover { color: #4d0000; }
.minimize:hover { color: #5c4800; }
.maximize:hover { color: #003d0f; }

.light:active {
  filter: brightness(0.92);
}
</style>

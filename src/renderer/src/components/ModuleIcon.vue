<template>
  <span class="module-icon" :class="variant" :style="styleVars">
    <img
      v-if="showImage"
      :key="currentSrc"
      :src="currentSrc!"
      alt=""
      class="img"
      @error="onError"
    />
    <svg
      v-else
      class="fallback"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18" />
      <path d="M12 3a15 15 0 0 0 0 18" />
    </svg>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { buildFaviconCandidates } from '../lib/favicon'
import type { ModuleConfig } from '../modules/registry'

const props = withDefaults(
  defineProps<{
    module: ModuleConfig
    color?: string
    variant?: 'nav' | 'list' | 'default'
  }>(),
  { variant: 'default' }
)

const candidateIndex = ref(0)
const iconPathUrl = ref<string | null>(null)

const candidates = computed(() => {
  const list: string[] = []
  if (iconPathUrl.value) list.push(iconPathUrl.value)
  list.push(...buildFaviconCandidates(props.module.url))
  return list
})

const showImage = computed(() => candidateIndex.value < candidates.value.length)
const currentSrc = computed(() => candidates.value[candidateIndex.value] ?? null)

const brand = computed(() => props.color || props.module.color)

const styleVars = computed(() => {
  if (props.variant === 'nav') return {}
  return { '--brand': brand.value }
})

function resetCandidates() {
  candidateIndex.value = 0
}

async function resolveIconPath(path?: string) {
  if (!path) {
    iconPathUrl.value = null
    return
  }
  try {
    iconPathUrl.value = await window.workbench.iconFileUrl(path)
  } catch {
    iconPathUrl.value = null
  }
}

watch(
  () => [props.module.url, props.module.iconPath, iconPathUrl.value],
  () => resetCandidates()
)

watch(
  () => props.module.iconPath,
  (path) => void resolveIconPath(path),
  { immediate: true }
)

function onError() {
  candidateIndex.value++
}

defineExpose({ hasImage: computed(() => showImage.value) })
</script>

<style scoped>
.module-icon {
  --brand: var(--accent);
  width: 100%;
  height: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  overflow: hidden;
}

.img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.fallback {
  width: 72%;
  height: 72%;
  color: var(--text-muted);
  flex-shrink: 0;
}

.module-icon.nav .fallback {
  color: currentColor;
  opacity: 0.72;
}
</style>

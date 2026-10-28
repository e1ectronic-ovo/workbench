<template>
  <div class="scene-skin" :class="variant" aria-hidden="true">
    <img class="scene-skin__bg" :src="bgSrc" alt="" decoding="async" />

    <template v-if="isMaid">
      <img class="scene-skin__ribbon" :src="workspaceRibbon" alt="" decoding="async" />
      <img class="scene-skin__corner" :src="sidebarCorner" alt="" decoding="async" />
      <img class="scene-skin__crest" :src="bottomCrest" alt="" decoding="async" />
    </template>

    <img
      v-if="isOrca"
      class="scene-skin__sidebar-art"
      :src="orcaSidebarArt"
      alt=""
      decoding="async"
    />

    <div v-if="isMaid" class="scene-skin__stage">
      <img class="scene-skin__maid scene-skin__maid--left" :src="maidLeft" alt="" />
      <img class="scene-skin__maid scene-skin__maid--right" :src="maidRight" alt="" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SceneThemeId } from '../stores/settings'
import palaceDay from '../assets/maid-atelier/palace-day.webp'
import palaceNight from '../assets/maid-atelier/palace-night.webp'
import maidLeft from '../assets/maid-atelier/maid-left.webp'
import maidRight from '../assets/maid-atelier/maid-right.webp'
import workspaceRibbon from '../assets/maid-atelier/workspace-ribbon.webp'
import sidebarCorner from '../assets/maid-atelier/sidebar-corner.webp'
import bottomCrest from '../assets/maid-atelier/bottom-crest.webp'
import orcaSceneLight from '../assets/orca-link/scene-light.webp'
import orcaSceneDark from '../assets/orca-link/scene-dark.webp'
import orcaSidebarArt from '../assets/orca-link/sidebar-art.webp'

const props = defineProps<{
  variant: SceneThemeId
}>()

const isMaid = computed(() => props.variant === 'whale' || props.variant === 'whale-night')
const isOrca = computed(() => props.variant === 'orca' || props.variant === 'orca-night')

const bgSrc = computed(() => {
  switch (props.variant) {
    case 'whale-night':
      return palaceNight
    case 'orca':
      return orcaSceneLight
    case 'orca-night':
      return orcaSceneDark
    default:
      return palaceDay
  }
})
</script>

<style scoped>
.scene-skin {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.scene-skin__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  pointer-events: none;
  user-select: none;
}

/**
 * 女仆工坊这组插画整体偏亮（宫殿天光 + 白色围裙），而这套主题的文字是浅色的，
 * 直接压上去会糊成一片。这里加一层同色系暗场把底图压下去，
 * 保证卡片外的文字（侧栏、状态栏、标题栏）也能站得住。
 */
.scene-skin.whale::after,
.scene-skin.whale-night::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(7, 12, 24, 0.44) 0%, rgba(7, 12, 24, 0.58) 100%);
  pointer-events: none;
}

.scene-skin.orca .scene-skin__bg {
  background-color: #eef3fa;
}

.scene-skin.orca-night .scene-skin__bg {
  background-color: #12161e;
}

.scene-skin__ribbon {
  position: absolute;
  top: 0;
  left: var(--sidebar-w);
  right: 0;
  height: 40px;
  object-fit: cover;
  object-position: center top;
  opacity: 0.85;
  pointer-events: none;
  user-select: none;
}

.scene-skin__corner {
  position: absolute;
  top: 0;
  left: 0;
  width: min(var(--sidebar-w), 96px);
  height: auto;
  max-height: 96px;
  object-fit: contain;
  object-position: left top;
  pointer-events: none;
  user-select: none;
}

.scene-skin__crest {
  position: absolute;
  left: 50%;
  bottom: var(--statusbar-h, 0px);
  width: min(360px, 50%);
  height: auto;
  max-height: 40px;
  transform: translateX(-50%);
  object-fit: contain;
  object-position: center bottom;
  opacity: 0.85;
  pointer-events: none;
  user-select: none;
}

.scene-skin__sidebar-art {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--sidebar-w);
  height: 100%;
  object-fit: cover;
  object-position: center top;
  opacity: 0.28;
  pointer-events: none;
  user-select: none;
}

.scene-skin__stage {
  position: absolute;
  top: 0;
  left: var(--sidebar-w);
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.scene-skin__maid {
  position: absolute;
  bottom: 0;
  height: 88%;
  width: auto;
  max-width: 58%;
  object-fit: contain;
  object-position: bottom center;
  filter: drop-shadow(0 12px 28px rgba(0, 0, 0, 0.32));
  pointer-events: none;
  user-select: none;
}

.scene-skin__maid--left {
  left: -6%;
  transform-origin: bottom center;
}

.scene-skin__maid--right {
  right: -8%;
  transform-origin: bottom center;
}
</style>

<template>
  <div class="eva-skin" :class="{ 'is-red': isRed }" aria-hidden="true">
    <img class="eva-skin__scene" :src="isRed ? redSceneArt : sceneArt" alt="" decoding="async" />
    <div class="eva-skin__grid"></div>
    <div class="eva-skin__hex"></div>
    <div class="eva-skin__bloom eva-skin__bloom--violet"></div>
    <div class="eva-skin__bloom eva-skin__bloom--lime"></div>

    <div class="eva-skin__unit-glow"></div>
    <div class="eva-skin__scrim"></div>

    <div class="eva-skin__scanlines"></div>
    <div class="eva-skin__axis"></div>
    <div class="eva-skin__slash eva-skin__slash--violet"></div>
    <div class="eva-skin__slash eva-skin__slash--lime"></div>
    <div class="eva-skin__hazard"></div>
    <div class="eva-skin__ticks"></div>

    <div class="eva-skin__unit-mark">
      <strong>{{ isRed ? '02' : '01' }}</strong>
      <span>EVA</span>
    </div>

    <div class="eva-skin__sync">
      <span class="eva-skin__sync-dot"></span>
      <span>{{ isRed ? 'ALERT / LEVEL 1' : 'SYNC / 98.7' }}</span>
    </div>

    <div class="eva-skin__spec">
      <b>{{ isRed ? 'EMERGENCY' : 'PROTOTYPE' }}</b>
      <span>{{ isRed ? 'EVA-02 / UNIT-02' : 'TEST TYPE / UNIT-01' }}</span>
      <small>{{ isRed ? 'MAGI LINK : CRITICAL' : 'MAGI LINK : STABLE' }}</small>
    </div>

    <div class="eva-skin__reticle"><span></span><span></span><span></span><span></span></div>

    <span class="eva-skin__corner eva-skin__corner--tl"></span>
    <span class="eva-skin__corner eva-skin__corner--br"></span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EvaThemeId } from '../stores/settings'
import sceneArt from '../assets/eva/eva-scene.webp'
import redSceneArt from '../assets/eva/eva-red-scene.webp'

const props = defineProps<{ variant: EvaThemeId }>()

/** 初号机与二号机分别使用各自的完整场景图 */
const isRed = computed(() => props.variant === 'eva-red')
</script>

<style scoped>
.eva-skin {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  color: var(--eva-key);
  background:
    radial-gradient(circle at 84% 14%, color-mix(in srgb, var(--eva-alt) 22%, transparent), transparent 30%),
    radial-gradient(circle at 62% 104%, color-mix(in srgb, var(--eva-key) 7%, transparent), transparent 32%),
    linear-gradient(135deg, var(--eva-bg-0) 0%, var(--eva-bg-1) 54%, #08070d 100%);
}

.eva-skin__scene,
.eva-skin__scrim,
.eva-skin__grid,
.eva-skin__hex,
.eva-skin__scanlines,
.eva-skin__bloom,
.eva-skin__axis,
.eva-skin__slash,
.eva-skin__hazard,
.eva-skin__ticks,
.eva-skin__unit-glow,
.eva-skin__reticle {
  position: absolute;
}

.eva-skin__grid {
  inset: 0;
  opacity: 0.28;
  background-image:
    linear-gradient(color-mix(in srgb, var(--eva-alt) 24%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in srgb, var(--eva-alt) 24%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: linear-gradient(90deg, #000 0%, rgba(0, 0, 0, 0.75) 38%, transparent 96%);
}

/* 远景机库的六边形壁面，只在左侧留一点存在感 */
.eva-skin__hex {
  inset: 0;
  opacity: 0.16;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='96' viewBox='0 0 56 96'%3E%3Cg fill='none' stroke='%238b5cf6' stroke-width='1'%3E%3Cpath d='M28 0 54 15v30L28 60 2 45V15z'/%3E%3Cpath d='M28 48 54 63v30L28 108 2 93V63z'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 56px 96px;
  mask-image: linear-gradient(90deg, #000 0%, rgba(0, 0, 0, 0.5) 44%, transparent 78%);
}

.eva-skin__scanlines {
  inset: 0;
  opacity: 0.18;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 3px,
    color-mix(in srgb, var(--eva-sheen) 6%, transparent) 4px
  );
  mix-blend-mode: screen;
}

.eva-skin__bloom {
  width: 460px;
  height: 460px;
  border-radius: 50%;
  filter: blur(1px);
}

.eva-skin__bloom--violet {
  top: -260px;
  right: 3%;
  border: 1px solid color-mix(in srgb, var(--eva-alt) 26%, transparent);
  box-shadow:
    0 0 0 34px color-mix(in srgb, var(--eva-alt) 2.5%, transparent),
    0 0 0 86px color-mix(in srgb, var(--eva-alt) 1.8%, transparent);
}

.eva-skin__bloom--lime {
  right: -150px;
  bottom: -330px;
  width: 620px;
  height: 620px;
  border: 1px solid color-mix(in srgb, var(--eva-key) 14%, transparent);
  box-shadow: 0 0 80px color-mix(in srgb, var(--eva-key) 5%, transparent);
}

/* 初号机场景铺满窗口，右侧角色保持完整，左侧渐暗承托侧栏与内容 */
.eva-skin__scene {
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 72% center;
  opacity: 0.94;
  filter: saturate(0.94) contrast(1.02) brightness(0.86);
  transform: scale(1.012);
}

.eva-skin__scrim {
  inset: 0;
  background:
    linear-gradient(90deg, rgba(8, 7, 13, 0.82) 0%, rgba(8, 7, 13, 0.56) 18%, rgba(8, 7, 13, 0.2) 46%, transparent 72%),
    linear-gradient(180deg, rgba(8, 7, 13, 0.22) 0%, transparent 30%, transparent 68%, rgba(8, 7, 13, 0.34) 100%);
}

.eva-skin:not(.is-red) .eva-skin__grid {
  opacity: 0.1;
}

.eva-skin:not(.is-red) .eva-skin__hex,
.eva-skin:not(.is-red) .eva-skin__slash {
  display: none;
}

.eva-skin:not(.is-red) .eva-skin__bloom {
  opacity: 0.32;
}

.eva-skin:not(.is-red) .eva-skin__scanlines {
  opacity: 0.07;
}

.eva-skin:not(.is-red) .eva-skin__unit-glow {
  opacity: 0;
}

.eva-skin:not(.is-red) .eva-skin__hazard {
  opacity: 0.16;
}

/* 二号机警戒态：红白分割构图居中，四周压暗以保住卡片和标题栏可读性 */
.eva-skin.is-red .eva-skin__scene {
  object-position: 50% center;
  opacity: 0.92;
  filter: saturate(0.94) contrast(1.04) brightness(0.76);
}

.eva-skin.is-red .eva-skin__scrim {
  background:
    linear-gradient(90deg, rgba(10, 5, 6, 0.7) 0%, rgba(10, 5, 6, 0.34) 16%, rgba(10, 5, 6, 0.06) 38%, rgba(10, 5, 6, 0.14) 68%, rgba(10, 5, 6, 0.5) 100%),
    linear-gradient(180deg, rgba(10, 5, 6, 0.34) 0%, transparent 26%, transparent 64%, rgba(10, 5, 6, 0.58) 100%),
    radial-gradient(circle at 50% 45%, transparent 0%, rgba(10, 5, 6, 0.08) 58%, rgba(10, 5, 6, 0.5) 100%);
}

.eva-skin.is-red .eva-skin__grid {
  opacity: 0.1;
}

.eva-skin.is-red .eva-skin__hex {
  opacity: 0.1;
}

.eva-skin.is-red .eva-skin__scanlines {
  opacity: 0.08;
}

/* 立绘背后的冷光，让机体边缘从暗场里浮出来 */
.eva-skin__unit-glow {
  right: 4%;
  bottom: -6%;
  width: 46%;
  height: 82%;
  background:
    radial-gradient(ellipse at 62% 42%, color-mix(in srgb, var(--eva-alt) 24%, transparent), transparent 58%),
    radial-gradient(ellipse at 78% 74%, color-mix(in srgb, var(--eva-key) 12%, transparent), transparent 62%);
  filter: blur(22px);
}

.eva-skin__axis {
  top: 0;
  bottom: 0;
  left: calc(var(--sidebar-w) + 16px);
  width: 1px;
  background: linear-gradient(
    to bottom,
    transparent,
    color-mix(in srgb, var(--eva-key) 28%, transparent) 18%,
    color-mix(in srgb, var(--eva-alt) 18%, transparent) 62%,
    transparent 96%
  );
}

.eva-skin__slash {
  top: 8%;
  right: -13%;
  width: 48%;
  height: 86px;
  transform: skewX(-24deg) rotate(-8deg);
  opacity: 0.46;
  clip-path: polygon(0 0, 100% 0, 88% 100%, 7% 100%);
}

.eva-skin__slash--violet {
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--eva-alt-deep) 58%, transparent), transparent 86%);
}

.eva-skin__slash--lime {
  top: 21%;
  right: -20%;
  height: 22px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--eva-key) 25%, transparent), transparent 78%);
}

/* 左侧竖直刻度尺，纯装饰 */
.eva-skin__ticks {
  left: calc(var(--sidebar-w) + 22px);
  top: 50%;
  width: 6px;
  height: 168px;
  transform: translateY(-50%);
  background: repeating-linear-gradient(
    to bottom,
    color-mix(in srgb, var(--eva-key) 34%, transparent) 0 1px,
    transparent 1px 12px
  );
  mask-image: linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent);
}

.eva-skin__hazard {
  left: calc(var(--sidebar-w) + 16px);
  right: 0;
  bottom: 0;
  height: 5px;
  opacity: 0.32;
  background: repeating-linear-gradient(
    115deg,
    color-mix(in srgb, var(--eva-key) 50%, transparent) 0 8px,
    transparent 8px 20px
  );
  mask-image: linear-gradient(90deg, transparent, #000 18%, #000 34%, transparent 62%);
}

.eva-skin__unit-mark {
  position: absolute;
  left: calc(var(--sidebar-w) + 26px);
  bottom: calc(var(--statusbar-h, 0px) + 26px);
  display: flex;
  align-items: flex-end;
  gap: 8px;
  color: color-mix(in srgb, var(--eva-alt) 42%, transparent);
  font-family: var(--font-mono);
  letter-spacing: -0.08em;
  line-height: 0.8;
}

.eva-skin__unit-mark strong {
  font-size: 62px;
  font-weight: 800;
}

.eva-skin__unit-mark span {
  padding-bottom: 10px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.24em;
}

.eva-skin__sync {
  position: absolute;
  top: calc(var(--window-chrome-h) + 12px);
  right: 22px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 4px 8px;
  border-right: 2px solid color-mix(in srgb, var(--eva-key) 55%, transparent);
  background: color-mix(in srgb, var(--eva-bg-0) 34%, transparent);
  color: color-mix(in srgb, var(--eva-key) 72%, transparent);
  font: 9px/1 var(--font-mono);
  letter-spacing: 0.14em;
}

.eva-skin__sync-dot {
  width: 4px;
  height: 4px;
  background: #a3ff12;
  box-shadow: 0 0 8px color-mix(in srgb, var(--eva-key) 92%, transparent);
  animation: eva-sync-blink 2.4s steps(2, end) infinite;
}

.eva-skin__spec {
  position: absolute;
  right: 20px;
  bottom: calc(var(--statusbar-h, 0px) + 17px);
  display: grid;
  justify-items: end;
  gap: 2px;
  color: color-mix(in srgb, var(--eva-fg-soft) 30%, transparent);
  font-family: var(--font-mono);
  text-align: right;
  text-transform: uppercase;
}

.eva-skin__spec b {
  color: color-mix(in srgb, var(--eva-key) 38%, transparent);
  font-size: 9px;
  letter-spacing: 0.34em;
}

.eva-skin__spec span,
.eva-skin__spec small {
  font-size: 8px;
  letter-spacing: 0.18em;
}

.eva-skin__reticle {
  right: 8%;
  bottom: 12%;
  width: 120px;
  height: 120px;
  border: 1px solid color-mix(in srgb, var(--eva-alt) 18%, transparent);
  border-radius: 50%;
  opacity: 0.65;
}

.eva-skin__reticle::before,
.eva-skin__reticle::after {
  content: '';
  position: absolute;
  background: color-mix(in srgb, var(--eva-key) 22%, transparent);
}

.eva-skin__reticle::before {
  top: 50%;
  left: -10px;
  right: -10px;
  height: 1px;
}

.eva-skin__reticle::after {
  top: -10px;
  bottom: -10px;
  left: 50%;
  width: 1px;
}

.eva-skin__reticle span {
  position: absolute;
  width: 14px;
  height: 14px;
  border-color: color-mix(in srgb, var(--eva-key) 42%, transparent);
  border-style: solid;
}

.eva-skin__reticle span:nth-child(1) {
  top: -1px;
  left: -1px;
  border-width: 1px 0 0 1px;
}

.eva-skin__reticle span:nth-child(2) {
  top: -1px;
  right: -1px;
  border-width: 1px 1px 0 0;
}

.eva-skin__reticle span:nth-child(3) {
  right: -1px;
  bottom: -1px;
  border-width: 0 1px 1px 0;
}

.eva-skin__reticle span:nth-child(4) {
  bottom: -1px;
  left: -1px;
  border-width: 0 0 1px 1px;
}

/* 视口四角的取景框 */
.eva-skin__corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border: 1px solid color-mix(in srgb, var(--eva-key) 28%, transparent);
  pointer-events: none;
}

.eva-skin__corner--tl {
  top: calc(var(--window-chrome-h) + 10px);
  left: calc(var(--sidebar-w) + 26px);
  border-width: 1px 0 0 1px;
}

.eva-skin__corner--br {
  right: 16px;
  bottom: calc(var(--statusbar-h, 0px) + 12px);
  border-width: 0 1px 1px 0;
}

@keyframes eva-sync-blink {
  0%,
  68%,
  100% {
    opacity: 1;
  }
  69%,
  88% {
    opacity: 0.25;
  }
}

@media (max-width: 1180px) {
  .eva-skin:not(.is-red) .eva-skin__scene {
    object-position: 66% center;
  }
}

@media (max-width: 860px) {
  .eva-skin__reticle,
  .eva-skin__spec,
  .eva-skin__ticks {
    display: none;
  }

  .eva-skin:not(.is-red) .eva-skin__scene {
    object-position: 74% center;
  }

  .eva-skin:not(.is-red) .eva-skin__scrim {
    background:
      linear-gradient(90deg, rgba(8, 7, 13, 0.86), rgba(8, 7, 13, 0.46) 54%, rgba(8, 7, 13, 0.2)),
      linear-gradient(180deg, rgba(8, 7, 13, 0.24), transparent 42%, rgba(8, 7, 13, 0.36));
  }
}
</style>

<template>
  <div class="scene-skin megumi" aria-hidden="true">
    <img class="scene-skin__bg" :src="bg" alt="" decoding="async" />
  </div>
</template>

<script setup lang="ts">
// 加藤惠主题的装饰层：只有一张立绘背景，不做人物分层。
// 立绘本身带大片左侧留白，正好给界面内容让位。
import bg from '../assets/megumi/megumi-scene.jpg'
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
  /* 人物在画右，窗口更宽时优先保住头顶和脸，牺牲底部的小腿 */
  object-fit: cover;
  object-position: right top;
  pointer-events: none;
  user-select: none;
}

/**
 * 画面左侧是过曝的走廊，纯白一片会把浅灰字冲淡。
 * 这里铺一层同色雾，从左侧往右淡出，既压住亮部又不遮住人物。
 */
.scene-skin.megumi::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgba(238, 242, 246, 0.52) 0%,
    rgba(238, 242, 246, 0.26) 46%,
    rgba(238, 242, 246, 0) 68%
  );
  pointer-events: none;
}
</style>

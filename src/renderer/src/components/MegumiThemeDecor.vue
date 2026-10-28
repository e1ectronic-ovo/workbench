<template>
  <div class="scene-skin" :class="variant" aria-hidden="true">
    <img class="scene-skin__bg" :src="bg" alt="" decoding="async" />
  </div>
</template>

<script setup lang="ts">
// 加藤惠主题的装饰层：单张立绘，没有人物分层。
// 两张素材都是原作同人插画（来源见 assets/megumi/NOTICE.md），
// 构图人物居中，所以不能整幅铺满——卡片会正好压在她脸上。
// 这里只把画面右侧一条留给立绘，左边用主题底色接住。
import { computed } from 'vue'
import type { MegumiThemeId } from '../stores/settings'
import dayBg from '../assets/megumi/megumi-day.jpg'
import nightBg from '../assets/megumi/megumi-night.jpg'

const props = defineProps<{ variant: MegumiThemeId }>()

const bg = computed(() => (props.variant === 'megumi-night' ? nightBg : dayBg))
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
  top: 0;
  right: 0;
  height: 100%;
  /* 右侧立绘条：宽度 46% 时条带的宽高比约 0.71，和素材（1200×1697）
     几乎一致，所以不会被裁掉构图，只在小窗口下才有一点缩放 */
  width: 46%;
  object-fit: cover;
  object-position: center top;
  pointer-events: none;
  user-select: none;
  /* 直接在图自己身上淡出左边缘，露出底下的主题底色。
     比盖一层半透明遮罩可靠：遮罩要跟图片亮度较劲，还容易在
     两者交界处留一条硬边 */
  mask-image: linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.55) 16%, #000 42%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.55) 16%, #000 42%);
}

/* 黄昏那张本身是逆光的暖色画面，直接当夜景用会冲掉浅色文字，
   压暗 + 轻微降饱和，让它真的像入夜后的街道 */
.scene-skin.megumi-night .scene-skin__bg {
  filter: brightness(0.58) saturate(0.82);
}

/* 暗色版再叠一层冷调，压掉夕阳残留的暖色，跟深蓝底统一 */
.scene-skin.megumi-night::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    200deg,
    rgba(18, 20, 34, 0.38) 0%,
    rgba(14, 16, 26, 0.16) 55%,
    rgba(20, 22, 34, 0.42) 100%
  );
}
</style>

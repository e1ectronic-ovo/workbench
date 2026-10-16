<template>
  <svg
    class="app-icon-svg"
    :width="size"
    :height="size"
    viewBox="0 0 128 128"
    fill="none"
    role="img"
    aria-label="Workbench"
  >
    <title>Workbench</title>
    <defs>
      <linearGradient :id="gid('bg')" x1="64" y1="8" x2="64" y2="124" gradientUnits="userSpaceOnUse">
        <stop stop-color="#8FA3BE" />
        <stop offset=".42" stop-color="#5E7390" />
        <stop offset="1" stop-color="#2F3D4F" />
      </linearGradient>
      <radialGradient
        :id="gid('glow')"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(47 35) rotate(90) scale(58)"
      >
        <stop stop-color="#D4DEEA" stop-opacity=".45" />
        <stop offset="1" stop-color="#D4DEEA" stop-opacity="0" />
      </radialGradient>
      <linearGradient :id="gid('tile')" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#FFFFFF" />
        <stop offset="1" stop-color="#D9E1EC" />
      </linearGradient>
      <linearGradient :id="gid('tile-dim')" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#FFFFFF" stop-opacity=".72" />
        <stop offset="1" stop-color="#C5CED9" stop-opacity=".55" />
      </linearGradient>
      <linearGradient :id="gid('accent')" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#5AC8FA" />
        <stop offset="1" stop-color="#0071E3" />
      </linearGradient>
    </defs>

    <rect width="128" height="128" rx="28.6" :fill="`url(#${gid('bg')})`" />
    <rect width="128" height="128" rx="28.6" :fill="`url(#${gid('glow')})`" />
    <rect x="3" y="3" width="122" height="122" rx="26.2" stroke="#fff" stroke-opacity=".08" stroke-width=".25" />

    <g transform="translate(64 66) translate(-25.1 -25.1)">
      <rect width="24" height="24" rx="5.5" :fill="`url(#${gid('tile')})`" stroke="#fff" stroke-opacity=".65" stroke-width=".35" />
      <rect x="4.5" y="5.5" width="9" height="1.25" rx=".6" fill="#B8C4D4" fill-opacity=".85" />
      <rect x="4.5" y="8.5" width="15" height="1" rx=".5" fill="#C8D2E0" fill-opacity=".7" />

      <rect x="26.25" width="24" height="24" rx="5.5" :fill="`url(#${gid('tile-dim')})`" stroke="#fff" stroke-opacity=".35" stroke-width=".35" />
      <rect y="26.25" width="24" height="24" rx="5.5" :fill="`url(#${gid('tile-dim')})`" stroke="#fff" stroke-opacity=".4" stroke-width=".35" />

      <rect x="26.25" y="26.25" width="24" height="24" rx="5.5" :fill="`url(#${gid('accent')})`" stroke="#fff" stroke-opacity=".5" stroke-width=".35" />
      <rect x="30.75" y="34.75" width="6" height="6" rx="1.75" fill="#fff" fill-opacity=".92" />
    </g>
  </svg>
</template>

<script setup lang="ts">
import { useId } from 'vue'

withDefaults(
  defineProps<{
    size?: number | string
  }>(),
  { size: 48 }
)

const uid = useId().replace(/:/g, '')
function gid(name: string) {
  return `wb-${name}-${uid}`
}
</script>

<style scoped>
.app-icon-svg {
  display: block;
  flex-shrink: 0;
}
</style>

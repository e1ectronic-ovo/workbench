<template>
  <header class="home-card-heading">
    <div class="home-card-heading__main">
      <span class="home-card-heading__icon" aria-hidden="true">
        <slot name="icon" />
      </span>
      <div class="home-card-heading__copy">
        <span class="home-card-heading__title-line">
          <span class="home-card-heading__title">{{ title }}</span>
          <slot name="badge" />
        </span>
        <span
          v-if="subtitle || $slots.subtitle"
          class="home-card-heading__subtitle"
        >
          <slot name="subtitle">{{ subtitle }}</slot>
        </span>
      </div>
    </div>

    <div v-if="$slots.actions" class="home-card-heading__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<style scoped>
.home-card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  min-height: 30px;
  margin-bottom: 10px;
}

.home-card-heading__main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.home-card-heading__icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 18%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 9%, transparent);
}

.home-card-heading__copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.home-card-heading__title-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.home-card-heading__title {
  font-size: 13px;
  font-weight: 620;
  line-height: 1.25;
  letter-spacing: -0.012em;
  color: var(--text);
  white-space: nowrap;
}

.home-card-heading__subtitle {
  overflow: hidden;
  font-size: 10.5px;
  line-height: 1.35;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.home-card-heading__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  flex-shrink: 0;
  min-width: 0;
}

@media (max-width: 760px) {
  .home-card-heading__subtitle {
    display: none;
  }
}
</style>

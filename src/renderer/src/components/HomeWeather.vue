<template>
  <div class="home-panel weather">
    <div class="panel-head">
      <span class="panel-title">天气</span>
      <span class="panel-date">{{ snapshot?.place.name || '定位中' }}</span>
    </div>

    <div v-if="snapshot" class="weather-now">
      <div class="weather-temp">
        <span class="weather-temp__n">{{ snapshot.temp }}</span>
        <span class="weather-temp__u">°</span>
      </div>
      <div class="weather-meta">
        <span class="weather-cond">{{ weatherLabel(snapshot.code) }}</span>
        <span class="weather-sub">体感 {{ snapshot.feels }}° · 湿度 {{ snapshot.humidity }}%</span>
        <span class="weather-sub">风速 {{ snapshot.wind }} km/h</span>
      </div>
    </div>

    <p v-else-if="error" class="weather-status">
      {{ error }}
      <button type="button" class="link-btn" @click="reload(true)">重试</button>
    </p>
    <p v-else class="weather-status">正在获取天气…</p>

    <div v-if="snapshot?.days.length" class="weather-days">
      <div v-for="day in snapshot.days" :key="day.date" class="weather-day">
        <span class="weather-day__name">{{ weekdayLabel(day.date) }}</span>
        <span class="weather-day__cond">{{ weatherLabel(day.code) }}</span>
        <span class="weather-day__t">{{ day.tMin }}° / {{ day.tMax }}°</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { loadWeather, weatherLabel, weekdayLabel, type WeatherSnapshot } from '../lib/weather'

const snapshot = ref<WeatherSnapshot | null>(null)
const error = ref('')

let timer: ReturnType<typeof setInterval> | undefined

async function reload(force = false) {
  error.value = ''
  try {
    snapshot.value = await loadWeather(force)
  } catch {
    if (!snapshot.value) error.value = '天气暂时不可用'
  }
}

onMounted(() => {
  void reload()
  timer = setInterval(() => void reload(), 20 * 60 * 1000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
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

.panel-date {
  font-size: 11px;
  color: var(--text-muted);
}

.weather-now {
  display: flex;
  align-items: center;
  gap: 12px;
}

.weather-temp {
  display: flex;
  align-items: flex-start;
  color: var(--accent);
  line-height: 1;
}

.weather-temp__n {
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.weather-temp__u {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 600;
}

.weather-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.weather-cond {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.weather-sub {
  font-size: 11px;
  color: var(--text-muted);
}

.weather-status {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}

.weather-days {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.weather-day {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.weather-day__name {
  font-size: 11px;
  color: var(--text-muted);
}

.weather-day__cond {
  font-size: 12px;
  color: var(--text);
}

.weather-day__t {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.link-btn {
  font-size: 12px;
  color: var(--text-muted);
  padding: 2px 4px;
  border-radius: 4px;
}

.link-btn:hover {
  color: var(--accent);
  background: var(--surface-hover);
}
</style>

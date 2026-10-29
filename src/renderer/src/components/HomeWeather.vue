<template>
  <div class="home-panel weather">
    <div class="panel-head">
      <span class="panel-title">天气</span>
      <div class="panel-head__actions">
        <button type="button" class="link-btn place-btn" @click="openPlace">
          {{ placeLabel }}
        </button>
        <button
          type="button"
          class="link-btn"
          :disabled="loading"
          :title="updatedTitle"
          @click="reload(true)"
        >
          {{ loading ? '更新中' : '刷新' }}
        </button>
      </div>
    </div>

    <div v-if="snapshot" class="weather-now">
      <div class="weather-temp">
        <span class="weather-temp__n">{{ snapshot.temp }}</span>
        <span class="weather-temp__u">°</span>
      </div>
      <div class="weather-meta">
        <span class="weather-cond">{{ conditionLabel(snapshot) }}</span>
        <span v-if="metaLine" class="weather-sub">{{ metaLine }}</span>
        <span v-if="windLine" class="weather-sub">{{ windLine }}</span>
      </div>
    </div>

    <p v-else-if="error" class="weather-status">
      {{ error }}
      <button type="button" class="link-btn" @click="reload(true)">重试</button>
    </p>
    <p v-else class="weather-status">正在获取天气…</p>

    <p v-if="hint" class="weather-hint">{{ hint }}</p>

    <div v-if="snapshot?.days.length" class="weather-days">
      <div v-for="day in snapshot.days" :key="day.date" class="weather-day">
        <span class="weather-day__name">{{ weekdayLabel(day.date) }}</span>
        <span class="weather-day__cond">{{ conditionLabel(day) }}</span>
        <span class="weather-day__t">{{ day.tMin }}° / {{ day.tMax }}°</span>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="placeOpen"
      class="mac-sheet-backdrop weather-sheet-backdrop"
      @click.self="closePlace"
    >
      <div class="mac-sheet">
        <h2 class="mac-sheet__title">选择城市</h2>
        <label class="mac-field">
          <span>搜索</span>
          <input
            ref="searchInput"
            v-model="query"
            class="place-search"
            type="search"
            placeholder="城市或区县"
            autocomplete="off"
            @keydown.esc.prevent="closePlace"
          />
        </label>

        <p v-if="searching" class="place-status">正在搜索…</p>
        <p v-else-if="query.trim() && !hits.length" class="place-status">没有找到匹配的地点</p>

        <div v-if="hits.length" class="place-hits" role="listbox">
          <button
            v-for="hit in hits"
            :key="`${hit.lat},${hit.lon}`"
            type="button"
            class="place-hit"
            @click="choosePlace(hit)"
          >
            {{ hit.name }}
          </button>
        </div>

        <div class="sheet-actions">
          <button type="button" class="mac-btn mac-btn--ghost" @click="useAutoPlace">
            使用定位
          </button>
          <button type="button" class="mac-btn mac-btn--ghost" @click="closePlace">取消</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  formatWeatherUpdatedAt,
  loadWeather,
  saveWeatherPref,
  searchPlaces,
  conditionLabel,
  weatherHint,
  weekdayLabel,
  type WeatherPlace,
  type WeatherSnapshot
} from '../lib/weather'

const snapshot = ref<WeatherSnapshot | null>(null)
const error = ref('')
const loading = ref(false)
const placeOpen = ref(false)
const query = ref('')
const hits = ref<WeatherPlace[]>([])
const searching = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)

const placeLabel = computed(() => snapshot.value?.place.name || '选择城市')
const hint = computed(() => (snapshot.value ? weatherHint(snapshot.value) : ''))

/** 境外城市的源只有预报、没有实况，缺的项直接不显示，别渲染成 0% / 0 级 */
const metaLine = computed(() => {
  const snap = snapshot.value
  if (!snap) return ''
  const parts: string[] = []
  if (snap.humidity >= 0) parts.push(`湿度 ${snap.humidity}%`)
  if (snap.quality) parts.push(`空气${snap.quality}`)
  return parts.join(' · ')
})

const windLine = computed(() => {
  const snap = snapshot.value
  if (!snap || snap.wind < 0) return ''
  return snap.windUnit === 'level' ? `风速 ${snap.wind} 级` : `体感 ${snap.feels}° · ${snap.wind} km/h`
})
const updatedTitle = computed(() =>
  snapshot.value ? `更新于 ${formatWeatherUpdatedAt(snapshot.value.updatedAt)}` : '刷新天气'
)

let timer: ReturnType<typeof setInterval> | undefined
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchGen = 0

async function reload(force = false) {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    snapshot.value = await loadWeather(force)
  } catch {
    if (!snapshot.value) error.value = '天气暂时不可用'
  } finally {
    loading.value = false
  }
}

function openPlace() {
  query.value = ''
  hits.value = []
  searching.value = false
  placeOpen.value = true
  void nextTick(() => searchInput.value?.focus())
}

function closePlace() {
  placeOpen.value = false
}

async function choosePlace(place: WeatherPlace) {
  saveWeatherPref({ mode: 'manual', place })
  closePlace()
  await reload(true)
}

async function useAutoPlace() {
  saveWeatherPref({ mode: 'auto' })
  closePlace()
  await reload(true)
}

watch(query, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  const q = value.trim()
  if (!q) {
    searchGen += 1
    hits.value = []
    searching.value = false
    return
  }
  searching.value = true
  const gen = ++searchGen
  searchTimer = setTimeout(async () => {
    try {
      const results = await searchPlaces(q)
      if (gen !== searchGen) return
      hits.value = results
    } catch {
      if (gen !== searchGen) return
      hits.value = []
    } finally {
      if (gen === searchGen) searching.value = false
    }
  }, 280)
})

function onDocKey(e: KeyboardEvent) {
  if (placeOpen.value && e.key === 'Escape') closePlace()
}

onMounted(() => {
  document.addEventListener('keydown', onDocKey)
  void reload()
  timer = setInterval(() => void reload(), 20 * 60 * 1000)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocKey)
  if (timer) clearInterval(timer)
  if (searchTimer) clearTimeout(searchTimer)
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

.panel-head__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.place-btn {
  max-width: 9em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.weather-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text);
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

.link-btn:hover:not(:disabled) {
  color: var(--accent);
  background: var(--surface-hover);
}

.link-btn:disabled {
  opacity: 0.5;
}

.place-search {
  width: 100%;
  box-sizing: border-box;
}

.place-status {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.place-hits {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
  max-height: 220px;
  overflow: auto;
}

.place-hit {
  width: 100%;
  min-height: 32px;
  padding: 6px 8px;
  border-radius: var(--radius-md);
  text-align: left;
  font-size: 13px;
  color: var(--text);
}

.place-hit:hover {
  background: var(--surface-hover);
}

.sheet-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: var(--space-4);
}

.weather-sheet-backdrop {
  z-index: 1100;
}
</style>

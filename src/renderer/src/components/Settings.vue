<template>
  <section class="settings mac-page">
    <div class="mac-page__inner">
      <header class="mac-page__header">
        <h1 class="mac-page__title">设置</h1>
        <p class="mac-page__subtitle">网站、外观与通用选项。改动会自动保存。</p>
        <nav class="mac-segmented mac-page__tabs" aria-label="设置分类">
          <button
            v-for="t in tabs"
            :key="t.id"
            type="button"
            class="mac-segmented__item"
            :class="{ 'is-on': tab === t.id }"
            @click="tab = t.id"
          >
            {{ t.label }}
          </button>
        </nav>
      </header>

      <!-- 网站 -->
      <div v-if="tab === 'modules'" class="tab-pane">
        <div class="pane-toolbar">
          <p class="pane-hint">侧栏显示的摸鱼网站，图标自动使用站点 favicon。</p>
          <div class="pane-actions">
            <button class="mac-btn mac-btn--primary" type="button" @click="openCreate">添加网站</button>
          </div>
        </div>

        <div class="mac-group" role="list">
          <div
            v-for="(m, index) in modulesStore.modules"
            :key="m.id"
            class="mac-row"
            role="listitem"
          >
            <div class="mac-row__main">
              <span class="mac-icon-well" :style="{ '--brand': m.color }">
                <ModuleIcon :module="m" variant="list" />
              </span>
              <div class="mac-row__text">
                <div class="mac-row__title">{{ m.name }}</div>
                <div class="mac-row__sub" :title="m.url">{{ m.url }}</div>
              </div>
            </div>
            <div class="mac-row__actions">
              <button class="mac-icon-btn" type="button" title="上移" :disabled="index === 0" @click="modulesStore.moveModule(m.id, -1)">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>
              </button>
              <button class="mac-icon-btn" type="button" title="下移" :disabled="index === modulesStore.modules.length - 1" @click="modulesStore.moveModule(m.id, 1)">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <button class="mac-icon-btn" type="button" title="编辑" @click="openEdit(m)">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button class="mac-icon-btn mac-icon-btn--danger" type="button" title="删除" @click="askRemove(m)">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/></svg>
              </button>
            </div>
          </div>

          <div v-if="modulesStore.modules.length === 0" class="mac-row mac-empty">
            还没有网站。点击「添加网站」开始配置。
          </div>
        </div>
      </div>

      <!-- 外观 -->
      <div v-else-if="tab === 'appearance'" class="tab-pane">
        <section class="mac-section">
          <p class="mac-section__label">主题</p>
          <div class="mac-group">
            <button
              v-for="t in themeOptions"
              :key="t.id"
              type="button"
              class="mac-row mac-option"
              :class="{ 'is-on': settings.appearance.theme === t.id }"
              @click="onThemeSelect(t.id)"
            >
              <span v-if="t.previewImage" class="mac-swatch mac-swatch--img">
                <img :src="t.previewImage" alt="" />
              </span>
              <span v-else class="mac-swatch" :style="{ background: t.preview }"></span>
              <div class="mac-row__text">
                <div class="mac-row__title">{{ t.label }}</div>
                <div class="mac-row__sub desc">{{ t.desc }}</div>
              </div>
              <span v-if="settings.appearance.theme === t.id" class="mac-row__aside check" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
              </span>
            </button>
          </div>
        </section>

        <section v-if="settings.appearance.theme === 'custom'" class="mac-section">
          <p class="mac-section__label">自定义配色</p>
          <div class="mac-group">
            <label
              v-for="item in customColorFields"
              :key="item.key"
              class="mac-row custom-color-row"
            >
              <div class="mac-row__main">
                <input
                  class="color-picker"
                  type="color"
                  :value="customColors[item.key]"
                  @input="onCustomColor(item.key, $event)"
                />
                <div class="mac-row__text">
                  <div class="mac-row__title">{{ item.label }}</div>
                  <input
                    class="color-hex"
                    maxlength="7"
                    :value="customColors[item.key]"
                    @change="onCustomColorHex(item.key, $event)"
                  />
                </div>
              </div>
            </label>
          </div>
        </section>

        <section class="mac-section">
          <p class="mac-section__label">强调色</p>
          <div class="mac-group">
            <div class="mac-row accent-row">
              <div class="mac-row__main">
                <input
                  class="color-picker"
                  type="color"
                  :value="settings.appearance.accent"
                  @input="onAccentInput"
                />
                <div class="mac-row__text">
                  <div class="mac-row__title">自定义颜色</div>
                  <input
                    class="color-hex"
                    maxlength="7"
                    :value="settings.appearance.accent"
                    @change="onAccentHex"
                  />
                </div>
              </div>
            </div>
            <div class="mac-row presets-row">
              <div class="mac-presets">
                <button
                  v-for="c in accentPresets"
                  :key="c"
                  type="button"
                  class="mac-preset-swatch"
                  :class="{ 'is-on': settings.appearance.accent.toLowerCase() === c.toLowerCase() }"
                  :style="{ background: c }"
                  :title="c"
                  @click="settings.patchAppearance({ accent: c })"
                />
              </div>
            </div>
          </div>
        </section>

        <section class="mac-section">
          <p class="mac-section__label">布局</p>
          <div class="mac-group">
            <label class="mac-row mac-toggle">
              <div class="mac-row__text">
                <div class="mac-row__title">紧凑侧栏</div>
                <div class="mac-row__sub">仅显示图标，缩窄侧栏</div>
              </div>
              <input
                type="checkbox"
                :checked="settings.appearance.density === 'compact'"
                @change="onDensity"
              />
            </label>
            <label class="mac-row mac-toggle">
              <div class="mac-row__text">
                <div class="mac-row__title">显示侧栏标签</div>
                <div class="mac-row__sub">在侧栏显示网站名称</div>
              </div>
              <input
                type="checkbox"
                :checked="settings.appearance.showModuleLabels"
                @change="settings.patchAppearance({ showModuleLabels: ($event.target as HTMLInputElement).checked })"
              />
            </label>
            <label class="mac-row mac-toggle">
              <div class="mac-row__text">
                <div class="mac-row__title">显示状态栏</div>
                <div class="mac-row__sub">窗口底部显示当前网站与地址</div>
              </div>
              <input
                type="checkbox"
                :checked="settings.appearance.showStatusBar"
                @change="settings.patchAppearance({ showStatusBar: ($event.target as HTMLInputElement).checked })"
              />
            </label>
          </div>
        </section>

      </div>

      <!-- 通用 -->
      <div v-else class="tab-pane">
        <section class="mac-section">
          <p class="mac-section__label">启动</p>
          <div class="mac-group">
            <label class="mac-row mac-toggle">
              <div class="mac-row__text">
                <div class="mac-row__title">开机自动启动</div>
                <div class="mac-row__sub">登录系统后自动打开 Workbench</div>
              </div>
              <input
                type="checkbox"
                :checked="settings.openAtLogin"
                :disabled="!settings.loginReady"
                @change="settings.setOpenAtLogin(($event.target as HTMLInputElement).checked)"
              />
            </label>
            <label class="mac-row mac-toggle">
              <div class="mac-row__text">
                <div class="mac-row__title">启动时最小化到后台</div>
                <div class="mac-row__sub">随系统启动时先隐藏窗口（需开启自动启动）</div>
              </div>
              <input
                type="checkbox"
                :checked="settings.openAsHidden"
                :disabled="!settings.loginReady || !settings.openAtLogin"
                @change="settings.setOpenAsHidden(($event.target as HTMLInputElement).checked)"
              />
            </label>
          </div>
          <p v-if="!settings.loginReady" class="warn">无法读取系统启动项，请确认在 Electron 客户端中运行。</p>
        </section>
      </div>
    </div>

    <!-- 编辑 / 新建网站 -->
    <div v-if="dialogOpen" class="mac-sheet-backdrop" @click.self="closeDialog">
      <form class="mac-sheet" @submit.prevent="onSave">
        <h2 class="mac-sheet__title">{{ editingId ? '编辑网站' : '添加网站' }}</h2>

        <label class="mac-field">
          <span>名称</span>
          <input v-model="form.name" required maxlength="32" placeholder="例如：小红书" />
        </label>

        <label class="mac-field">
          <span>网址</span>
          <input v-model="form.url" required placeholder="https://example.com" spellcheck="false" />
        </label>

        <label class="mac-field color-field">
          <span>颜色</span>
          <div class="color-inline">
            <input v-model="form.color" type="color" class="color-picker" />
            <input v-model="form.color" class="color-hex" maxlength="7" spellcheck="false" />
          </div>
        </label>

        <div class="mac-presets">
          <button
            v-for="c in PRESET_COLORS"
            :key="c"
            type="button"
            class="mac-preset-swatch"
            :class="{ 'is-on': form.color.toLowerCase() === c.toLowerCase() }"
            :style="{ background: c }"
            :title="c"
            @click="form.color = c"
          />
        </div>

        <p v-if="formError" class="warn">{{ formError }}</p>

        <div class="dialog-actions">
          <button class="mac-btn mac-btn--ghost" type="button" @click="closeDialog">取消</button>
          <button class="mac-btn mac-btn--primary" type="submit" :disabled="saving">保存</button>
        </div>
      </form>
    </div>

    <!-- 删除确认 -->
    <div v-if="pendingRemove" class="mac-sheet-backdrop" @click.self="pendingRemove = null">
      <div class="mac-sheet narrow">
        <h2 class="mac-sheet__title">删除网站</h2>
        <p class="confirm-text">确定删除「{{ pendingRemove.name }}」？此操作不会影响网站账号，但会移除本地配置。</p>
        <div class="dialog-actions">
          <button class="mac-btn mac-btn--ghost" type="button" @click="pendingRemove = null">取消</button>
          <button class="mac-btn mac-btn--danger" type="button" :disabled="removing" @click="confirmRemove">删除</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { PRESET_COLORS, type ModuleConfig } from '../modules/registry'
import { useModulesStore } from '../stores/modules'
import {
  DEFAULT_CUSTOM_COLORS,
  useSettingsStore,
  ORCA_ACCENT,
  WHALE_ACCENT,
  type CustomThemeColors,
  type ThemeId
} from '../stores/settings'
import ModuleIcon from './ModuleIcon.vue'
import maidPreviewDay from '../assets/maid-atelier/preview-day.webp'
import maidPreviewNight from '../assets/maid-atelier/preview-night.webp'
import orcaPreviewDay from '../assets/orca-link/light-hero.webp'
import orcaPreviewNight from '../assets/orca-link/dark-hero.webp'

const modulesStore = useModulesStore()
const settings = useSettingsStore()

const tabs = [
  { id: 'modules' as const, label: '网站' },
  { id: 'appearance' as const, label: '外观' },
  { id: 'general' as const, label: '通用' }
]
const tab = ref<(typeof tabs)[number]['id']>('modules')

const themeOptions: {
  id: ThemeId
  label: string
  desc: string
  preview: string
  previewImage?: string
}[] = [
  {
    id: 'whale',
    label: '浅海 · 女仆工坊',
    desc: '宫殿日景 · 左右女仆',
    preview: '',
    previewImage: maidPreviewDay
  },
  {
    id: 'whale-night',
    label: '深海 · 女仆工坊',
    desc: '宫殿夜景 · 左右女仆',
    preview: '',
    previewImage: maidPreviewNight
  },
  {
    id: 'orca',
    label: '机能 · 虎鲸链路',
    desc: '机械舱 · 直角界面',
    preview: '',
    previewImage: orcaPreviewDay
  },
  {
    id: 'orca-night',
    label: '夜读 · 虎鲸链路',
    desc: '夜间书房 · 直角界面',
    preview: '',
    previewImage: orcaPreviewNight
  },
  { id: 'light', label: '浅色清爽', desc: '系统浅灰', preview: '#f5f5f7' },
  { id: 'oled', label: 'OLED 深黑', desc: '省电、对比强', preview: '#1c1c1e' },
  { id: 'slate', label: '石板灰蓝', desc: '偏桌面工具感', preview: '#0f1419' },
  { id: 'dim', label: '柔和暗色', desc: '降低对比', preview: '#121212' },
  { id: 'paper', label: '纸感浅色', desc: '暖白阅读', preview: '#f7f3eb' },
  { id: 'custom', label: '自定义', desc: '自己调配背景与侧栏颜色', preview: 'linear-gradient(135deg, #dce8f5, #ffffff)' }
]

const customColorFields: { key: keyof CustomThemeColors; label: string }[] = [
  { key: 'bg', label: '背景色' },
  { key: 'surface', label: '卡片色' },
  { key: 'sidebarBg', label: '侧栏色' },
  { key: 'text', label: '文字色' }
]

const customColors = computed(
  () => settings.appearance.custom ?? DEFAULT_CUSTOM_COLORS
)

const accentPresets = [
  WHALE_ACCENT,
  ORCA_ACCENT,
  ...PRESET_COLORS.filter((c) => c !== WHALE_ACCENT && c !== ORCA_ACCENT)
]

const dialogOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const formError = ref('')
const form = reactive({
  name: '',
  url: '',
  color: '#14B8A6'
})

const pendingRemove = ref<ModuleConfig | null>(null)
const removing = ref(false)

onMounted(async () => {
  await settings.refreshLoginItem()
})

function onThemeSelect(id: ThemeId) {
  const patch: { theme: ThemeId; accent?: string; custom?: CustomThemeColors } = { theme: id }
  if (id === 'whale' || id === 'whale-night') patch.accent = WHALE_ACCENT
  if (id === 'orca' || id === 'orca-night') patch.accent = ORCA_ACCENT
  if (id === 'custom') patch.custom = { ...customColors.value }
  settings.patchAppearance(patch)
}

function onCustomColor(key: keyof CustomThemeColors, e: Event) {
  settings.patchCustomColor(key, (e.target as HTMLInputElement).value)
}

function onCustomColorHex(key: keyof CustomThemeColors, e: Event) {
  const v = (e.target as HTMLInputElement).value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(v)) settings.patchCustomColor(key, v)
}

function onAccentInput(e: Event) {
  settings.patchAppearance({ accent: (e.target as HTMLInputElement).value })
}

function onAccentHex(e: Event) {
  const v = (e.target as HTMLInputElement).value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(v)) settings.patchAppearance({ accent: v })
}

function onDensity(e: Event) {
  const compact = (e.target as HTMLInputElement).checked
  settings.patchAppearance({ density: compact ? 'compact' : 'comfortable' })
}

function openCreate() {
  editingId.value = null
  form.name = ''
  form.url = 'https://'
  form.color = '#14B8A6'
  formError.value = ''
  dialogOpen.value = true
}

function openEdit(m: ModuleConfig) {
  editingId.value = m.id
  form.name = m.name
  form.url = m.url
  form.color = m.color
  formError.value = ''
  dialogOpen.value = true
}

function closeDialog() {
  dialogOpen.value = false
}

async function onSave() {
  formError.value = ''
  if (!form.name.trim() || !form.url.trim()) {
    formError.value = '请填写名称和网址'
    return
  }
  saving.value = true
  try {
    let id = editingId.value

    if (id) {
      modulesStore.updateModule(id, {
        name: form.name,
        url: form.url,
        color: form.color
      })
    } else {
      const created = modulesStore.addModule({
        name: form.name,
        url: form.url,
        color: form.color
      })
      id = created.id
    }

    closeDialog()
  } catch (e: any) {
    formError.value = e?.message || '保存失败'
  } finally {
    saving.value = false
  }
}

function askRemove(m: ModuleConfig) {
  pendingRemove.value = m
}

async function confirmRemove() {
  const m = pendingRemove.value
  if (!m) return
  removing.value = true
  try {
    const ok = await modulesStore.removeModule(m.id)
    if (!ok) formError.value = '删除失败，请重试'
    pendingRemove.value = null
  } finally {
    removing.value = false
  }
}

</script>

<style scoped>
.tab-pane {
  animation: pane-in var(--dur) var(--ease);
}

@keyframes pane-in {
  from { opacity: 0; transform: translateY(2px); }
  to { opacity: 1; transform: none; }
}

.pane-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.pane-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  line-height: 1.5;
  max-width: 28em;
}

.pane-actions {
  display: flex;
  gap: var(--space-2);
  flex-shrink: 0;
}

.mac-row__sub.desc {
  font-family: var(--font-sans);
}

.check {
  color: var(--accent);
}

.accent-row .mac-row__main,
.custom-color-row .mac-row__main {
  gap: var(--space-3);
}

.mac-swatch--img {
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--border);
}

.mac-swatch--img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  display: block;
}

.presets-row {
  min-height: auto;
  padding-top: var(--space-2);
  padding-bottom: var(--space-3);
}

.presets-row:hover {
  background: transparent;
}

.mac-row__aside.mono {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}

.color-picker {
  width: 32px;
  height: 32px;
  padding: 2px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg);
  cursor: pointer;
}

.color-hex {
  width: 100%;
  height: 28px;
  padding: 0 var(--space-2);
  background: transparent;
  border: 0;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.color-inline {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.icon-preview {
  --brand: var(--accent);
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: var(--text-lg);
  color: var(--brand);
  background: var(--surface-secondary);
  flex-shrink: 0;
  overflow: hidden;
}

.icon-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.icon-picker {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.icon-picker-actions {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.tiny {
  margin: 0;
  width: 100%;
  color: var(--text-muted);
  font-size: var(--text-xs);
  line-height: 1.4;
}

.form-row {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.grow { flex: 1 1 140px; min-width: 0; }
.color-field { flex: 0 1 160px; min-width: 0; }

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.mac-sheet.narrow { width: min(360px, 100%); }

.confirm-text {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--text-base);
  line-height: 1.55;
}

.warn {
  margin: var(--space-2) 0 0 var(--space-3);
  color: var(--warning);
  font-size: var(--text-sm);
}

</style>

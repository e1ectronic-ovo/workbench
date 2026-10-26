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
          <p class="pane-hint">侧栏显示的模块：网站走内嵌浏览器，原生应用则直接把模拟器或本地程序的窗口托管进界面。</p>
          <div class="pane-actions">
            <button
              class="mac-btn mac-btn--secondary"
              type="button"
              :disabled="!nativeSupported"
              :title="nativeSupported ? '把模拟器或本地程序的窗口嵌进模块区' : '当前外壳不支持原生窗口嵌入，请用 WPF 外壳启动'"
              @click="openCreate('native')"
            >
              接入原生窗口
            </button>
            <button class="mac-btn mac-btn--primary" type="button" @click="openCreate('web')">添加网站</button>
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
                <div class="mac-row__sub" :title="moduleSubtitle(m)">{{ moduleSubtitle(m) }}</div>
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

      <!-- 代理 -->
      <div v-else-if="tab === 'proxy'" class="tab-pane">
        <section class="mac-section">
          <p class="mac-section__label">配置</p>
          <div class="mac-group">
            <div v-for="p in proxy.profiles" :key="p.id" class="mac-row">
              <div class="mac-row__main">
                <span class="cfg-dot" :class="{ 'is-on': p.id === proxy.snapshot?.activeProfileId }"></span>
                <div class="mac-row__text">
                  <div class="mac-row__title">{{ p.name }}</div>
                  <div class="mac-row__sub">{{ profileMeta(p) }}</div>
                </div>
              </div>
              <div class="mac-row__actions">
                <span v-if="p.id === proxy.snapshot?.activeProfileId" class="cfg-badge">使用中</span>
                <button
                  v-else
                  class="mac-btn mac-btn--secondary"
                  type="button"
                  :disabled="proxy.busy"
                  @click="proxy.switchProfile(p.id)"
                >
                  切换
                </button>
                <button
                  v-if="p.source === 'subscription' && p.id === proxy.snapshot?.activeProfileId"
                  class="mac-icon-btn"
                  type="button"
                  title="重新拉取订阅"
                  :disabled="proxy.busy"
                  @click="proxy.updateSubscription()"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
                  </svg>
                </button>
                <button
                  class="mac-icon-btn mac-icon-btn--danger"
                  type="button"
                  title="删除配置"
                  @click="pendingProfile = p"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" />
                  </svg>
                </button>
              </div>
            </div>

            <div v-if="!proxy.profiles.length" class="mac-row mac-empty">
              还没有配置。导入一份 Clash 订阅，或选择本地 .yaml 文件。
            </div>
          </div>

          <div class="pane-toolbar cfg-toolbar">
            <p class="pane-hint">可以同时保存多份订阅或本地配置，随时切换；切换会重启内核。</p>
            <div class="pane-actions">
              <button class="mac-btn mac-btn--primary" type="button" @click="openSubscribe">
                导入订阅
              </button>
              <button class="mac-btn mac-btn--secondary" type="button" @click="proxy.importProfile()">
                本地文件
              </button>
            </div>
          </div>
        </section>

        <section class="mac-section">
          <p class="mac-section__label">端口</p>
          <div class="mac-group">
            <div class="mac-row">
              <div class="mac-row__text">
                <div class="mac-row__title">混合端口</div>
                <div class="mac-row__sub">HTTP 与 SOCKS 共用，改动后自动重启内核</div>
              </div>
              <div class="mac-row__actions">
                <input
                  class="settings-input port-input"
                  type="number"
                  min="1024"
                  max="65535"
                  :value="proxySettings.mixedPort"
                  @change="setPort('mixedPort', $event)"
                />
              </div>
            </div>
            <div class="mac-row">
              <div class="mac-row__text">
                <div class="mac-row__title">控制端口</div>
                <div class="mac-row__sub">仅监听 127.0.0.1，供界面读取状态</div>
              </div>
              <div class="mac-row__actions">
                <input
                  class="settings-input port-input"
                  type="number"
                  min="1024"
                  max="65535"
                  :value="proxySettings.controllerPort"
                  @change="setPort('controllerPort', $event)"
                />
              </div>
            </div>
          </div>
        </section>

        <p v-if="proxy.notice" class="notice" :class="{ 'is-error': proxy.noticeKind === 'error' }">
          {{ proxy.notice }}
        </p>
      </div>

      <!-- 通用 -->
      <div v-else-if="tab === 'general'" class="tab-pane">
        <section class="mac-section">
          <p class="mac-section__label">启动</p>
          <div class="mac-group">
            <label class="mac-row mac-toggle">
              <div class="mac-row__text">
                <div class="mac-row__title">开机自动启动</div>
                <div class="mac-row__sub">登录系统后自动打开鲸汐</div>
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

        <section class="mac-section">
          <p class="mac-section__label">窗口</p>
          <div class="mac-group">
            <div class="mac-row">
              <div class="mac-row__text">
                <div class="mac-row__title">点击关闭按钮时</div>
                <div class="mac-row__sub">
                  收进托盘后程序继续在后台运行，可从任务栏托盘打开
                </div>
              </div>
              <div class="mac-row__aside">
                <div class="mac-segmented" role="group" aria-label="关闭窗口时的行为">
                  <button
                    v-for="o in closeOptions"
                    :key="o.id"
                    type="button"
                    class="mac-segmented__item"
                    :class="{ 'is-on': closeAction === o.id }"
                    @click="setCloseAction(o.id)"
                  >
                    {{ o.label }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="mac-section">
          <p class="mac-section__label">版本</p>
          <div class="mac-group">
            <div class="mac-row">
              <div class="mac-row__main">
                <span class="core-dot" :class="updateDot" aria-hidden="true"></span>
                <div class="mac-row__text">
                  <div class="mac-row__title">{{ updateTitle }}</div>
                  <div class="mac-row__sub">{{ updateSub }}</div>
                </div>
              </div>
              <div class="mac-row__actions">
                <button
                  v-if="updateState.status === 'available'"
                  class="mac-btn mac-btn--primary"
                  type="button"
                  @click="startDownload"
                >
                  下载更新
                </button>
                <button
                  v-else-if="updateState.status === 'downloaded'"
                  class="mac-btn mac-btn--primary"
                  type="button"
                  @click="installUpdate"
                >
                  重启安装
                </button>
                <button
                  v-else
                  class="mac-btn mac-btn--secondary"
                  type="button"
                  :disabled="updateState.status === 'checking' || updateState.status === 'downloading'"
                  @click="checkUpdate"
                >
                  {{ updateState.status === 'checking' ? '检查中…' : '检查更新' }}
                </button>
              </div>
            </div>

            <div v-if="updateState.status === 'downloading'" class="mac-row update-row">
              <div class="update-bar"><span :style="{ width: `${updateState.percent}%` }"></span></div>
              <span class="update-percent">{{ updateState.percent }}%</span>
            </div>
          </div>
          <p v-if="updateState.status === 'error' && updateState.error" class="warn">
            {{ updateState.error }}
          </p>
        </section>
      </div>
    </div>

    <!-- 编辑 / 新建网站 -->
    <div v-if="dialogOpen" class="mac-sheet-backdrop" @click.self="closeDialog">
      <form class="mac-sheet" @submit.prevent="onSave">
        <h2 class="mac-sheet__title">
          {{ editingId ? '编辑模块' : form.kind === 'native' ? '接入原生窗口' : '添加网站' }}
        </h2>

        <div class="mac-field">
          <span>类型</span>
          <div class="kind-switch">
            <button
              type="button"
              class="mac-btn"
              :class="form.kind === 'web' ? 'mac-btn--primary' : 'mac-btn--ghost'"
              @click="setKind('web')"
            >
              网站
            </button>
            <button
              type="button"
              class="mac-btn"
              :class="form.kind === 'native' ? 'mac-btn--primary' : 'mac-btn--ghost'"
              :disabled="!nativeSupported"
              :title="nativeSupported ? '' : '当前外壳不支持原生窗口嵌入'"
              @click="setKind('native')"
            >
              原生应用
            </button>
          </div>
        </div>

        <label class="mac-field">
          <span>名称</span>
          <input v-model="form.name" required maxlength="32" placeholder="例如：小红书" />
        </label>

        <label v-if="form.kind === 'web'" class="mac-field">
          <span>网址</span>
          <input v-model="form.url" required placeholder="https://example.com" spellcheck="false" />
        </label>

        <template v-else>
          <div class="mac-field">
            <span>目标进程</span>
            <div class="field-row">
              <input
                v-model="form.processName"
                placeholder="例如 MuMuPlayer（不带 .exe）"
                spellcheck="false"
              />
              <button
                class="mac-btn mac-btn--secondary"
                type="button"
                :disabled="picking || !nativeSupported"
                @click="pickNativeWindow"
              >
                {{ picking ? '选择中…' : '选择窗口' }}
              </button>
            </div>
          </div>

          <label class="mac-field">
            <span>可执行文件（可选，用于自动启动）</span>
            <input
              v-model="form.executablePath"
              placeholder="D:\…\MuMuPlayer.exe；留空则只嵌入已启动的窗口"
              spellcheck="false"
            />
          </label>

          <button type="button" class="field-toggle" @click="showNativeAdvanced = !showNativeAdvanced">
            {{ showNativeAdvanced ? '收起高级匹配' : '高级匹配（多窗口时用）' }}
          </button>

          <template v-if="showNativeAdvanced">
            <label class="mac-field">
              <span>窗口标题包含</span>
              <input v-model="form.windowTitle" placeholder="留空则不按标题过滤" spellcheck="false" />
            </label>
            <label class="mac-field">
              <span>窗口类名</span>
              <input v-model="form.className" placeholder="留空则不按类名过滤" spellcheck="false" />
            </label>
            <label class="mac-field">
              <span>启动参数</span>
              <input v-model="form.arguments" placeholder="传给可执行文件的命令行参数" spellcheck="false" />
            </label>
            <label class="check-row">
              <input v-model="form.launchOnOpen" type="checkbox" />
              <span>进入这个模块时自动启动并嵌入</span>
            </label>
          </template>
        </template>

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
    <!-- 删除配置确认 -->
    <div v-if="pendingProfile" class="mac-sheet-backdrop" @click.self="pendingProfile = null">
      <div class="mac-sheet narrow">
        <h2 class="mac-sheet__title">删除配置</h2>
        <p class="confirm-text">
          确定删除「{{ pendingProfile.name }}」？如果它正在使用，会自动切到剩下的配置。
        </p>
        <div class="dialog-actions">
          <button class="mac-btn mac-btn--ghost" type="button" @click="pendingProfile = null">
            取消
          </button>
          <button class="mac-btn mac-btn--danger" type="button" :disabled="proxy.busy" @click="confirmRemoveProfile">
            删除
          </button>
        </div>
      </div>
    </div>

    <!-- 导入订阅 -->
    <div v-if="subscribeOpen" class="mac-sheet-backdrop" @click.self="subscribeOpen = false">
      <form class="mac-sheet narrow" @submit.prevent="submitSubscription">
        <h2 class="mac-sheet__title">导入订阅</h2>
        <label class="mac-field">
          <span>名称（可选，留空自动读取）</span>
          <input v-model="subscribeName" placeholder="自动使用订阅返回的名称" maxlength="24" />
        </label>
        <label class="mac-field">
          <span>Clash 订阅地址</span>
          <input v-model="subscribeUrl" placeholder="https://…" spellcheck="false" />
        </label>
        <p v-if="subscribeError" class="warn-inline">{{ subscribeError }}</p>
        <div class="dialog-actions">
          <button class="mac-btn mac-btn--ghost" type="button" @click="subscribeOpen = false">取消</button>
          <button class="mac-btn mac-btn--primary" type="submit" :disabled="proxy.busy || !subscribeUrl.trim()">
            {{ proxy.busy ? '下载中…' : '导入' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { CLOSE_ACTION_LABELS, type CloseAction } from '../../../common/window'
import { PRESET_COLORS, moduleSubtitle, type ModuleConfig, type ModuleKind } from '../modules/registry'
import { useModulesStore } from '../stores/modules'
import { useProxyStore } from '../stores/proxy'
import { formatSubscriptionRemaining } from '../lib/proxy-format'
import { defaultProxySettings, type ProxyProfile } from '../../../common/proxy'
import { idleUpdateState, type UpdateState } from '../../../common/update'
import {
  DEFAULT_CUSTOM_COLORS,
  useSettingsStore,
  EVA_ACCENT,
  NERV_ACCENT,
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
import evaPreview from '../assets/eva/eva-preview.png'
import evaRedScene from '../assets/eva/eva-red-scene.webp'

const modulesStore = useModulesStore()
const settings = useSettingsStore()

const tabs = [
  { id: 'modules' as const, label: '网站' },
  { id: 'appearance' as const, label: '外观' },
  { id: 'proxy' as const, label: '代理' },
  { id: 'general' as const, label: '通用' }
]
const tab = ref<(typeof tabs)[number]['id']>('modules')

const proxy = useProxyStore()

const proxySettings = computed(() => proxy.snapshot?.settings ?? defaultProxySettings())

/* ── 关窗行为 ── */
const closeOptions: { id: CloseAction; label: string }[] = [
  { id: 'ask', label: CLOSE_ACTION_LABELS.ask },
  { id: 'tray', label: CLOSE_ACTION_LABELS.tray },
  { id: 'quit', label: CLOSE_ACTION_LABELS.quit }
]
const closeAction = ref<CloseAction>('ask')

async function setCloseAction(action: CloseAction) {
  // 先本地更新，点击即时反馈，不用等主进程往返
  closeAction.value = action
  const saved = await window.workbench?.setCloseAction(action)
  if (saved) closeAction.value = saved
}

onMounted(async () => {
  const saved = await window.workbench?.getCloseAction()
  if (saved) closeAction.value = saved
})

/* ── 应用更新 ── */
const updateState = ref<UpdateState>(idleUpdateState())
const appVersion = ref('')
let offUpdate: (() => void) | undefined

const updateDot = computed(() => {
  switch (updateState.value.status) {
    case 'available':
    case 'downloaded':
      return 'is-on'
    case 'downloading':
    case 'checking':
      return 'is-idle'
    case 'error':
      return 'is-error'
    default:
      return 'is-off'
  }
})

const updateTitle = computed(() => {
  const s = updateState.value
  switch (s.status) {
    case 'checking':
      return '正在检查更新…'
    case 'available':
      return `发现新版本 v${s.version}`
    case 'downloading':
      return `正在下载 v${s.version}`
    case 'downloaded':
      return `v${s.version} 已就绪`
    case 'none':
      return '已是最新版本'
    case 'error':
      return '检查更新失败'
    default:
      return `鲸汐 v${appVersion.value || '—'}`
  }
})

const updateSub = computed(() => {
  const s = updateState.value
  switch (s.status) {
    case 'checking':
      return '正在向 GitHub 查询最新版本'
    case 'available':
      return '下载完成后提示重启，安装会直接覆盖当前版本'
    case 'downloading':
      return `${s.percent}% · ${formatSize(s.downloaded)} / ${formatSize(s.total)}`
    case 'downloaded':
      return '重启后覆盖安装，配置与登录状态都会保留'
    case 'none':
      return '启动时也会自动检查一次'
    case 'error':
      return '可以稍后重试，或到 GitHub Releases 手动下载'
    default:
      return '启动时自动检查，也可以手动检查'
  }
})

function formatSize(bytes: number): string {
  if (!bytes) return '0 MB'
  return `${(bytes / 1048576).toFixed(1)} MB`
}

async function checkUpdate() {
  const api = window.workbench?.update
  if (!api) return
  updateState.value = await api.check()
}

async function startDownload() {
  const api = window.workbench?.update
  if (!api) return
  updateState.value = await api.download()
}

async function installUpdate() {
  await window.workbench?.update?.install()
}

function profileMeta(p: ProxyProfile): string {
  const source = p.source === 'subscription' ? '订阅' : '本地文件'
  const time = p.updatedAt ? new Date(p.updatedAt).toLocaleString('zh-CN') : '未知时间'
  const usage = p.subscription?.usage
  const traffic = usage ? ` · ${formatSubscriptionRemaining(usage)}` : ''
  return `${source} · ${p.nodeCount || 0} 个节点${traffic} · ${time}`
}

const subscribeOpen = ref(false)
const subscribeUrl = ref('')
const subscribeName = ref('')
const subscribeError = ref('')
const pendingProfile = ref<ProxyProfile | null>(null)

function openSubscribe() {
  subscribeName.value = ''
  subscribeUrl.value = ''
  subscribeError.value = ''
  subscribeOpen.value = true
}

async function submitSubscription() {
  subscribeError.value = ''
  const ok = await proxy.setSubscription(subscribeUrl.value, subscribeName.value.trim() || undefined)
  if (!ok) {
    subscribeError.value = proxy.notice || '导入失败'
    return
  }
  subscribeOpen.value = false
}

async function confirmRemoveProfile() {
  const target = pendingProfile.value
  if (!target) return
  await proxy.removeProfile(target.id)
  pendingProfile.value = null
}

async function setPort(key: 'mixedPort' | 'controllerPort', e: Event) {
  const value = Number((e.target as HTMLInputElement).value)
  if (!Number.isFinite(value) || value < 1024 || value > 65535) {
    proxy.flash('端口需要是 1024–65535 之间的整数', 'error')
    await proxy.refresh()
    return
  }
  await proxy.patchSettings({ [key]: value })
}

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
  {
    id: 'eva',
    label: '初号机 · EVA-01',
    desc: '紫绿机体 · MAGI 终端',
    preview: '',
    previewImage: evaPreview
  },
  {
    id: 'eva-red',
    label: '警戒态 · EVA-02',
    desc: '红白机体 · 同级警报',
    preview: '',
    previewImage: evaRedScene
  },
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
const picking = ref(false)
const formError = ref('')
const showNativeAdvanced = ref(false)
const form = reactive({
  kind: 'web' as ModuleKind,
  name: '',
  url: '',
  color: '#14B8A6',
  processName: '',
  windowTitle: '',
  className: '',
  executablePath: '',
  arguments: '',
  launchOnOpen: false
})

/** 当前外壳是否提供原生窗口托管；Electron 壳没有。 */
const nativeSupported = computed(() => !!window.workbench?.android)

const pendingRemove = ref<ModuleConfig | null>(null)
const removing = ref(false)

onMounted(async () => {
  await settings.refreshLoginItem()
  await proxy.refresh()

  const api = window.workbench
  if (api?.update) {
    appVersion.value = (await api.getAppInfo()).version
    updateState.value = await api.update.state()
    offUpdate = api.update.onChange((state) => {
      updateState.value = state
    })
  }
})

onBeforeUnmount(() => {
  offUpdate?.()
})

function onThemeSelect(id: ThemeId) {
  const patch: { theme: ThemeId; accent?: string; custom?: CustomThemeColors } = { theme: id }
  if (id === 'whale' || id === 'whale-night') patch.accent = WHALE_ACCENT
  if (id === 'orca' || id === 'orca-night') patch.accent = ORCA_ACCENT
  if (id === 'eva') patch.accent = EVA_ACCENT
  if (id === 'eva-red') patch.accent = NERV_ACCENT
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

function resetForm() {
  form.kind = 'web'
  form.name = ''
  form.url = 'https://'
  form.color = '#14B8A6'
  form.processName = ''
  form.windowTitle = ''
  form.className = ''
  form.executablePath = ''
  form.arguments = ''
  form.launchOnOpen = false
  showNativeAdvanced.value = false
}

function openCreate(kind: ModuleKind = 'web') {
  editingId.value = null
  resetForm()
  form.kind = kind
  form.url = kind === 'native' ? '' : 'https://'
  formError.value = ''
  dialogOpen.value = true
}

function openEdit(m: ModuleConfig) {
  editingId.value = m.id
  resetForm()
  form.kind = m.kind === 'native' ? 'native' : 'web'
  form.name = m.name
  form.url = m.url
  form.color = m.color
  if (m.native) {
    form.processName = m.native.processName ?? ''
    form.windowTitle = m.native.windowTitle ?? ''
    form.className = m.native.className ?? ''
    form.executablePath = m.native.executablePath ?? ''
    form.arguments = m.native.arguments ?? ''
    form.launchOnOpen = m.native.launchOnOpen === true
  }
  showNativeAdvanced.value = !!(m.native?.windowTitle || m.native?.className || m.native?.executablePath || m.native?.arguments)
  formError.value = ''
  dialogOpen.value = true
}

/** 切换类型时清掉不属于该类型的输入，避免把网址写进原生模块。 */
function setKind(kind: ModuleKind) {
  if (form.kind === kind) return
  form.kind = kind
  formError.value = ''
  if (kind === 'native') {
    if (form.url === 'https://') form.url = ''
  } else if (!form.url.trim() || form.url.trim() === '') {
    form.url = 'https://'
  }
}

async function pickNativeWindow() {
  const api = window.workbench?.android
  if (!api) {
    formError.value = '当前外壳不支持选择窗口，请手动填写进程名'
    return
  }

  picking.value = true
  formError.value = ''
  try {
    const info = await api.pickWindow()
    if (!info) return
    form.processName = info.processName
    form.windowTitle = info.title
    form.className = info.className
  } catch (e: any) {
    formError.value = e?.message || '选择窗口失败'
  } finally {
    picking.value = false
  }
}

function closeDialog() {
  dialogOpen.value = false
}

async function onSave() {
  formError.value = ''
  const isNative = form.kind === 'native'
  if (!form.name.trim()) {
    formError.value = '请填写名称'
    return
  }
  if (isNative) {
    if (!form.processName.trim()) {
      formError.value = '请填写目标进程名，或用「选择窗口」自动填入'
      return
    }
  } else if (!form.url.trim()) {
    formError.value = '请填写网址'
    return
  }

  saving.value = true
  try {
    let id = editingId.value
    const native = isNative
      ? {
          processName: form.processName.trim(),
          windowTitle: form.windowTitle.trim() || undefined,
          className: form.className.trim() || undefined,
          executablePath: form.executablePath.trim() || undefined,
          arguments: form.arguments.trim() || undefined,
          launchOnOpen: form.launchOnOpen
        }
      : undefined
    const url = isNative ? form.url.trim() : form.url

    if (id) {
      modulesStore.updateModule(id, {
        kind: form.kind,
        name: form.name,
        url,
        color: form.color,
        native
      })
    } else {
      const created = modulesStore.addModule({
        kind: form.kind,
        name: form.name,
        url,
        color: form.color,
        native
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

.core-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--text-muted);
}

.core-dot.is-on {
  background: var(--success);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 22%, transparent);
}

.core-dot.is-idle {
  background: var(--warning);
}

.core-dot.is-error {
  background: var(--destructive);
}

.core-dot.is-off {
  background: transparent;
  border: 1px solid var(--border-strong);
}

.settings-input {
  margin-top: 5px;
  width: 100%;
  height: 30px;
  padding: 0 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg);
  font-size: var(--text-sm);
  transition: border-color var(--dur-fast) var(--ease);
}

.settings-input:focus {
  border-color: var(--border-focus);
}

.cfg-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: transparent;
  border: 1px solid var(--border-strong);
}

.cfg-dot.is-on {
  background: var(--success);
  border-color: transparent;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--success) 20%, transparent);
}

.cfg-badge {
  font-size: var(--text-xs);
  color: var(--success);
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--success) 12%, transparent);
  white-space: nowrap;
}

.cfg-toolbar {
  margin-top: var(--space-3);
  margin-bottom: 0;
}

.warn-inline {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--destructive);
}

.update-row {
  gap: var(--space-3);
  align-items: center;
}

.update-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--fill-tertiary);
  overflow: hidden;
}

.update-bar span {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 140ms linear;
}

.update-percent {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  min-width: 34px;
  text-align: right;
}

.port-input {
  width: 84px;
  margin-top: 0;
  text-align: center;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: min(440px, 52vw);
}

.sub-row {
  align-items: flex-end;
}

.sub-row .mac-row__text {
  flex: 1;
  min-width: 0;
}

.notice {
  margin: var(--space-3) 0 0;
  font-size: var(--text-sm);
  color: var(--success);
}

.notice.is-error {
  color: var(--destructive);
}

/* 模块弹窗：类型切换与原生应用字段 */

.kind-switch {
  display: flex;
  gap: var(--space-2);
}

.kind-switch > .mac-btn {
  flex: 1 1 0;
}

.field-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.field-row input {
  flex: 1 1 auto;
  min-width: 0;
}

.field-row .mac-btn {
  flex: 0 0 auto;
  height: 32px;
  padding: 0 var(--space-3);
}

.field-toggle {
  align-self: flex-start;
  margin: 0 0 var(--space-3);
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font-size: var(--text-sm);
  cursor: pointer;
}

.field-toggle:hover {
  text-decoration: underline;
}

.check-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
}

.check-row input {
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--accent);
}

</style>

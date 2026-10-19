# Workbench

个人桌面工作台客户端。基于 **Electron + Vue 3**，把常用的网站和本地小工具集中到一个带侧边栏的桌面应用里。

```
+--------------------------------------------------------------+
|  [_][_][_]   Workbench                                — □ ✕   |  自定义标题栏（非 macOS）
+--+-----------------------------------------------------------+
|🏠|                                                           |
|  |   首页仪表盘：下班倒计时 · 天气 · 便签（可拖拽布局）         |
|网|                                                           |
|  |   —— 或 ——                                                 |
|  |   模块视图：webview + 后退/前进/刷新 + 标签栏 + 地址栏       |
|⚙ |                                                           |
+--+-----------------------------------------------------------+
```

## 形态

不是浏览器，是一个**带侧边栏的客户端应用**：

- **侧边栏**：首页、若干网站模块、设置。可切换「舒适 / 紧凑」密度与是否显示文字标签。
- **首页仪表盘**：可拖拽、可开关的组件网格（下班倒计时 / 天气 / 便签），右键空白处打开布局设置。
- **模块视图**：每个模块在主区域嵌入对应网页，带独立的工具栏（后退 / 前进 / 刷新）、多标签页与地址栏。
- **设置页**：模块管理、外观、通用。

## 功能

### 网站模块
- 出厂默认：小红书 / B 站 / 微博 / 抖音 / 知乎 / GitHub。
- 设置里可增 / 删 / 改 / 排序；图标可改为本地图片文件（png/jpg/webp/ico/svg/gif）。
- 配置保存在本地 `localStorage`；模块图标保存在应用 `userData/module-icons`。
- 登录态（如小红书扫码登录）持久化在独立 `persist:workbench` 会话分区。

### 首页组件
- **下班倒计时**：记录上班时间，实时显示距离下班还有多久；到点前 3 分钟发系统通知提醒。
- **天气**：显示当地实时天气与三日预报，支持自动定位与手动选择城市。
- **便签**：本地备忘，关掉网页也还在。
- 布局（列数 / 间距 / 面板透明度 / 位置 / 跨度）全部可配置并持久化。

### 外观
- 10 套主题：`oled` / `slate` / `dim` / `light` / `paper` / `whale` / `whale-night` / `orca` / `orca-night` / `custom`。
- 鲸鱼 / 虎鲸（whale / orca）为「场景主题」，会在首页叠加动态装饰背景。
- 支持强调色、自定义主题配色、紧凑侧栏、状态栏与标签开关。

### 提醒
- 下班提醒由主进程用 `setTimeout` 调度，到点通过 Electron `Notification` 弹系统通知，并向渲染进程回传 `reminder:fired` 事件。

## 快捷键

- `Ctrl+L` / `Cmd+L`：显示 / 隐藏地址栏
- `Ctrl+R` / `Cmd+R`：刷新当前模块
- `Ctrl+,` / `Cmd+,`：打开设置

## 安全模型

- 渲染进程 `sandbox: true` + `contextIsolation: true` + `nodeIntegration: false`。
- 模块 webview 走独立 `partition`，禁用 Node 集成；`will-attach-webview` 统一清掉访客页 preload。
- 拦截非 http(s)/about/file 的外部协议（避免 Windows 弹「需要新应用打开此链接」），主窗口与访客弹窗的开窗策略统一走 `setWindowOpenHandler`（一律拒绝，站点内新窗口改为应用内新标签）。
- `wbicon` 私有协议读取用户图标文件时做了路径穿越防护。

## 目录

```
src/
├── main/index.ts              # 主进程：窗口、IPC、会话、协议、提醒
├── main/reminders.ts          # 下班提醒调度与系统通知
├── preload/index.ts           # 上下文桥（暴露 window.workbench）
├── common/guest-session.ts    # 访客会话分区与 UA
└── renderer/src/
    ├── main.ts                # 渲染入口
    ├── App.vue                # 顶层布局（侧栏 / 主区 / 状态栏）
    ├── styles.css             # 设计令牌
    ├── stores/                # Pinia：settings / modules / home-widgets / attendance / notes
    ├── modules/registry.ts    # 默认模块与配色
    ├── home/registry.ts       # 首页组件注册表
    ├── lib/                   # weather / home-grid / attendance-calendar / china-places / page-tabs / favicon
    └── components/            # Sidebar / Workspace / Settings / HomeDashboard(首页容器) / Home* / StatusBar / TitleBar / WindowControls …
```

> 注：`HomeDashboard.vue` 是「首页仪表盘容器」，负责渲染 widget 网格与右键菜单（原名 `EmptyState.vue`，已按实际职责改名）。

## 启动

```
npm install
npm run dev
```

## 脚本

| 脚本 | 作用 |
| --- | --- |
| `npm run dev` | 开发模式启动 |
| `npm run build` | 先 `typecheck` 再 `electron-vite build`（产物在 `out/`） |
| `npm run pack` | 构建后产出免安装目录 `dist/win-unpacked/` |
| `npm run dist` | 构建后打 Windows 安装包 + 免安装单文件 |
| `npm run preview` | 预览打包结果 |
| `npm run typecheck` | 对 main / web 两份 tsconfig 做类型检查 |
| `npm run lint` / `lint:fix` | ESLint 检查 / 自动修复 |
| `npm run format` | Prettier 格式化 |
| `npm run icons` | 由 `resources/icon.png` 生成各尺寸图标 |
| `npm run whale-assets` / `maid-assets` | 优化主题装饰资源 |

## 打包

- 构建工具：`electron-vite`；分发打包：`electron-builder`（配置在 `package.json` 的 `build` 字段）。
- 一条命令出包：`npm run dist`（会先跑 `typecheck` + 构建）。
- Windows 产物（输出到 `dist/`）：
  - `Workbench-<version>-x64.exe` — NSIS 安装包（非一键安装，可改安装目录，创建桌面/开始菜单快捷方式）
  - `Workbench-<version>-portable.exe` — 免安装单文件，双击即用
  - `win-unpacked/` — 未压缩目录，便于排查问题
- `appId` 为 `com.workbench.app`，窗口与安装包图标使用 `resources/icon.ico`；图标等资源通过 `extraResources` 分发到 `process.resourcesPath`。
- `vue` / `pinia` 只被渲染层使用且已由 Vite 打进 bundle，因此归在 `devDependencies`，不进 `app.asar`。
- 未配置代码签名，安装时 Windows SmartScreen 可能提示"未知发布者"，选择"仍要运行"即可。
- 若 Electron 运行时下载失败（网络受限），可指定镜像：
  `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run dist`


## 配置持久化位置

- 外观 / 模块 / 首页布局 / 考勤 / 天气偏好：`localStorage`（键名前缀 `workbench.*`）。
- 模块图标：`app.getPath('userData')/module-icons`。
- 开机自启：通过 `app.setLoginItemSettings` 控制（设置页「通用」里切换）。

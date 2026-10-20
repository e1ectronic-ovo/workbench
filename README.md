# Workbench

个人桌面工作台客户端。基于 **Electron + Vue 3**，把常用的网站和本地小工具集中到一个带侧边栏的桌面应用里。

```
+--------------------------------------------------------------+
|  [_][_][_]   Workbench                                — □ ✕   |  自定义标题栏（非 macOS）
+--+-----------------------------------------------------------+
|🏠|                                                           |
|  |   首页仪表盘：下班倒计时 · 天气 · 便签 · 网络代理（可拖拽）    |
|网|                                                           |
|  |   —— 或 ——                                                 |
|  |   模块视图：webview + 后退/前进/刷新 + 标签栏 + 地址栏       |
|⚙ |                                                           |
+--+-----------------------------------------------------------+
```

## 形态

不是浏览器，是一个**带侧边栏的客户端应用**：

- **侧边栏**：首页、若干网站模块、设置。可切换「舒适 / 紧凑」密度与是否显示文字标签。
- **首页仪表盘**：可拖拽、可开关的组件网格（下班倒计时 / 天气 / 便签 / 网络代理），右键空白处打开布局设置。
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
- **网络代理**：内置 mihomo 内核的开关、当前节点、上下行速率曲线与模式切换。
- 布局（列数 / 间距 / 面板透明度 / 位置 / 跨度）全部可配置并持久化。

### 网络代理

Workbench 自己就是代理客户端，不依赖 FLClash / Clash Verge 在后台常驻。

- **内核**：`mihomo` 以独立子进程运行，由主进程托管（启动、健康检查、崩溃重启、退出强杀）。
  内核随安装包分发，位置固定在应用资源目录，不需要用户配置路径。
- **配置来源**：机场 Clash 订阅链接，或本地 `.yaml` / `.yml` 文件。
  订阅下载后原样保留规则与策略组，只覆盖 `mixed-port` / `allow-lan` / `external-controller` / `secret` / `mode` 这几个顶层键。
- **多配置**：可以同时保存多份订阅 / 本地配置，在首页卡片右下角或「设置 → 代理」里随时切换；
  切换会重写 `config.yaml` 并重启内核。应用启动时不预置任何配置，也不做自动迁移。
- **测速**：节点列表里手动点「测速」跑整组（并发 6），也可点单个节点的延迟数字单独重测；不会自动测速。
- **控制通道**：内核的 `external-controller` 只监听 `127.0.0.1`，密钥每次安装随机生成；
  渲染进程不直连 HTTP，一律走 IPC，避免 CORS 与密钥泄漏。
- **GeoIP 数据**：`resources/core/geodata/` 里的 `geoip.metadb` / `geosite.dat` 会在启动内核前预置到工作目录，
  避免内核在代理还没起来时先联网下载数据；本地文件明显偏小（上次下载中断的残留）会被自动替换。
  健康检查窗口 90 秒，足够覆盖首次初始化。
- **系统代理**：启动后自动接管 Windows 系统代理（含 `ProxyOverride` 本地直连），
  退出前自动还原；若上次被强杀，下次启动会先把备份还原回去，避免整机断网。
  首页卡片的开关是运行期开关，关掉只释放系统代理，内核继续运行。
- **暂未实现**：TUN 模式（需要 wintun 驱动与管理权限）、规则在线编辑。

## 更新

- 应用通过 `electron-updater` 检查 GitHub Releases，启动 8 秒后自动检查一次，也可在「设置 → 通用 → 版本」手动检查。
- 发现新版本会弹窗询问，确认后后台下载（带进度），完成后提示「立即重启安装」；
  安装为 NSIS 覆盖升级，`userData`（配置、登录态）保留。
- 更新源固定为 `e1ectronic-ovo/workbench`，配置在 `package.json` 的 `build.publish`。
  仓库必须是**公开**的，否则客户端拿不到 `latest.yml`。

> 分发注意：mihomo 与 FLClash 均为 GPL-3.0。这里以独立进程方式调用，未链接进应用代码，
> 分发时请随包提供其许可证文本与源码获取方式。

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
├── main/proxy/                # 代理：内核进程、配置生成、REST 客户端、系统代理
│   ├── index.ts               #   ProxyService：状态机、轮询、IPC 注册
│   ├── core.ts                #   mihomo 子进程生命周期与日志
│   ├── config.ts              #   订阅下载、YAML 顶层覆盖、配置落盘
│   ├── api.ts                 #   external-controller REST 封装
│   ├── settings.ts            #   userData/proxy/settings.json
│   └── system-proxy.ts        #   Windows 系统代理写入与还原
├── preload/index.ts           # 上下文桥（暴露 window.workbench）
├── common/guest-session.ts    # 访客会话分区与 UA
├── common/proxy.ts            # 代理模块共享类型
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

> 不要直接双击 `node_modules/electron/dist/electron.exe`——它拿不到应用路径，会报
> `Unable to find Electron app at C:\WINDOWS\system32`。想要双击启动的产物，用 `npm run pack`
> 生成 `dist/win-unpacked/Workbench.exe`，或 `npm run dist` 生成安装包 / 免安装单文件。

## 脚本

| 脚本 | 作用 |
| --- | --- |
| `npm run dev` | 开发模式启动 |
| `npm run build` | 先 `typecheck` 再 `electron-vite build`（产物在 `out/`） |
| `npm run core` | 检查 / 下载 mihomo 内核与 GeoIP 数据到 `resources/core/` |
| `npm run pack` | 拉内核 + 构建后产出免安装目录 `dist/win-unpacked/` |
| `npm run dist` | 拉内核 + 构建后打 Windows 安装包 + 免安装单文件 |
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
- 代理内核通过 `extraResources` 从 `resources/core` 分发到安装包的 `resources/core`，
  asar 里的可执行文件无法直接运行，所以必须放在包外。
- `npm run pack` / `npm run dist` 会先跑 `scripts/fetch-core.mjs`：缺内核就按平台从 GitHub（带镜像回退）下载，
  校验能跑起来再继续；所以出包不需要手动放文件。
  已有内核时脚本会跳过联网，`--force` 可强制刷新，`MIHOMO_SKIP_FETCH=1` 可完全跳过检查。
- `vue` / `pinia` 只被渲染层使用且已由 Vite 打进 bundle，因此归在 `devDependencies`，不进 `app.asar`。
- 未配置代码签名，安装时 Windows SmartScreen 可能提示"未知发布者"，选择"仍要运行"即可。
- 若 Electron 运行时下载失败（网络受限），可指定镜像：
  `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run dist`


## 配置持久化位置

- 外观 / 模块 / 首页布局 / 考勤 / 天气偏好：`localStorage`（键名前缀 `workbench.*`）。
- 模块图标：`app.getPath('userData')/module-icons`。
- 代理：`userData/proxy/` 下的 `settings.json`（端口、自启、内核路径）、
  `profile.yaml`（订阅或本地文件原文）、`config.yaml`（叠加运行参数后的实际配置）、
  `system-proxy.json`（接管前的系统代理备份，用于退出还原）。
- 开机自启：通过 `app.setLoginItemSettings` 控制（设置页「通用」里切换）。

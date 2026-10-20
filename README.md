# 鲸汐 · Whaletide

个人桌面工作台客户端。基于 **Electron + Vue 3**，把常用的网站和本地小工具集中到一个带侧边栏的桌面应用里。

> 0.3.0 起由 **Workbench** 更名为 **鲸汐（Whaletide）**，图标同时换成鲸鱼娘形象。
> 改名只影响显示名，技术标识（`appId`、`window.workbench` 桥、`localStorage` 键名、`persist:workbench` 会话分区）
> 全部保持原样；老用户的数据目录会被原样沿用，不做任何搬移（见「更新」）。

```
+--------------------------------------------------------------+
|  [_][_][_]   鲸汐                                     — □ ✕   |  自定义标题栏（非 macOS）
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
- **单实例**：重复启动不会开出第二个窗口，而是把已有窗口唤到前台；开机自启带 `--hidden` 的
  重复启动静默退出，不弹窗。这一点对内置代理是必需的——两个实例会各自拉起一个 mihomo 抢同一组端口、
  互相覆盖系统代理与注册表备份。

## 功能

### 网站模块
- 出厂不预置站点：首次启动侧栏只有首页与设置，网站全部由用户自己添加。
  老版本已经写进本地的站点属于用户数据，升级时不会做任何清理。
- 设置里可增 / 删 / 改 / 排序；图标可改为本地图片文件（png/jpg/webp/ico/svg/gif）。
- 配置保存在本地 `localStorage`；模块图标保存在应用 `userData/module-icons`。
- 登录态（如小红书扫码登录）持久化在独立 `persist:workbench` 会话分区。

### 首页组件
- **下班倒计时**：记录上班时间，实时显示距离下班还有多久；到点前 3 分钟发系统通知提醒。
- **天气**：显示当地实时天气与三日预报，支持自动定位与手动选择城市。
- **便签**：本地备忘，关掉网页也还在。
- **网络代理**：内置 mihomo 内核的开关、当前节点、上下行速率曲线与模式切换。
- 布局（列数 / 间距 / 面板透明度 / 位置 / 跨度）全部可配置并持久化。

### 托盘与窗口
- **任务栏托盘**：右键出菜单（打开主界面 / 退出），左键直接开窗。托盘必须存在——
  关掉窗口后代理内核还在后台跑着，没有托盘用户就找不到「彻底退出」的入口了。
  Windows 11 默认把新图标收进通知区溢出栏（^），需要在任务栏设置里手动允许显示。
- **关窗不退出**：点关闭按钮时默认弹一次确认框（收进托盘 / 退出程序），可勾选「记住我的选择」；
  之后可以在 设置 → 通用 → 窗口 里改。收进托盘后进程继续运行，代理与登录状态都保留。
- **重复启动唤起**：再次双击图标（或托盘）会把已隐藏的窗口唤回前台，不会多开进程，
  也就不会出现两个 mihomo 抢端口、互相覆盖系统代理的情况。

### 网络代理

鲸汐自己就是代理客户端，不依赖 FLClash / Clash Verge 在后台常驻。

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
- **不会动用户数据**：安装目录（`%LOCALAPPDATA%\Programs\Whaletide`）和数据目录（`%APPDATA%\Whaletide`）
  是两棵树，升级只替换前者。`nsis.deleteAppDataOnUninstall: false` 保证连卸载都不会删数据；
  升级时旧版本卸载器会先跑一遍，这个开关同样生效。
- **改名后的数据落地**：`appId` 没有变，所以 NSIS 升级链路不断；但 `productName` 变了，
  数据目录名会跟着变。启动时主进程会检查：若 `%APPDATA%\Workbench` 存在且非空、而新目录还不存在，
  就直接把 `userData` 指回旧目录 —— **不复制、不搬移、不删除**，配置 / 登录态 / 代理订阅零风险。
  全新安装的用户才会落到 `%APPDATA%\Whaletide`。
- 改名这一次的安装目录也会变（从 `Programs\Workbench` 到 `Programs\Whaletide`），
  首次升级后旧的安装目录和开始菜单项会残留一份，可以手动删除。

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
> 生成 `dist/win-unpacked/Whaletide.exe`，或 `npm run dist` 生成安装包 / 免安装单文件。

## 脚本

| 脚本 | 作用 |
| --- | --- |
| `npm run dev` | 开发模式启动 |
| `npm run build` | `typecheck` → 生成图标 → `electron-vite build`（产物在 `out/`） |
| `npm run core` | 检查 / 下载 mihomo 内核与 GeoIP 数据到 `resources/core/` |
| `npm run pack` | 拉内核 + 构建后产出免安装目录 `dist/win-unpacked/` |
| `npm run dist` | 拉内核 + 构建后打 Windows 安装包 + 免安装单文件 |
| `npm run preview` | 预览打包结果 |
| `npm run typecheck` | 对 main / web 两份 tsconfig 做类型检查 |
| `npm run lint` / `lint:fix` | ESLint 检查 / 自动修复 |
| `npm run format` | Prettier 格式化 |
| `npm run icons` | 合成图标（`build` 已自动调用，一般不用手动跑）：底板 + 鲸鱼娘头像 → `icon.png` / `icon.ico` |
| `npm run whale-assets` / `maid-assets` | 优化主题装饰资源 |

## 图标

图标不再是手绘 SVG 一次性产物，而是**由源图在构建时合成**：

```
resources/icon-frame.svg   矢量底板（深海蓝渐变 / 天蓝光晕 / 暗角）
        +                                    ──► 1024 主图 ──► resources/icon.png (512)
src/renderer/src/assets/whale/logo.png   鲸鱼娘头像        ├──► resources/icon.ico (16~256)
                                                          └──► resources/tray.ico (16~64)
```

- 生成脚本 `scripts/generate-icons.mjs`：头像 lanczos3 放大 + 轻度锐化，按 alpha 生成轮廓投影，
  与底板合成；ico 各尺寸**都由 1024 主图单独降采样**，不逐级缩放。
- `tray.ico` 只保留 16~64px（Windows 通知区在 100%~400% 缩放下取 16/20/24/32/40/48），
  单独一份是为了让托盘图标各档缩放都清晰，不用把 256px 的大图塞进通知区再缩小。
- 已接入 `npm run build`，因此 `npm run pack` / `npm run dist` / CI 出包的图标**永远与源图一致**，
  不存在“改了头像忘了重新生成”的漏项。
- 产物是确定性的，且只在内容变化时写盘（不刷 mtime、不污染 git），重复构建不会触发多余的重新打包。
- 脚本自带校验：`icon.png` 必须是 512×512，`icon.ico` 必须包含 16~256 全尺寸，
  尤其不能缺 256×256（electron-builder 会直接拒绝打包）。校验失败以非 0 退出，构建立即中断。
- CI 另外会比对 `resources/` 是否被重新生成改动过，不一致时给出告警注解——只告警不阻断，
  因为不同平台的 libvips 采样存在微小差异。

## 打包

- 构建工具：`electron-vite`；分发打包：`electron-builder`（配置在 `package.json` 的 `build` 字段）。
- 一条命令出包：`npm run dist`（会先跑 `typecheck` + 生成图标 + 构建）。
- Windows 产物（输出到 `dist/`）：
  - `Whaletide-<version>-x64.exe` — NSIS 安装包（非一键安装，可改安装目录，创建桌面/开始菜单快捷方式）
  - `Whaletide-<version>-portable.exe` — 免安装单文件，双击即用
  - `win-unpacked/` — 未压缩目录，便于排查问题
- 显示名与文件名：界面、窗口标题、开始菜单快捷方式用中文名 **鲸汐**；`productName` 用 ASCII 的
  `Whaletide`，避免安装包文件名、安装路径出现中文导致的编码问题。
- 安装向导在「选择安装位置」之后有一页「选择附加任务」，可勾选**是否创建桌面快捷方式**（默认勾选）。
  - 实现见 `build/installer.nsh`（electron-builder 默认加载该路径）。
  - 采取「先建后删」：`addDesktopLink` 照常建链，`customInstall` 在用户取消勾选时才删除，
    这样卸载器的 `$oldDesktopLink` 清理逻辑完全不受影响，不会留下删不掉的残留快捷方式。
  - 升级安装（`${isUpdated}`）会跳过这一页并保持现状，既不打搅用户，也不会把用户主动删掉的快捷方式又建回来。
  - **两个坑**：① `installer.nsh` 必须带 UTF-8 BOM——electron-builder 会把它 `!include` 到
    `installer.nsi` 模板最前面（在 `-INPUTCHARSET UTF8` 生效范围之外），没 BOM 中文会被按 ANSI 读出乱码；
    ② MUI2.nsh 是模板第 9 行才包含的，脚本里要在页头用 `MUI_HEADER_TEXT` 宏就得自己先
    `!include "MUI2.nsh"`（MUI2 有包含守卫，重复 include 无害）。这两个问题本地用
    electron-builder 缓存里的 `makensis.exe -INPUTCHARSET UTF8` 单独编译脚本就能复现。
- `appId` 仍为 `com.workbench.app`（**不要改**：改了 NSIS 会当成本应用重新安装，旧安装不会升级）。
  窗口与安装包图标使用 `resources/icon.ico`，资源通过 `extraResources` 分发到 `process.resourcesPath`。
- 代理内核通过 `extraResources` 从 `resources/core` 分发到安装包的 `resources/core`，
  asar 里的可执行文件无法直接运行，所以必须放在包外。
- `npm run pack` / `npm run dist` 会先跑 `scripts/fetch-core.mjs`：缺内核就按平台从 GitHub（带镜像回退）下载，
  校验能跑起来再继续；所以出包不需要手动放文件。
  已有内核时脚本会跳过联网，`--force` 可强制刷新，`MIHOMO_SKIP_FETCH=1` 可完全跳过检查。
- `vue` / `pinia` 只被渲染层使用且已由 Vite 打进 bundle，因此归在 `devDependencies`，不进 `app.asar`。
- 未配置代码签名，安装时 Windows SmartScreen 可能提示"未知发布者"，选择"仍要运行"即可。
- 若 Electron 运行时下载失败（网络受限），可指定镜像：
  `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm run dist`


## 发布

```bash
git tag v0.2.0
git push origin v0.2.0
```

- tag 触发 `.github/workflows/release.yml`：下载内核 → 构建 NSIS 安装包 → 用 `gh release create --latest`
  一次性发布 `latest.yml` 与安装包。
- 本地发布：先 `npm run dist`，再 `gh release create vX.Y.Z dist/*.exe dist/latest.yml --latest`。
  不要用 electron-builder 的 `--publish`：多个 target 并发上传会给同一个 tag 建出重复 Release，
  `releases/latest` 可能指向只有 blockmap 的那份，客户端就拿不到 `latest.yml` 了。
  为此 `npm run dist` 里显式带了 `--publish never` —— 否则在 tag 上构建时 electron-builder 会自动
  尝试上传，因为缺 `GH_TOKEN` 直接构建失败。
- 客户端靠 Release 里的 `latest.yml` 判断版本，因此**仓库必须是公开的**，Release 也要是正式版而不是 draft
  （`build.publish.releaseType` 已设为 `release`）。

## 配置持久化位置

- 外观 / 模块 / 首页布局 / 考勤 / 天气偏好：`localStorage`（键名前缀 `workbench.*`）。
- 模块图标：`app.getPath('userData')/module-icons`。
- 代理：`userData/proxy/` 下的 `settings.json`（端口、自启、内核路径）、
  `profile.yaml`（订阅或本地文件原文）、`config.yaml`（叠加运行参数后的实际配置）、
  `system-proxy.json`（接管前的系统代理备份，用于退出还原）。
- 开机自启：通过 `app.setLoginItemSettings` 控制（设置页「通用」里切换）。

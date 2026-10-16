# Workbench

个人桌面工作台客户端。基于 Electron + Vue 3。

## 形态

不是浏览器，是**带侧边栏的客户端应用**：

```
+------------------------------------------------------------+
| Workbench                                          [—][口][×]|
+--+---------------------------------------------------------+
|  | [小红书]   <module-badge>   ←    →    ↻   🔗            |
|  | [B 站]                                                  |
| 🟪|---------------------------------------------------------|
| 🏠|                                                       |
|  |             <webview> 显示当前模块的网页                |
|  |                                                       |
|  |                                                       |
|  |                                                       |
| ⚙ | <status: 模块名 · 当前 URL>                          |
+--+---------------------------------------------------------+
```

- 侧边栏 60px 宽，深色磨砂玻璃，每个图标是一个**模块**（小红书 / B 站 / 微博 / 抖音 / 知乎 / GitHub）
- 点击图标 → 主区域嵌入对应网页
- 主区域：模块 badge + 后退/前进/刷新/地址栏切换 + webview
- 顶部 titlebar + 右侧系统按钮
- 底部 statusbar

## 设计

- 暗色 OLED 底（`#0a0a0f`）+ 玻璃拟态侧栏
- 8dp 间距节奏，1.5 行高
- 模块自带品牌色（小红书红、B 站粉、微博橙…）
- 加载条、过渡动效、reduced-motion 兼容
- 4.5:1 文字对比度、可见 focus 环

## 启动

```
npm run dev
```

首次 Electron 二进制已就绪。

## 快捷键

- `Ctrl+1..9` 切换模块
- `Ctrl+L` 显示/隐藏地址栏
- `Ctrl+R` 刷新当前模块
- `Ctrl+,` 打开设置

## 设置

侧栏底部齿轮，或 `Ctrl+,`：

- **模块**：增删改排序；图标改为选择本地图片文件（png/jpg/webp/ico/svg）
- **外观**：主题（OLED / 石板 / 柔和）、强调色、紧凑侧栏、状态栏开关
- **通用**：开机自动启动、启动时隐藏

配置保存在本地；模块图标保存在应用 `userData/module-icons`。

应用窗口图标使用 `resources/icon.ico`（不再是 Electron 默认图标）。打包时同样走该资源。

## 登录小红书

1. `Ctrl+1` 切到小红书
2. 在打开的小红书网页上**扫码登录**
3. 登录态持久化在 `persist:workbench` session 分区

## 目录

```
src/
├── main/index.ts
├── preload/index.ts
└── renderer/src/
    ├── App.vue
    ├── styles.css              # OLED + 青绿设计令牌
    ├── stores/modules.ts       # 模块配置 + 运行状态
    ├── modules/registry.ts     # 默认模块
    └── components/
        ├── Sidebar.vue
        ├── Workspace.vue       # webview 主区域
        ├── Settings.vue        # 模块配置页
        ├── EmptyState.vue
        ├── TitleBar.vue
        └── StatusBar.vue
```

# 盐线 SALTLINE

内置应用。`index.html` 是一个自包含的单文件页面，随客户端发布，由主进程通过
`wbapp://saltline/index.html` 从本地读取。

- 来源：https://claude.ai/artifact/2UXyB49DrVHFfhTMdNDFTA（Claude Artifact，公开）
- 标题：Saltline (one-shotted version)
- 抓取日期：2026-11-11
- 大小：约 1.4 MB

## 做过什么处理

抓下来的是 Claude 的 artifact 外壳页，正文被包在 `<!-- frame-runtime -->` 里，
靠 `frame.claudeusercontent.com` 的运行时脚本加载。这里只保留了应用本身：

- 去掉 `frame-runtime` 的预置脚本和引导脚本（游戏代码里没有用到 `window.claude`
  或任何 `__FRAME_*` 变量，去掉不影响运行）；
- 补上 `<!doctype html>` / `<html>` / `<head>` / `<body>` 外壳，其余 HTML、CSS、
  JS 原样保留，没有改动游戏逻辑。

## 更新方式

重新抓一份 artifact 内容，按上面的方式剥掉 `frame-runtime` 外壳，覆盖本目录的
`index.html` 即可，不需要改代码。

## 网络依赖

页面里唯一的远程资源是 Google Fonts（`fonts.googleapis.com`，三套展示字体）。
断网时浏览器会回落到系统字体，游戏本身完全离线可玩，没有其它网络请求。

## 存档

游戏用 `localStorage` 存进度，origin 是 `wbapp://saltline`，落在客户端自己的数据
目录里；清空该模块数据即等于删档。

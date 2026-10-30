# 烬落 GREYFALL

内置应用。`index.html` 是一个完全自包含的单文件页面（字体已内联、零外部请求），
随客户端发布，由主进程通过 `wbapp://greyfall/index.html` 从本地读取，不访问网络。

- 来源：https://greyfall-ashen-descent.ayuotk01.chatgpt.site/
- 抓取日期：2026-10-30
- 大小：约 1.3 MB

## 更新方式

重新下载该地址的 `index.html` 覆盖本目录同名文件即可，不需要改代码。
若页面日后拆出独立资源文件（图片 / 音频 / js），保持相对路径放进本目录，
`wbapp://` 协议会按同样的相对路径提供。

## 存档

游戏用 `localStorage` 存进度，origin 是 `wbapp://greyfall`，
落在客户端自己的数据目录里；清空该模块数据即等于删档。

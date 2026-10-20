代理内核目录
=============

一、内核可执行文件
------------------

通常不用手动准备：`npm run pack` / `npm run dist` 会先跑 `scripts/fetch-core.mjs`，
按当前平台从 GitHub（带镜像回退）下载 mihomo 并校验可用性，再继续打包。
想单独准备可以用 `npm run core`（`--force` 强制刷新）。

也可以手动放文件，文件名必须是：

  Windows : mihomo.exe
  macOS   : mihomo
  Linux   : mihomo

下载地址（选对应平台的发布包，取包内的可执行文件）：
  https://github.com/MetaCubeX/mihomo/releases

开发模式下会读取 <项目>/resources/core/，
打包后会分发到 <安装目录>/resources/core/。

也可以在「设置 → 代理 → 内核」里直接指定任意路径，不必放在这里。

二、GeoIP / GeoSite 数据（geodata/，可选）
------------------------------------------

内核首次启动会先下载约 4–8 MB 的 GeoIP 数据，代理还没起来时这一步最容易卡住。
把下面几个文件放进 geodata/ 就能省掉这次联网：

  geoip.metadb   （默认使用）
  geosite.dat
  country.mmdb   （geodata-mode: true 时使用）
  geoip.dat      （geodata-mode: true 时使用）

下载地址：
  https://github.com/MetaCubeX/meta-rules-dat/releases

`npm run core` 会顺带把这两个文件下到 geodata/，已存在则跳过。
启动时若发现工作目录里对应文件缺失、或体积明显偏小（上次下载中断的残留），
会用这里的副本覆盖过去。

注意：mihomo 以独立进程运行，不链接进应用代码。分发时请连同
GPL-3.0 许可证文本与源码获取方式一并提供。

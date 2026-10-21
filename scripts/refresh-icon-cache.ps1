# 刷新 Windows 图标缓存
#
# 场景：重新打包 / 覆盖安装后，exe 内嵌图标已经更新，但桌面快捷方式、
# 任务栏、开始菜单仍显示旧图标 —— 这是 Windows Shell 的 iconcache_*.db
# 按「路径」缓存导致的，重装不一定会让它失效。
#
# 该脚本只删除图标缓存数据库（纯缓存，Explorer 会立即重建），
# 不动任何用户文件。执行期间桌面会短暂消失（Explorer 重启）。
#
# 用法：npm run icons:refresh

$ErrorActionPreference = 'Stop'

Write-Host '即将刷新 Windows 图标缓存：' -ForegroundColor Cyan
Write-Host '  1) 结束并重启 explorer.exe（桌面会闪一下，已打开的文件夹窗口会关闭）'
Write-Host '  2) 删除 %LOCALAPPDATA% 下的 iconcache_*.db 缓存文件'

$explorerDir = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Explorer'
$targets = @()
if (Test-Path $explorerDir) {
  $targets += Get-ChildItem -Path $explorerDir -Filter 'iconcache*.db' -File -Force -ErrorAction SilentlyContinue
}
$legacy = Join-Path $env:LOCALAPPDATA 'IconCache.db'
if (Test-Path $legacy) { $targets += Get-Item $legacy -Force }

Write-Host ''
Write-Host '将删除以下缓存文件：' -ForegroundColor Yellow
$targets | ForEach-Object { Write-Host ("  {0}  ({1:N0} 字节)" -f $_.FullName, $_.Length) }
Write-Host ''

Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

$removed = 0
foreach ($f in $targets) {
  try {
    Remove-Item -LiteralPath $f.FullName -Force -ErrorAction Stop
    $removed++
  } catch {
    Write-Host ("  跳过（被占用）：{0}" -f $f.Name) -ForegroundColor DarkYellow
  }
}

Start-Sleep -Milliseconds 400
Start-Process explorer.exe

Write-Host ("已删除 {0}/{1} 个缓存文件，explorer 已重启。" -f $removed, $targets.Count) -ForegroundColor Green
Write-Host '若个别图标仍是旧的，请对桌面空白处按 F5 刷新，或注销后重新登录。'

# 启用 AEHD 硬件加速（仅 AMD / Intel 平台需要，用 Hyper-V 的机器不要跑）
#
# 背景：Android 模拟器在 Windows 上有两种 CPU 虚拟化后端，
#   - WHPX：走 Windows Hypervisor Platform，兼容性好但每次 VM exit 开销大，
#           在 AMD 平台上明显偏慢（实测 11% user / 75% sys）。
#   - AEHD：Google 写的裸机驱动，直接吃 AMD-V / VT-x，快一档。
# 两者互斥：Hyper-V 一开着就只能用 WHPX。
#
# 本脚本做的事：
#   1. 关掉 hypervisorlaunchtype（重启后 WHPX 不再占用）
#   2. 下载并安装 AEHD 2.2.0
#   3. 提示重启
#
# 影响面：WSL2 / Docker Desktop / Windows 沙盒 / 内存完整性(HVCI) 依赖 Hyper-V，
# 关掉后它们会不可用。不用这些功能就没有代价。
#
# 用法：右键「使用 PowerShell 运行」，或在管理员 PowerShell 里执行
#   powershell -ExecutionPolicy Bypass -File .\enable-aehd.ps1

$ErrorActionPreference = 'Stop'

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
    Write-Host '[x] 需要管理员权限。请右键以管理员身份运行 PowerShell 再执行本脚本。' -ForegroundColor Red
    exit 1
}

Write-Host '=== 当前状态 ===' -ForegroundColor Cyan
$hv = Get-CimInstance -ClassName Win32_OptionalFeature -Filter "Name='HypervisorPlatform'" -ErrorAction SilentlyContinue
if ($hv) {
    Write-Host ("HypervisorPlatform (WHPX) 安装状态 = " + $hv.InstallState + "  (1=已启用)")
}
$wsl = Get-CimInstance -ClassName Win32_OptionalFeature -Filter "Name='Microsoft-Windows-Subsystem-Linux'" -ErrorAction SilentlyContinue
if ($wsl) {
    Write-Host ("WSL 安装状态 = " + $wsl.InstallState + "  (2=已禁用，说明关 Hyper-V 影响很小)")
}

Write-Host ''
Write-Host '=== 1/3 关闭 hypervisorlaunchtype ===' -ForegroundColor Cyan
bcdedit /set hypervisorlaunchtype off | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host '[x] bcdedit 失败。若启用了「设备加密 / BitLocker」，bcdedit 需要先挂起保护。' -ForegroundColor Red
    exit 1
}
Write-Host '[ok] 已设置为 off（重启后生效）'

Write-Host ''
Write-Host '=== 2/3 下载 AEHD 2.2.0 ===' -ForegroundColor Cyan
$zip = Join-Path $env:TEMP 'aehd-windows_v2.2.zip'
$dir = Join-Path $env:TEMP 'aehd-2.2'
$url = 'https://dl.google.com/android/repository/aehd-windows_v2.2.zip'
if (-not (Test-Path $zip) -or (Get-Item $zip).Length -lt 100KB) {
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
}
Write-Host ("[ok] " + $zip + "  " + [math]::Round((Get-Item $zip).Length/1KB,0) + " KB")

if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
Expand-Archive -LiteralPath $zip -DestinationPath $dir -Force

Write-Host ''
Write-Host '=== 3/3 安装驱动 ===' -ForegroundColor Cyan
Push-Location $dir
try {
    & "$dir\silent_install.bat"
} finally {
    Pop-Location
}

Write-Host ''
Write-Host '=== 验证 ===' -ForegroundColor Cyan
$drv = Join-Path $env:SystemRoot 'System32\drivers\aehd.sys'
if (Test-Path $drv) {
    Write-Host '[ok] aehd.sys 已安装'
} else {
    Write-Host '[!] 没找到 aehd.sys，驱动可能没装上（检查是否有安全软件拦截）' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '完成。现在需要重启一次：' -ForegroundColor Green
Write-Host '  1. 重启 Windows'
Write-Host '  2. 重启后在客户端里「停止引擎」再「启动引擎」'
Write-Host '  3. 设置页「安卓」面板里的加速后端应该显示 AEHD'
Write-Host ''
Write-Host '想改回去：bcdedit /set hypervisorlaunchtype auto 然后重启，'
Write-Host '并运行 silent_install.bat -u 卸载驱动。'

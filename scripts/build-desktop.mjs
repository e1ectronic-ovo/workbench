#!/usr/bin/env node
/**
 * 构建 / 启动 WPF 外壳（desktop/Whaletide.Desktop）。
 *
 * 存在的理由：
 *  1. 本机 `dotnet` 在 PATH 上指向 C:\Program Files\dotnet，那里没有 SDK；
 *     SDK 实际装在 %USERPROFILE%\.dotnet，需要显式定位。
 *  2. WPF 工程在构建时会把 out/renderer 拷进输出目录，所以必须先有渲染产物。
 *
 * 用法：
 *   node scripts/build-desktop.mjs              构建
 *   node scripts/build-desktop.mjs --run        构建并启动
 *   node scripts/build-desktop.mjs --self-test  构建并跑原生嵌入自检
 *   node scripts/build-desktop.mjs --release    用 Release 配置
 *   node scripts/build-desktop.mjs --rebuild    先重新构建渲染层
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const projectDir = path.join(root, 'desktop', 'src', 'Whaletide.Desktop')
const csproj = path.join(projectDir, 'Whaletide.Desktop.csproj')
const rendererEntry = path.join(root, 'out', 'renderer', 'index.html')

const argv = process.argv.slice(2)
const hasFlag = (name) => argv.includes(`--${name}`)
const configuration = hasFlag('release') ? 'Release' : 'Debug'

function log(message) {
  process.stdout.write(`[desktop] ${message}\n`)
}

function fail(message) {
  process.stderr.write(`[desktop] ${message}\n`)
  process.exit(1)
}

/** 找一个真的带 SDK 的 dotnet：PATH 上的可能是没有 SDK 的运行时安装。 */
function resolveDotnet() {
  const candidates = [
    process.env.DOTNET_ROOT && path.join(process.env.DOTNET_ROOT, 'dotnet.exe'),
    path.join(os.homedir(), '.dotnet', 'dotnet.exe'),
    'C:\\Program Files\\dotnet\\dotnet.exe'
  ].filter(Boolean)

  const seen = new Set()
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue
    seen.add(candidate)
    if (!fs.existsSync(candidate)) continue
    const probe = spawnSync(candidate, ['--list-sdks'], { encoding: 'utf8' })
    if (probe.status === 0 && probe.stdout.trim()) {
      return { exe: candidate, sdks: probe.stdout.trim() }
    }
  }

  // 最后再试一次 PATH 上的 dotnet（某些机器 SDK 就装在 Program Files 里）
  const probe = spawnSync('dotnet', ['--list-sdks'], { encoding: 'utf8', shell: true })
  if (probe.status === 0 && probe.stdout.trim()) {
    return { exe: 'dotnet', sdks: probe.stdout.trim() }
  }

  return null
}

function ensureRenderer() {
  if (!hasFlag('rebuild') && fs.existsSync(rendererEntry)) return
  log('渲染产物缺失，先执行 electron-vite build…')
  const build = spawnSync('npx', ['electron-vite', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: true
  })
  if (build.status !== 0) fail('渲染层构建失败')
}

/** 构建完成后从输出目录里找最新的 exe，避免手动拼 net10.0-windows 路径。 */
function findExe(outDir) {
  const stack = [outDir]
  let newest = null
  while (stack.length) {
    const current = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.name === 'Whaletide.Desktop.exe') {
        const stat = fs.statSync(full)
        if (!newest || stat.mtimeMs > newest.mtimeMs) newest = { path: full, mtimeMs: stat.mtimeMs }
      }
    }
  }
  return newest?.path ?? null
}

const dotnet = resolveDotnet()
if (!dotnet) {
  fail('找不到带 SDK 的 .NET 安装。请安装 .NET 10 SDK（https://aka.ms/dotnet/download）后重试。')
}
log(`使用 dotnet: ${dotnet.exe}`)
log(`可用 SDK: ${dotnet.sdks.split(/\r?\n/).map((l) => l.split(' ')[0]).join(', ')}`)

ensureRenderer()

if (!fs.existsSync(csproj)) fail(`找不到工程文件：${csproj}`)

log(`构建 ${configuration} …`)
const buildEnv = { ...process.env }
if (dotnet.exe !== 'dotnet') {
  buildEnv.DOTNET_ROOT = path.dirname(dotnet.exe)
  buildEnv.PATH = `${path.dirname(dotnet.exe)}${path.delimiter}${buildEnv.PATH ?? ''}`
}

const build = spawnSync(
  dotnet.exe,
  ['build', csproj, '-c', configuration, '--nologo', '-v', 'minimal'],
  { cwd: path.join(root, 'desktop'), stdio: 'inherit', env: buildEnv, shell: dotnet.exe === 'dotnet' }
)
if (build.status !== 0) fail('WPF 工程构建失败')

const exe = findExe(path.join(projectDir, 'bin', configuration))
if (!exe) fail('构建成功但没找到 Whaletide.Desktop.exe')
log(`产物: ${exe}`)

const mode = hasFlag('self-test')
  ? '--self-test'
  : hasFlag('probe')
    ? '--probe'
    : hasFlag('run')
      ? null
      : 'skip'
if (mode === 'skip') {
  log('构建完成。加 --run 启动外壳，--self-test 跑原生嵌入自检，--probe 取界面渲染快照。')
  process.exit(0)
}

const args = mode ? [mode] : []
log(`启动: ${path.basename(exe)} ${args.join(' ')}`.trim())
if (mode === '--probe') log('等待界面加载完成后自动退出…')

const run = spawnSync(exe, args, {
  cwd: path.dirname(exe),
  stdio: 'inherit',
  env: buildEnv,
  timeout: mode === '--probe' ? 60_000 : undefined
})

for (const [flag, file] of [
  ['--self-test', 'self-test.log'],
  ['--probe', 'probe.log']
]) {
  if (mode !== flag) continue
  const logFile = path.join(path.dirname(exe), file)
  if (fs.existsSync(logFile)) {
    log(`--- ${file} ---`)
    process.stdout.write(`${fs.readFileSync(logFile, 'utf8').trim()}\n`)
  } else {
    fail(`没有生成 ${file}，外壳可能没能启动`)
  }
}

process.exit(run.status ?? 0)

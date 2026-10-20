#!/usr/bin/env node
/**
 * 构建前确保 resources/core 里有 mihomo 内核与 GeoIP 数据。
 *
 * 用法：
 *   node scripts/fetch-core.mjs            # 缺失时下载
 *   node scripts/fetch-core.mjs --force    # 强制重下
 *   MIHOMO_SKIP_FETCH=1 npm run dist       # 跳过检查（内核已就位时可用）
 *
 * 已存在且能跑通 `-v` 时直接跳过，不会每次都联网。
 */
import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { readdir, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CORE_DIR = join(ROOT, 'resources', 'core')
const GEO_DIR = join(CORE_DIR, 'geodata')

const VERSION = process.env.MIHOMO_VERSION || 'v1.19.32'
const FORCE = process.argv.includes('--force')
const MIRRORS = ['', 'https://ghfast.top/', 'https://ghproxy.net/']

const GEO_FILES = [
  { name: 'geoip.metadb', url: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb' },
  { name: 'geosite.dat', url: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat' }
]

function binaryName() {
  return process.platform === 'win32' ? 'mihomo.exe' : 'mihomo'
}

/** 按平台/架构拼出发布包里的资源名 */
function assetName() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
  if (process.platform === 'win32') {
    return { file: `mihomo-windows-${arch}-${VERSION}.zip`, kind: 'zip' }
  }
  if (process.platform === 'darwin') {
    return { file: `mihomo-darwin-${arch}-${VERSION}.gz`, kind: 'gz' }
  }
  return { file: `mihomo-linux-${arch}-${VERSION}.gz`, kind: 'gz' }
}

async function download(url, dest) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'workbench-build' },
    signal: AbortSignal.timeout(120000)
  })
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest))
  return statSync(dest).size
}

/** 逐个镜像试，返回第一个成功的文件大小 */
async function downloadWithMirrors(path, dest) {
  let lastError = ''
  for (const prefix of MIRRORS) {
    const url = `${prefix}${path}`
    try {
      const size = await download(url, dest)
      if (size < 1024) throw new Error('文件过小')
      console.log(`  下载成功 ${(size / 1048576).toFixed(1)} MB ← ${prefix || 'github.com'}`)
      return size
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
      await unlink(dest).catch(() => {})
    }
  }
  throw new Error(lastError || '所有镜像均失败')
}

function extractZip(zip, outDir) {
  // Windows 10 1803+ 自带 bsdtar，能直接解 zip；其他平台退回 unzip
  try {
    execFileSync('tar', ['-xf', zip, '-C', outDir], { stdio: 'ignore' })
    return
  } catch {
    execFileSync('unzip', ['-o', '-q', zip, '-d', outDir], { stdio: 'ignore' })
  }
}

async function takeBinary(dir, target) {
  const entries = await readdir(dir)
  // 发布包里叫 mihomo-windows-amd64.exe，不是 mihomo.exe，按前缀兜底匹配
  const exe =
    entries.find((n) => n.toLowerCase() === binaryName().toLowerCase()) ??
    entries.find((n) => /^mihomo.*\.exe$/i.test(n)) ??
    entries.find((n) => /\.exe$/i.test(n))
  if (!exe) throw new Error(`压缩包里没找到可执行文件（${entries.join(', ')}）`)
  copyFileSync(join(dir, exe), target)
}

function probe(bin) {
  try {
    const out = execFileSync(bin, ['-v'], { encoding: 'utf8', timeout: 15000 })
    return out.split('\n')[0].trim()
  } catch {
    return ''
  }
}

async function ensureCore() {
  const bin = join(CORE_DIR, binaryName())
  if (!FORCE && existsSync(bin) && statSync(bin).size > 5 * 1048576) {
    const version = probe(bin)
    if (version) {
      console.log(`内核已就位：${version}`)
      return
    }
    console.log('内核文件存在但无法运行，重新下载…')
  }

  mkdirSync(CORE_DIR, { recursive: true })
  const { file, kind } = assetName()
  const path = `https://github.com/MetaCubeX/mihomo/releases/download/${VERSION}/${file}`
  const tmp = join(CORE_DIR, file)

  console.log(`下载内核 ${file} …`)
  await downloadWithMirrors(path, tmp)

  if (kind === 'gz') {
    writeFileSync(bin, gunzipSync(readFileSync(tmp)))
    rmSync(tmp, { force: true })
    if (process.platform !== 'win32') execFileSync('chmod', ['+x', bin])
  } else {
    const tmpDir = join(CORE_DIR, '.extract')
    rmSync(tmpDir, { recursive: true, force: true })
    mkdirSync(tmpDir, { recursive: true })
    extractZip(tmp, tmpDir)
    await takeBinary(tmpDir, bin)
    rmSync(tmpDir, { recursive: true, force: true })
    rmSync(tmp, { force: true })
  }

  const version = probe(bin)
  if (!version) throw new Error('内核下载后无法运行，请检查压缩包是否完整')
  console.log(`内核就绪：${version}`)
}

async function ensureGeodata() {
  mkdirSync(GEO_DIR, { recursive: true })
  for (const item of GEO_FILES) {
    const dest = join(GEO_DIR, item.name)
    if (!FORCE && existsSync(dest) && statSync(dest).size > 1024 * 1024) {
      continue
    }
    console.log(`下载 ${item.name} …`)
    // 先写临时文件，成功后再替换，避免下载中断把已有数据抹掉
    const tmp = `${dest}.tmp`
    try {
      await downloadWithMirrors(item.url, tmp)
      renameSync(tmp, dest)
    } catch (e) {
      // geo 数据可选：缺失时内核会在首次启动自行下载
      console.warn(`  跳过 ${item.name}：${e instanceof Error ? e.message : e}（内核会自行下载）`)
      await unlink(tmp).catch(() => {})
    }
  }
}

async function main() {
  if (process.env.MIHOMO_SKIP_FETCH === '1') {
    console.log('已跳过内核检查（MIHOMO_SKIP_FETCH=1）')
    return
  }
  if (!existsSync(CORE_DIR)) mkdirSync(CORE_DIR, { recursive: true })

  await ensureCore()
  await ensureGeodata()
  console.log(`内核目录：${join('resources', 'core')}`)
}

main().catch((e) => {
  console.error(`\n构建前的内核准备失败：${e instanceof Error ? e.message : e}`)
  console.error('可以手动把 mihomo 可执行文件放到 resources/core/，或用 MIHOMO_SKIP_FETCH=1 跳过。')
  console.error(`下载地址：https://github.com/MetaCubeX/mihomo/releases/tag/${VERSION}`)
  process.exit(1)
})

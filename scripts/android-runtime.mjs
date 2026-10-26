#!/usr/bin/env node
/**
 * 拉取并准备客户端自带的 Android 运行时（不需要 Java，不需要 Android Studio）。
 *
 * 装到 %LOCALAPPDATA%\Whaletide\android-sdk，包含：
 *   platform-tools\   adb
 *   emulator\         emulator.exe
 *   system-images\android-34\google_apis\x86_64\
 * 以及一个私有 AVD（whaletide）。
 *
 * 为什么不用 sdkmanager：它依赖 Java，而客户端不应该为了装个模拟器去要求用户装 JDK。
 * Google 的仓库索引是公开 XML，直接按坐标下载 zip 更稳。
 *
 * 用法：
 *   node scripts/android-runtime.mjs                 准备运行时
 *   node scripts/android-runtime.mjs --root D:\x    指定安装目录
 *   node scripts/android-runtime.mjs --verify        只检查现有运行时是否完整
 *   node scripts/android-runtime.mjs --avd-only      只重建 AVD 配置
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import https from 'node:https'

const API = 'android-34'
const TAG = 'google_apis'
const ABI = 'x86_64'
const REPO = 'https://dl.google.com/android/repository'
const AVD_NAME = 'whaletide'

const argv = process.argv.slice(2)
const hasFlag = (n) => argv.includes(`--${n}`)
const argValue = (n, fallback) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
}

const root = path.resolve(
  argValue('root', process.env.WHALETIDE_ANDROID_SDK || path.join(os.homedir(), 'AppData', 'Local', 'Whaletide', 'android-sdk'))
)

const log = (m) => process.stdout.write(`[android] ${m}\n`)
const fail = (m) => {
  process.stderr.write(`[android] ${m}\n`)
  process.exit(1)
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          fetchText(res.headers.location).then(resolve, reject)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`GET ${url} -> ${res.statusCode}`))
          res.resume()
          return
        }
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (c) => (body += c))
        res.on('end', () => resolve(body))
      })
      .on('error', reject)
  })
}

function download(url, dest, label) {
  return new Promise((resolve, reject) => {
    const go = (current, redirects = 0) => {
      if (redirects > 5) return reject(new Error('too many redirects'))
      https
        .get(current, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume()
            go(res.headers.location, redirects + 1)
            return
          }
          if (res.statusCode !== 200) {
            res.resume()
            return reject(new Error(`GET ${current} -> ${res.statusCode}`))
          }

          const total = Number(res.headers['content-length'] || 0)
          let received = 0
          let lastPrint = 0
          const out = fs.createWriteStream(dest)
          res.on('data', (chunk) => {
            received += chunk.length
            const now = Date.now()
            if (now - lastPrint > 4000) {
              lastPrint = now
              const pct = total ? ((received / total) * 100).toFixed(1) : '?'
              log(`  ${label} ${(received / 1048576).toFixed(1)}MB / ${(total / 1048576).toFixed(0)}MB (${pct}%)`)
            }
          })
          res.pipe(out)
          out.on('finish', () => out.close(() => resolve(dest)))
          out.on('error', reject)
        })
        .on('error', reject)
    }
    go(url)
  })
}

/** 从仓库 XML 里取某个包的归档地址。 */
function pickUrl(xml, packagePath) {
  const marker = `<remotePackage path="${packagePath}">`
  const idx = xml.indexOf(marker)
  if (idx < 0) throw new Error(`仓库里找不到 ${packagePath}`)
  const block = xml.slice(idx, xml.indexOf('</remotePackage>', idx))
  const urls = [...block.matchAll(/<url>([^<]+)<\/url>/g)].map((m) => m[1])
  // 注意 darwin 里也含 "win"，不能用 includes('win') 判断
  const windows = urls.find((u) => /-win\.zip$|windows_/i.test(u))
  if (windows) return windows
  // 系统镜像不分平台，归档名形如 x86_64-34_r14.zip
  if (urls.length >= 1) return urls[0]
  throw new Error(`${packagePath} 没有可用归档`)
}

const psQuote = (s) => `'${s.replace(/'/g, "''")}'`

function unzip(zip, destDir, cleanDir) {
  fs.mkdirSync(destDir, { recursive: true })
  // Git Bash 的 tar 会把 "C:\..." 里的 C: 当成远程主机名；Expand-Archive 对大镜像会报
  // 「文件头已损坏」。用 .NET 的 ZipFile 最稳（和客户端里的实现是同一套）。
  const script = [
    '$ErrorActionPreference = "Stop"',
    'Add-Type -AssemblyName System.IO.Compression.FileSystem',
    `if (Test-Path -LiteralPath ${psQuote(cleanDir)}) { Remove-Item -LiteralPath ${psQuote(cleanDir)} -Recurse -Force }`,
    `[System.IO.Compression.ZipFile]::ExtractToDirectory(${psQuote(zip)}, ${psQuote(destDir)})`
  ].join('; ')

  const ps = spawnSync('powershell', ['-NoProfile', '-Command', script], { stdio: 'inherit' })
  if (ps.status !== 0) fail(`解压失败：${zip}`)
}

function sdkPaths() {
  return {
    adb: path.join(root, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb'),
    emulator: path.join(root, 'emulator', process.platform === 'win32' ? 'emulator.exe' : 'emulator'),
    imageDir: path.join(root, 'system-images', API, TAG, ABI)
  }
}

function isReady() {
  const p = sdkPaths()
  return fs.existsSync(p.adb) && fs.existsSync(p.emulator) && fs.existsSync(path.join(p.imageDir, 'system.img'))
}

function writeAvd() {
  const avdHome = path.join(os.homedir(), '.android', 'avd')
  const avdDir = path.join(avdHome, `${AVD_NAME}.avd`)
  fs.mkdirSync(avdDir, { recursive: true })

  const config = [
    'avd.ini.encoding=UTF-8',
    'AvdId=' + AVD_NAME,
    `avd.ini.displayname=${AVD_NAME}`,
    `image.sysdir.1=system-images/${API}/${TAG}/${ABI}/`,
    `tag.id=${TAG}`,
    `tag.display=${TAG}`,
    'abi.type=' + ABI,
    'hw.cpu.arch=' + ABI,
    'hw.cpu.ncore=4',
    // 竖屏 1080x1920：短剧类应用按竖屏出片，横屏会强制黑边
    'hw.lcd.width=1080',
    'hw.lcd.height=1920',
    'hw.lcd.density=420',
    'hw.ramSize=3072',
    'vm.heapSize=512',
    'hw.keyboard=yes',
    'hw.gpu.enabled=yes',
    'hw.gpu.mode=auto',
    'disk.dataPartition.size=4096M',
    'fastboot.forceColdBoot=no',
    'showDeviceFrame=no',
    'PlayStore.enabled=false',
    'skin.dynamic=yes'
  ].join('\n')
  fs.writeFileSync(path.join(avdDir, 'config.ini'), config + '\n', 'utf8')

  const ini = [
    'avd.ini.encoding=UTF-8',
    `path=${avdDir.replace(/\\/g, '/')}`,
    `path.rel=avd/${AVD_NAME}.avd`,
    `target=${API}`
  ].join('\n')
  fs.writeFileSync(path.join(avdHome, `${AVD_NAME}.ini`), ini + '\n', 'utf8')

  log(`AVD 已写入 ${avdDir}`)
}

async function main() {
  log(`运行时目录：${root}`)

  if (hasFlag('verify')) {
    if (isReady()) {
      const p = sdkPaths()
      log(`OK adb=${p.adb}`)
      log(`OK emulator=${p.emulator}`)
      log(`OK image=${p.imageDir}`)
      process.exit(0)
    }
    fail('运行时还不完整，去掉 --verify 重新准备')
  }

  if (hasFlag('avd-only')) {
    writeAvd()
    return
  }

  fs.mkdirSync(root, { recursive: true })
  const cache = path.join(root, '.cache')
  fs.mkdirSync(cache, { recursive: true })

  if (!isReady()) {
    log('读取 Google 仓库索引…')
    const repoXml = await fetchText(`${REPO}/repository2-3.xml`)
    const sysImgXml = await fetchText(`${REPO}/sys-img/${TAG}/sys-img2-3.xml`)

    const jobs = [
      {
        name: 'platform-tools',
        url: pickUrl(repoXml, 'platform-tools'),
        base: `${REPO}/`,
        dest: path.join(root, 'platform-tools')
      },
      {
        name: 'emulator',
        url: pickUrl(repoXml, 'emulator'),
        base: `${REPO}/`,
        dest: path.join(root, 'emulator')
      },
      {
        name: 'system-image',
        url: pickUrl(sysImgXml, `system-images;${API};${TAG};${ABI}`),
        // 系统镜像不在仓库根下，在 sys-img/<tag>/ 下
        base: `${REPO}/sys-img/${TAG}/`,
        dest: path.join(root, 'system-images', API, TAG, ABI)
      }
    ];

    for (const job of jobs) {
      const zipPath = path.join(cache, `${job.name}.zip`)
      if (fs.existsSync(zipPath) && fs.statSync(zipPath).size > 1024 * 1024) {
        log(`复用已下载的 ${job.name}.zip`)
      } else {
        log(`下载 ${job.name} ← ${job.base}${job.url}`)
        await download(`${job.base}${job.url}`, zipPath, job.name)
      }
      log(`解压 ${job.name} → ${job.dest}`)
      // 三个包的 zip 根目录分别是 platform-tools/、emulator/、x86_64/，
      // 都解压到目标目录的父级；先清掉目标子目录，避免旧文件残留。
      unzip(zipPath, path.dirname(job.dest), job.dest)
    }
  } else {
    log('运行时已就绪，跳过下载')
  }

  writeAvd()

  const p = sdkPaths()
  log('完成。')
  log(`  adb      ${p.adb}`)
  log(`  emulator ${p.emulator}`)
  log(`  AVD      ${AVD_NAME}（${API} ${TAG} ${ABI}）`)
}

main().catch((err) => fail(err.stack || String(err)))

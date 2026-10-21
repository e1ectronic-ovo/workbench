/**
 * 从用户提供的 EVA 初号机参考图生成应用图标与托盘图标。
 *
 * 不再自行重绘矢量，主图标与托盘图标都直接从 resources/eva-reference.png
 * 裁切：主图标使用紫色圆角底板；托盘使用紫色/绿色圆环，并裁成透明圆形。
 *
 * Run: npm run icons
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const referencePath = join(root, 'resources', 'eva-reference.png')
const pngPath = join(root, 'resources', 'icon.png')
const icoPath = join(root, 'resources', 'icon.ico')
const trayPath = join(root, 'resources', 'tray.ico')
const trayPngPath = join(root, 'resources', 'tray.png')
const trayActivePath = join(root, 'resources', 'tray-active.ico')
const trayActivePngPath = join(root, 'resources', 'tray-active.png')

const APP_MASTER = 1024
const APP_RADIUS = 222
const TRAY_MASTER = 512
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
const TRAY_SIZES = [16, 20, 24, 32, 40, 48, 64]

/** 参考图中的桌面客户端图标（436×436，含外发光底板） */
const APP_CROP = { left: 246, top: 80, width: 436, height: 436 }
/** 参考图右上角“正常状态”托盘图标 */
const TRAY_IDLE_CROP = { left: 1014, top: 234, width: 188, height: 188 }
/** 参考图下方“激发中”绿色圆环托盘图标 */
const TRAY_ACTIVE_CROP = { left: 340, top: 690, width: 152, height: 152 }

const reference = readFileSync(referencePath)

function writeIfChanged(path, buf) {
  try {
    if (readFileSync(path).equals(buf)) return false
  } catch {
    // 文件不存在，照常写
  }
  writeFileSync(path, buf)
  return true
}

function assertIco(buf, expected, label) {
  if (buf.length < 6) throw new Error(`${label} 头部不完整`)
  const count = buf.readUInt16LE(4)
  const entries = []
  for (let i = 0; i < count; i += 1) {
    const off = 6 + i * 16
    if (off + 16 > buf.length) throw new Error(`${label} 目录表被截断`)
    entries.push({ width: buf[off] || 256, height: buf[off + 1] || 256 })
  }
  const missing = expected.filter((s) => !entries.some((e) => e.width === s && e.height === s))
  if (missing.length) throw new Error(`${label} 缺少尺寸：${missing.join(', ')}`)
  return entries.map((e) => e.width)
}

async function appMaster() {
  const rotated = await sharp(reference)
    .extract(APP_CROP)
    .rotate(-1.05, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(APP_MASTER, APP_MASTER, { fit: 'fill', kernel: 'lanczos3' })
    .ensureAlpha()
    .png()
    .toBuffer()
  const mask = Buffer.from(
    `<svg width="${APP_MASTER}" height="${APP_MASTER}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="${APP_MASTER}" height="${APP_MASTER}" rx="${APP_RADIUS}" fill="white"/>` +
      '</svg>',
  )
  return sharp(rotated)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function trayMaster(crop) {
  const cropped = await sharp(reference)
    .extract(crop)
    .resize(TRAY_MASTER, TRAY_MASTER, { fit: 'fill', kernel: 'lanczos3' })
    .ensureAlpha()
    .png()
    .toBuffer()
  const radius = TRAY_MASTER / 2 - 2
  const mask = Buffer.from(
    `<svg width="${TRAY_MASTER}" height="${TRAY_MASTER}" xmlns="http://www.w3.org/2000/svg">` +
      `<circle cx="${TRAY_MASTER / 2}" cy="${TRAY_MASTER / 2}" r="${radius}" fill="white"/>` +
      '</svg>',
  )
  return sharp(cropped)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

async function icoFrom(master, sizes) {
  const buffers = await Promise.all(
    sizes.map((s) => sharp(master).resize(s, s, { kernel: 'lanczos3' }).png().toBuffer()),
  )
  return pngToIco(buffers)
}

async function main() {
  if (!reference.length) throw new Error('resources/eva-reference.png 为空')
  const metadata = await sharp(reference).metadata()
  if ((metadata.width ?? 0) < 1200 || (metadata.height ?? 0) < 840) {
    throw new Error(`参考图尺寸异常：${metadata.width}×${metadata.height}`)
  }

  const app = await appMaster()
  const png = await sharp(app).resize(512, 512, { kernel: 'lanczos3' }).png().toBuffer()
  const pngMeta = await sharp(png).metadata()
  if (pngMeta.width !== 512 || pngMeta.height !== 512) {
    throw new Error(`icon.png 尺寸异常：${pngMeta.width}×${pngMeta.height}`)
  }
  const pngChanged = writeIfChanged(pngPath, png)

  const ico = await icoFrom(app, ICO_SIZES)
  const icoSizes = assertIco(ico, ICO_SIZES, 'icon.ico')
  const icoChanged = writeIfChanged(icoPath, ico)

  const trayIdleMaster = await trayMaster(TRAY_IDLE_CROP)
  const trayActiveMaster = await trayMaster(TRAY_ACTIVE_CROP)
  const trayPng = await sharp(trayIdleMaster)
    .resize(256, 256, { kernel: 'lanczos3' })
    .png()
    .toBuffer()
  const trayActivePng = await sharp(trayActiveMaster)
    .resize(256, 256, { kernel: 'lanczos3' })
    .png()
    .toBuffer()

  const tray = await icoFrom(trayIdleMaster, TRAY_SIZES)
  const trayActive = await icoFrom(trayActiveMaster, TRAY_SIZES)
  const traySizes = assertIco(tray, TRAY_SIZES, 'tray.ico')
  const trayActiveSizes = assertIco(trayActive, TRAY_SIZES, 'tray-active.ico')

  const trayPngChanged = writeIfChanged(trayPngPath, trayPng)
  const trayActivePngChanged = writeIfChanged(trayActivePngPath, trayActivePng)
  const trayChanged = writeIfChanged(trayPath, tray)
  const trayActiveChanged = writeIfChanged(trayActivePath, trayActive)

  const tag = (changed) => (changed ? '已更新' : '未变化')
  console.log(`icon.png        512×512              ${tag(pngChanged)}`)
  console.log(`icon.ico        ${icoSizes.join('/')}  ${tag(icoChanged)}`)
  console.log(`tray.png        256×256              ${tag(trayPngChanged)}`)
  console.log(`tray.ico        ${traySizes.join('/')}  ${tag(trayChanged)}`)
  console.log(`tray-active.png 256×256              ${tag(trayActivePngChanged)}`)
  console.log(`tray-active.ico ${trayActiveSizes.join('/')}  ${tag(trayActiveChanged)}`)
}

main().catch((err) => {
  console.error('图标生成失败：', err instanceof Error ? err.message : err)
  process.exit(1)
})

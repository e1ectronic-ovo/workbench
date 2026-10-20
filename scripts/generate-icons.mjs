/**
 * 生成桌面应用图标：矢量底板（resources/icon-frame.svg）+ 鲸鱼娘头像图层，合成 1024 主图，
 * 再导出 resources/icon.png（512）与多尺寸 resources/icon.ico（16~256）。
 *
 * 头像源图为 256px（src/renderer/src/assets/whale/logo.png），采用 lanczos3 放大 + 轻量锐化，
 * 在 32px 以上仍保持清晰；ico 各尺寸均由 1024 主图单独降采样，避免逐级缩放的模糊累积。
 *
 * 该脚本已接入构建流程（npm run build 会先跑一遍），因此打包产物里的图标永远与源图一致。
 * 产物是确定性的、且只在内容变化时写盘，所以重复执行不会污染 git 或触发多余的重打包。
 *
 * Run: npm run icons
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const framePath = join(root, 'resources', 'icon-frame.svg')
const mascotPath = join(root, 'src', 'renderer', 'src', 'assets', 'whale', 'logo.png')
const pngPath = join(root, 'resources', 'icon.png')
const icoPath = join(root, 'resources', 'icon.ico')

/** 主图画布尺寸，所有比例都以此为单位计算 */
const MASTER = 1024
/** 头像占画布宽度的比例 */
const MASCOT_RATIO = 0.8
/** 头像垂直位置（大于 0.5 时整体下沉，视觉重心更稳） */
const MASCOT_SHIFT = 0.535
/** ico 内嵌尺寸。256 是 electron-builder 的硬性要求，缺了会直接拒绝打包 */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]

/** 内容没变就不写盘：保持 mtime，避免 git 抖动与 electron-builder 无谓重打包 */
function writeIfChanged(path, buf) {
  try {
    if (readFileSync(path).equals(buf)) return false
  } catch {
    // 文件不存在，照常写
  }
  writeFileSync(path, buf)
  return true
}

/**
 * 校验 ico 目录表：文件数、各尺寸是否齐全。
 * electron-builder 只认「包含 256×256 条目」的 ico，这里提前拦住，别等到打包阶段才报错。
 */
function assertIco(buf) {
  if (buf.length < 6) throw new Error('ico 头部不完整')
  const count = buf.readUInt16LE(4)
  const entries = []
  for (let i = 0; i < count; i += 1) {
    const off = 6 + i * 16
    if (off + 16 > buf.length) throw new Error('ico 目录表被截断')
    // 宽高各占 1 字节，0 表示 256
    entries.push({ width: buf[off] || 256, height: buf[off + 1] || 256 })
  }
  const missing = ICO_SIZES.filter((s) => !entries.some((e) => e.width === s && e.height === s))
  if (missing.length) throw new Error(`ico 缺少尺寸：${missing.join(', ')}`)
  if (!entries.some((e) => e.width === 256)) throw new Error('ico 缺少 256×256，electron-builder 会拒绝打包')
  return entries.map((e) => e.width)
}

const frame = readFileSync(framePath)
if (!frame.length) throw new Error('resources/icon-frame.svg 为空')

const box = Math.round(MASTER * MASCOT_RATIO)
const left = Math.round((MASTER - box) / 2)
const top = Math.round(MASTER * 0.5 - box * MASCOT_SHIFT)

/** 放大头像：lanczos3 + 轻度锐化，补回插值损失的边缘 */
async function loadMascot() {
  return sharp(mascotPath)
    .resize(box, box, { kernel: 'lanczos3' })
    .sharpen({ sigma: 0.85, m1: 0.5, m2: 2 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
}

/** 用头像的 alpha 生成投影：只保留角色轮廓，染成深色后模糊 */
async function buildShadow({ data, info }) {
  const px = Buffer.from(data)
  for (let i = 0; i < px.length; i += 4) {
    px[i] = 3
    px[i + 1] = 12
    px[i + 2] = 24
    px[i + 3] = Math.round(px[i + 3] * 0.6)
  }
  return sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } })
    .blur(MASTER * 0.02)
    .png()
    .toBuffer()
}

async function main() {
  const raw = await loadMascot()
  const shadow = await buildShadow(raw)
  const mascot = await sharp(raw.data, {
    raw: { width: raw.info.width, height: raw.info.height, channels: 4 }
  })
    .png()
    .toBuffer()

  const master = await sharp(frame)
    .composite([
      { input: shadow, left, top: top + Math.round(MASTER * 0.016) },
      { input: mascot, left, top }
    ])
    .png()
    .toBuffer()

  const png = await sharp(master).resize(512, 512, { kernel: 'lanczos3' }).png().toBuffer()
  const pngMeta = await sharp(png).metadata()
  if (pngMeta.width !== 512 || pngMeta.height !== 512) {
    throw new Error(`icon.png 尺寸异常：${pngMeta.width}×${pngMeta.height}`)
  }
  const pngChanged = writeIfChanged(pngPath, png)

  const pngBuffers = await Promise.all(
    ICO_SIZES.map((s) => sharp(master).resize(s, s, { kernel: 'lanczos3' }).png().toBuffer())
  )
  const ico = await pngToIco(pngBuffers)
  const icoSizes = assertIco(ico)
  const icoChanged = writeIfChanged(icoPath, ico)

  const tag = (changed) => (changed ? '已更新' : '未变化')
  console.log(`icon.png  512×512            ${tag(pngChanged)}`)
  console.log(`icon.ico  ${icoSizes.join('/')}  ${tag(icoChanged)}`)
}

main().catch((err) => {
  console.error('图标生成失败：', err instanceof Error ? err.message : err)
  process.exit(1)
})

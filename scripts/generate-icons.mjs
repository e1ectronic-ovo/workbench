/**
 * 生成应用图标：矢量底板（resources/icon-frame.svg）+ 鲸鱼娘头像图层，合成一张 1024 主图，
 * 再导出 resources/icon.png（512）与多尺寸 resources/icon.ico。
 *
 * 头像源图为 256px（src/renderer/src/assets/whale/logo.png），采用 lanczos3 放大 + 轻量锐化，
 * 在 32px 以上仍保持清晰；ico 各尺寸均由 1024 主图单独降采样，避免逐级缩放的模糊累积。
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

const frame = readFileSync(framePath)

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

writeFileSync(pngPath, await sharp(master).resize(512, 512, { kernel: 'lanczos3' }).png().toBuffer())
console.log('Wrote', pngPath)

const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngBuffers = await Promise.all(
  sizes.map((s) => sharp(master).resize(s, s, { kernel: 'lanczos3' }).png().toBuffer())
)
writeFileSync(icoPath, await pngToIco(pngBuffers))
console.log('Wrote', icoPath)

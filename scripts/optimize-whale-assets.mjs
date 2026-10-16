import sharp from 'sharp'
import { existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const dir = join(root, 'src/renderer/src/assets/whale')
mkdirSync(dir, { recursive: true })

async function download(url, dest) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`download failed: ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(dest, buf)
  return dest
}

async function removeNearWhite(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const px = Buffer.from(data)
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i]
    const g = px[i + 1]
    const b = px[i + 2]
    const a = px[i + 3]
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (lum > 248 && Math.max(r, g, b) - Math.min(r, g, b) < 12) {
      px[i + 3] = 0
    } else if (lum > 235 && b >= g && g >= r - 8) {
      px[i + 3] = Math.min(a, Math.floor((248 - lum) * 18))
    }
  }
  await sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 92, effort: 4 })
    .toFile(outputPath)
}

async function cropHero(sheetPath, outputPath, region) {
  const meta = await sharp(sheetPath).metadata()
  const tmp = join(dir, `_tmp-${outputPath.split(/[\\/]/).pop().replace('.webp', '')}.png`)
  const left = Math.round(meta.width * region.left)
  const top = Math.round(meta.height * region.top)
  const width = Math.round(meta.width * region.width)
  const height = Math.round(meta.height * region.height)
  await sharp(sheetPath)
    .extract({ left, top, width, height })
    .resize({ height: 640, withoutEnlargement: true })
    .png()
    .toFile(tmp)
  await removeNearWhite(tmp, outputPath)
  unlinkSync(tmp)
}

const assetsBase = 'https://treapgogo.github.io/deepseek-whale-girl/assets'

const chibiSheet = join(dir, 'chibi-sheet.png')
if (!existsSync(chibiSheet)) {
  await download(`${assetsBase}/dafeiyu-chibi-character-sheet.png`, chibiSheet)
}

const matureSheet = join(dir, 'mature-sheet.png')
if (!existsSync(matureSheet)) {
  await download(`${assetsBase}/dafeiyu-mature-character-sheet.png`, matureSheet)
}

// 只取设定图左上「正面全身」一格，避免上下两格拼在一起
await cropHero(chibiSheet, join(dir, 'chibi-hero.webp'), {
  left: 0.03,
  top: 0.04,
  width: 0.3,
  height: 0.58
})

await cropHero(matureSheet, join(dir, 'mature-hero.webp'), {
  left: 0.03,
  top: 0.04,
  width: 0.3,
  height: 0.58
})

const logoPath = join(dir, 'logo.png')
if (!existsSync(logoPath)) {
  await download(`${assetsBase}/whale-girl-logo.png`, logoPath)
}
await sharp(logoPath).resize(128).webp({ quality: 90 }).toFile(join(dir, 'logo.webp'))

console.log('whale assets optimized')

/**
 * Generate resources/icon.png and resources/icon.ico from resources/icon.svg
 * Run: node scripts/generate-icons.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = join(root, 'resources', 'icon.svg')
const pngPath = join(root, 'resources', 'icon.png')
const icoPath = join(root, 'resources', 'icon.ico')

const svg = readFileSync(svgPath)

const png512 = await sharp(svg).resize(512, 512).png().toBuffer()
writeFileSync(pngPath, png512)
console.log('Wrote', pngPath)

const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngBuffers = await Promise.all(
  sizes.map((s) => sharp(svg).resize(s, s).png().toBuffer())
)
const ico = await pngToIco(pngBuffers)
writeFileSync(icoPath, ico)
console.log('Wrote', icoPath)

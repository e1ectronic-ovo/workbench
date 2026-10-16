import { mkdirSync, createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const dir = join(root, 'src/renderer/src/assets/maid-atelier')
const repo = 'Small-tailqwq/dsh-deep-whale@main'

const files = [
  ['palace-day.webp', 'maid-atelier/assets/maid-atelier-palace-day-v4.webp'],
  ['palace-night.webp', 'maid-atelier/assets/maid-atelier-palace-night-v4.webp'],
  ['maid-left.webp', 'maid-atelier/assets/maid-atelier-maid-left-v5.webp'],
  ['maid-right.webp', 'maid-atelier/assets/maid-atelier-maid-right-v7.webp'],
  ['workspace-ribbon.webp', 'maid-atelier/assets/maid-workspace-ribbon-v2.webp'],
  ['sidebar-corner.webp', 'maid-atelier/assets/maid-sidebar-corner-v1.webp'],
  ['bottom-crest.webp', 'maid-atelier/assets/maid-bottom-crest-v1.webp'],
  ['preview-day.webp', 'maid-atelier/preview/light.webp'],
  ['preview-night.webp', 'maid-atelier/preview/dark.webp']
]

mkdirSync(dir, { recursive: true })

function urlsFor(path) {
  return [
    `https://cdn.jsdelivr.net/gh/${repo}/${path}`,
    `https://raw.githubusercontent.com/Small-tailqwq/dsh-deep-whale/main/${path}`
  ]
}

function downloadWithCurl(localName, url, dest) {
  const result = spawnSync(
    'curl',
    ['-L', '--retry', '5', '--retry-delay', '2', '-s', '-o', dest, url],
    { stdio: 'inherit' }
  )
  if (result.status === 0) {
    console.log('ok', localName)
    return true
  }
  return false
}

async function download(localName, remotePath) {
  const dest = join(dir, localName)
  for (const url of urlsFor(remotePath)) {
    if (downloadWithCurl(localName, url, dest)) return
    console.warn('curl failed', localName, url)
  }

  let lastErr
  for (const url of urlsFor(remotePath)) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(180_000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await pipeline(res.body, createWriteStream(dest))
        console.log('ok', localName, `fetch ${attempt}`)
        return
      } catch (err) {
        lastErr = err
        console.warn('retry', localName, url, attempt, err.message)
        await new Promise((r) => setTimeout(r, attempt * 2000))
      }
    }
  }
  throw lastErr
}

for (const [local, remote] of files) {
  await download(local, remote)
}

console.log('maid-atelier assets ready')

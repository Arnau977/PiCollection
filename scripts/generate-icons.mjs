// Writes every app icon from resources/logo.svg: build/ (installer, taskbar)
// and resources/ (window, tray). Run after changing the logo: npm run icons
import { readFile, writeFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = await readFile(join(root, 'resources', 'logo.svg'))

/** A square PNG of the logo, rasterized at its own size (sharper than downscaling). */
function png(size) {
  return sharp(svg, { density: Math.max(72, (72 * size) / 100) })
    .resize(size, size)
    .png()
    .toBuffer()
}

/** Windows .ico holding PNG images (Vista and later read PNG entries). */
async function ico(sizes) {
  const images = await Promise.all(sizes.map(png))
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + 16 * images.length
  const entries = images.map((image, i) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], 0)
    entry.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], 1)
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(image.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += image.length
    return entry
  })
  return Buffer.concat([header, ...entries, ...images])
}

/** macOS .icns holding PNG images, by their icns type codes. */
async function icns(types) {
  const chunks = await Promise.all(
    Object.entries(types).map(async ([type, size]) => {
      const image = await png(size)
      const head = Buffer.alloc(8)
      head.write(type, 0, 'ascii')
      head.writeUInt32BE(image.length + 8, 4)
      return Buffer.concat([head, image])
    })
  )
  const body = Buffer.concat(chunks)
  const head = Buffer.alloc(8)
  head.write('icns', 0, 'ascii')
  head.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([head, body])
}

const icon512 = await png(512)
const iconIco = await ico([16, 24, 32, 48, 64, 128, 256])
const iconIcns = await icns({ ic07: 128, ic08: 256, ic09: 512, ic10: 1024 })

await Promise.all([
  writeFile(join(root, 'build', 'icon.png'), icon512),
  writeFile(join(root, 'build', 'icon.ico'), iconIco),
  writeFile(join(root, 'build', 'icon.icns'), iconIcns),
  // Shipped with the app: the window icon and the tray (see src/main/window/tray.ts).
  writeFile(join(root, 'resources', 'icon.png'), icon512),
  writeFile(join(root, 'resources', 'icon.ico'), iconIco)
])
console.log('Icons written to build/ and resources/')

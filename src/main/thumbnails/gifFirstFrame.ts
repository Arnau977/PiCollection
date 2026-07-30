/**
 * Decodes only the first frame of a GIF, without going through Chromium's
 * (or the OS shell's) full animation decoder. Both of those load every frame
 * of the animation into memory to support playback, which can reject large,
 * many-frame GIFs outright (observed: a 720x720, ~300-frame, 7.8MB GIF made
 * both `nativeImage.createThumbnailFromPath` and `nativeImage.createFromPath`
 * fail) even though a single still frame is trivial to produce. This parser
 * only reads up through the first Image Descriptor, so its cost is
 * independent of how many frames or how large the file is.
 *
 * Not a general-purpose GIF decoder: no transparency (frame is rendered
 * fully opaque), and only the first frame's region composited onto the
 * logical screen size.
 */

export interface DecodedGifFrame {
  width: number
  height: number
  /** BGRA byte order, matching Electron's `nativeImage.createFromBitmap`. */
  bgra: Buffer
}

function collectSubBlocks(buf: Buffer, offset: number): { data: Buffer; nextOffset: number } {
  const chunks: Buffer[] = []
  let o = offset
  while (o < buf.length) {
    const blockSize = buf[o]
    o += 1
    if (blockSize === 0) break
    chunks.push(buf.subarray(o, o + blockSize))
    o += blockSize
  }
  return { data: Buffer.concat(chunks), nextOffset: o }
}

function lzwDecode(data: Buffer, minCodeSize: number, expectedPixels: number): Uint8Array | null {
  const clearCode = 1 << minCodeSize
  const endCode = clearCode + 1
  const MAX_CODE_SIZE = 12
  const MAX_DICT_SIZE = 1 << MAX_CODE_SIZE

  let dict: number[][] = []
  let codeSize = minCodeSize + 1
  let nextCode = endCode + 1

  function resetDict(): void {
    dict = new Array(clearCode)
    for (let i = 0; i < clearCode; i++) dict[i] = [i]
    codeSize = minCodeSize + 1
    nextCode = endCode + 1
  }
  resetDict()

  const out = new Uint8Array(expectedPixels)
  let outPos = 0
  let prev: number[] | null = null

  let bitBuffer = 0
  let bitCount = 0
  let bytePos = 0

  function readCode(): number | null {
    while (bitCount < codeSize) {
      if (bytePos >= data.length) return null
      bitBuffer |= data[bytePos] << bitCount
      bytePos++
      bitCount += 8
    }
    const code = bitBuffer & ((1 << codeSize) - 1)
    bitBuffer >>= codeSize
    bitCount -= codeSize
    return code
  }

  for (;;) {
    if (outPos >= expectedPixels) break
    const code = readCode()
    if (code === null || code === endCode) break
    if (code === clearCode) {
      resetDict()
      prev = null
      continue
    }

    let entry: number[]
    if (dict[code]) {
      entry = dict[code]
    } else if (code === nextCode && prev) {
      entry = [...prev, prev[0]]
    } else {
      return null
    }

    for (let i = 0; i < entry.length && outPos < expectedPixels; i++) {
      out[outPos++] = entry[i]
    }

    if (prev && nextCode < MAX_DICT_SIZE) {
      dict[nextCode] = [...prev, entry[0]]
      nextCode++
      if (nextCode === 1 << codeSize && codeSize < MAX_CODE_SIZE) codeSize++
    }
    prev = entry
  }

  return outPos > 0 ? out : null
}

function deinterlace(indices: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(indices.length)
  const passes = [
    { start: 0, step: 8 },
    { start: 4, step: 8 },
    { start: 2, step: 4 },
    { start: 1, step: 2 }
  ]
  let srcRow = 0
  for (const pass of passes) {
    for (let destRow = pass.start; destRow < height; destRow += pass.step) {
      out.set(indices.subarray(srcRow * width, srcRow * width + width), destRow * width)
      srcRow++
    }
  }
  return out
}

export function decodeFirstGifFrame(buf: Buffer): DecodedGifFrame | null {
  if (buf.length < 13 || buf.toString('ascii', 0, 3) !== 'GIF') return null

  const screenWidth = buf.readUInt16LE(6)
  const screenHeight = buf.readUInt16LE(8)
  if (screenWidth === 0 || screenHeight === 0) return null

  const packed = buf[10]
  const gctFlag = (packed & 0x80) !== 0
  const gctSize = gctFlag ? 2 << (packed & 0x07) : 0

  let offset = 13
  let globalColorTable: Buffer | null = null
  if (gctFlag) {
    globalColorTable = buf.subarray(offset, offset + gctSize * 3)
    offset += gctSize * 3
  }

  while (offset < buf.length) {
    const marker = buf[offset]

    if (marker === 0x21) {
      // Extension block: introducer + label, then sub-blocks up to a 0 terminator.
      offset += 2
      offset = collectSubBlocks(buf, offset).nextOffset
      continue
    }

    if (marker === 0x2c) {
      offset += 1
      if (offset + 9 > buf.length) return null
      const imgLeft = buf.readUInt16LE(offset)
      const imgTop = buf.readUInt16LE(offset + 2)
      const imgWidth = buf.readUInt16LE(offset + 4)
      const imgHeight = buf.readUInt16LE(offset + 6)
      const imgPacked = buf[offset + 8]
      offset += 9

      const lctFlag = (imgPacked & 0x80) !== 0
      const interlaced = (imgPacked & 0x40) !== 0
      const lctSize = lctFlag ? 2 << (imgPacked & 0x07) : 0

      let colorTable = globalColorTable
      if (lctFlag) {
        colorTable = buf.subarray(offset, offset + lctSize * 3)
        offset += lctSize * 3
      }
      if (!colorTable || colorTable.length === 0) return null
      if (imgWidth === 0 || imgHeight === 0) return null

      const minCodeSize = buf[offset]
      offset += 1
      const { data } = collectSubBlocks(buf, offset)

      const pixelCount = imgWidth * imgHeight
      const indices = lzwDecode(data, minCodeSize, pixelCount)
      if (!indices) return null

      const ordered = interlaced ? deinterlace(indices, imgWidth, imgHeight) : indices

      const bgra = Buffer.alloc(screenWidth * screenHeight * 4)
      for (let y = 0; y < imgHeight; y++) {
        const destY = imgTop + y
        if (destY >= screenHeight) break
        for (let x = 0; x < imgWidth; x++) {
          const destX = imgLeft + x
          if (destX >= screenWidth) continue
          const colorIndex = ordered[y * imgWidth + x]
          const cOff = colorIndex * 3
          if (cOff + 2 >= colorTable.length) continue
          const destOff = (destY * screenWidth + destX) * 4
          bgra[destOff] = colorTable[cOff + 2]
          bgra[destOff + 1] = colorTable[cOff + 1]
          bgra[destOff + 2] = colorTable[cOff]
          bgra[destOff + 3] = 255
        }
      }

      return { width: screenWidth, height: screenHeight, bgra }
    }

    // 0x3b (trailer) or anything unrecognized: no image data found.
    break
  }

  return null
}

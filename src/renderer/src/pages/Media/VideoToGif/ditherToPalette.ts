/** Palette colors as gifenc's `quantize` returns them: `[r, g, b]` triplets. */
export type Palette = number[][]

/**
 * Maps RGBA pixels to palette indexes with Floyd–Steinberg error diffusion
 * (serpentine). gifenc's own `applyPalette` snaps each pixel to its nearest
 * color through an rgb565 lookup, which turns gradients into flat bands; this
 * keeps full 8-bit precision and spreads each pixel's rounding error onto its
 * neighbours, so the eye averages them back to the original shade.
 */
export function ditherToPalette(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  palette: Palette
): Uint8Array {
  const index = new Uint8Array(width * height)
  // Two rows of carried-over error (r, g, b per pixel): the current one and the next.
  let current = new Float32Array(width * 3)
  let next = new Float32Array(width * 3)
  const nearest = nearestColorFinder(palette)

  for (let y = 0; y < height; y++) {
    const leftToRight = y % 2 === 0
    const step = leftToRight ? 1 : -1
    for (let i = 0; i < width; i++) {
      const x = leftToRight ? i : width - 1 - i
      const p = (y * width + x) * 4
      const e = x * 3
      const r = clampByte(rgba[p] + current[e])
      const g = clampByte(rgba[p + 1] + current[e + 1])
      const b = clampByte(rgba[p + 2] + current[e + 2])
      const chosen = nearest(r, g, b)
      index[y * width + x] = chosen
      const color = palette[chosen]
      spread(r - color[0], g - color[1], b - color[2], x, step, width, current, next)
    }
    const done = current
    current = next
    next = done
    next.fill(0)
  }
  return index
}

/** Floyd–Steinberg weights: 7/16 ahead, then 3/16, 5/16, 1/16 on the row below. */
function spread(
  er: number,
  eg: number,
  eb: number,
  x: number,
  step: number,
  width: number,
  current: Float32Array,
  next: Float32Array
): void {
  const add = (row: Float32Array, column: number, weight: number): void => {
    if (column < 0 || column >= width) return
    const e = column * 3
    row[e] += er * weight
    row[e + 1] += eg * weight
    row[e + 2] += eb * weight
  }
  add(current, x + step, 7 / 16)
  add(next, x - step, 3 / 16)
  add(next, x, 5 / 16)
  add(next, x + step, 1 / 16)
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value)
}

// One 32 MB table reused across frames (each frame has its own palette, so it's reset per call).
let sharedCache: Int16Array | null = null

/**
 * Exact nearest palette color, memoized per 24-bit color: frames from a
 * video repeat the same colors a lot, so most pixels are a cache hit.
 */
function nearestColorFinder(palette: Palette): (r: number, g: number, b: number) => number {
  sharedCache ??= new Int16Array(1 << 24)
  const cache = sharedCache.fill(-1)
  return (r, g, b) => {
    const key = (r << 16) | (g << 8) | b
    const cached = cache[key]
    if (cached !== -1) return cached
    let best = 0
    let bestDistance = Infinity
    for (let i = 0; i < palette.length; i++) {
      const color = palette[i]
      const dr = r - color[0]
      const dg = g - color[1]
      const db = b - color[2]
      const distance = dr * dr + dg * dg + db * db
      if (distance < bestDistance) {
        bestDistance = distance
        best = i
      }
    }
    cache[key] = best
    return best
  }
}

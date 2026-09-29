export type Dimensions = { width: number; height: number }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Horizontal span an image covers once fitted (object-fit: contain) into the stage. */
function fittedSpan(image: Dimensions, stage: Dimensions): { left: number; right: number } {
  const scale = Math.min(stage.width / image.width, stage.height / image.height)
  const width = image.width * scale
  const left = (stage.width - width) / 2
  return { left, right: left + width }
}

/**
 * Where the compare divider may go, in % of the stage: between the leftmost
 * and rightmost edge either image reaches on screen - zoom and pan included -
 * so it never ends up over the empty letterbox.
 */
export function dividerBounds(
  images: (Dimensions | undefined)[],
  stage: Dimensions | null,
  zoom: { scale: number; offsetX: number }
): { min: number; max: number } {
  const loaded = images.filter((size): size is Dimensions => size !== undefined)
  if (!stage || stage.width === 0 || loaded.length === 0) return { min: 0, max: 100 }
  const spans = loaded.map((size) => fittedSpan(size, stage))
  const toPercent = (x: number): number =>
    clamp(((zoom.offsetX + x * zoom.scale) / stage.width) * 100, 0, 100)
  return {
    min: toPercent(Math.min(...spans.map((span) => span.left))),
    max: toPercent(Math.max(...spans.map((span) => span.right)))
  }
}

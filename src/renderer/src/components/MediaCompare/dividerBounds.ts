export type Dimensions = { width: number; height: number }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

/** The box an image covers once fitted (object-fit: contain) into the stage, unzoomed. */
function fittedRect(image: Dimensions, stage: Dimensions): Rect {
  const scale = Math.min(stage.width / image.width, stage.height / image.height)
  const width = image.width * scale
  const height = image.height * scale
  const left = (stage.width - width) / 2
  const top = (stage.height - height) / 2
  return { left, right: left + width, top, bottom: top + height }
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
  const spans = loaded.map((size) => fittedRect(size, stage))
  const toPercent = (x: number): number =>
    clamp(((zoom.offsetX + x * zoom.scale) / stage.width) * 100, 0, 100)
  return {
    min: toPercent(Math.min(...spans.map((span) => span.left))),
    max: toPercent(Math.max(...spans.map((span) => span.right)))
  }
}

/**
 * Whether a point (in stage px) falls on either image as shown - zoom and pan
 * included. Until both sizes are known it counts as on an image, so a click
 * never closes the view by mistake while they load.
 */
export function isOverImage(
  point: { x: number; y: number },
  images: (Dimensions | undefined)[],
  stage: Dimensions | null,
  zoom: { scale: number; offsetX: number; offsetY: number }
): boolean {
  if (!stage || images.some((size) => size === undefined)) return true
  const x = (point.x - zoom.offsetX) / zoom.scale
  const y = (point.y - zoom.offsetY) / zoom.scale
  return (images as Dimensions[]).some((size) => {
    const rect = fittedRect(size, stage)
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  })
}

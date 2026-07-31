export interface WindowBounds {
  x?: number
  y?: number
  width: number
  height: number
}

export interface SavedWindowState extends WindowBounds {
  isMaximized: boolean
}

export interface DisplayArea {
  x: number
  y: number
  width: number
  height: number
}

export const DEFAULT_WINDOW_STATE: SavedWindowState = {
  width: 1100,
  height: 760,
  isMaximized: false
}

export const MIN_WIDTH = 640
export const MIN_HEIGHT = 480

/**
 * A window counts as visible when a reasonable slice of its title bar area
 * overlaps a display, so it can always be grabbed and moved by the user.
 */
const MIN_VISIBLE_OVERLAP = 80

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function overlaps(bounds: Required<WindowBounds>, display: DisplayArea): boolean {
  const horizontal =
    Math.min(bounds.x + bounds.width, display.x + display.width) - Math.max(bounds.x, display.x)
  const vertical =
    Math.min(bounds.y + bounds.height, display.y + display.height) - Math.max(bounds.y, display.y)
  return horizontal >= MIN_VISIBLE_OVERLAP && vertical >= MIN_VISIBLE_OVERLAP
}

export function isVisibleOnSomeDisplay(
  bounds: Required<WindowBounds>,
  displays: DisplayArea[]
): boolean {
  return displays.some((display) => overlaps(bounds, display))
}

/**
 * Turns whatever was on disk into a usable window state. Garbage, absurd sizes
 * and positions on monitors that are no longer connected all fall back to
 * sensible defaults rather than leaving the window off-screen.
 */
export function sanitizeWindowState(saved: unknown, displays: DisplayArea[]): SavedWindowState {
  if (typeof saved !== 'object' || saved === null) return { ...DEFAULT_WINDOW_STATE }

  const candidate = saved as Partial<SavedWindowState>
  const width = isFiniteNumber(candidate.width)
    ? Math.max(MIN_WIDTH, Math.round(candidate.width))
    : DEFAULT_WINDOW_STATE.width
  const height = isFiniteNumber(candidate.height)
    ? Math.max(MIN_HEIGHT, Math.round(candidate.height))
    : DEFAULT_WINDOW_STATE.height
  const isMaximized = candidate.isMaximized === true

  const hasPosition = isFiniteNumber(candidate.x) && isFiniteNumber(candidate.y)
  if (!hasPosition) return { width, height, isMaximized }

  const positioned = {
    x: Math.round(candidate.x as number),
    y: Math.round(candidate.y as number),
    width,
    height
  }

  // Dropping x/y lets Electron center the window on the primary display.
  if (displays.length > 0 && !isVisibleOnSomeDisplay(positioned, displays)) {
    return { width, height, isMaximized }
  }

  return { ...positioned, isMaximized }
}

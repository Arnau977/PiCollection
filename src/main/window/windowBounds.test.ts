import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WINDOW_STATE,
  isVisibleOnSomeDisplay,
  sanitizeWindowState,
  type DisplayArea
} from './windowBounds'

const primary: DisplayArea = { x: 0, y: 0, width: 1920, height: 1040 }
const secondary: DisplayArea = { x: 1920, y: 0, width: 1280, height: 1024 }

describe('sanitizeWindowState', () => {
  it('falls back to defaults when nothing is stored', () => {
    expect(sanitizeWindowState(null, [primary])).toEqual(DEFAULT_WINDOW_STATE)
  })

  it('falls back to defaults when the stored value is not an object', () => {
    expect(sanitizeWindowState('garbage', [primary])).toEqual(DEFAULT_WINDOW_STATE)
  })

  it('restores a position that is still on a connected display', () => {
    const saved = { x: 100, y: 80, width: 1200, height: 800, isMaximized: false }

    expect(sanitizeWindowState(saved, [primary])).toEqual(saved)
  })

  it('restores a position on a secondary display', () => {
    const saved = { x: 2000, y: 100, width: 1000, height: 700, isMaximized: false }

    expect(sanitizeWindowState(saved, [primary, secondary])).toEqual(saved)
  })

  it('drops the position when the display it was on is gone, keeping the size', () => {
    const saved = { x: 2000, y: 100, width: 1000, height: 700, isMaximized: false }

    const result = sanitizeWindowState(saved, [primary])

    expect(result).toEqual({ width: 1000, height: 700, isMaximized: false })
    expect(result.x).toBeUndefined()
    expect(result.y).toBeUndefined()
  })

  it('drops a position that is almost entirely off-screen', () => {
    const saved = { x: 1900, y: 1020, width: 1000, height: 700, isMaximized: false }

    const result = sanitizeWindowState(saved, [primary])

    expect(result.x).toBeUndefined()
    expect(result.y).toBeUndefined()
  })

  it('clamps absurdly small sizes up to a usable minimum', () => {
    const result = sanitizeWindowState({ width: 10, height: 5 }, [primary])

    expect(result.width).toBeGreaterThanOrEqual(640)
    expect(result.height).toBeGreaterThanOrEqual(480)
  })

  it('ignores non-numeric sizes', () => {
    const result = sanitizeWindowState({ width: 'wide', height: null }, [primary])

    expect(result.width).toBe(DEFAULT_WINDOW_STATE.width)
    expect(result.height).toBe(DEFAULT_WINDOW_STATE.height)
  })

  it('preserves the maximized flag', () => {
    const result = sanitizeWindowState({ width: 900, height: 700, isMaximized: true }, [primary])

    expect(result.isMaximized).toBe(true)
  })

  it('treats a missing maximized flag as not maximized', () => {
    expect(sanitizeWindowState({ width: 900, height: 700 }, [primary]).isMaximized).toBe(false)
  })

  it('keeps the position when no displays are reported (cannot validate)', () => {
    const saved = { x: 100, y: 80, width: 1200, height: 800, isMaximized: false }

    expect(sanitizeWindowState(saved, [])).toEqual(saved)
  })
})

describe('isVisibleOnSomeDisplay', () => {
  it('accepts a window fully inside a display', () => {
    expect(isVisibleOnSomeDisplay({ x: 10, y: 10, width: 800, height: 600 }, [primary])).toBe(true)
  })

  it('accepts a window that only partially overlaps a display', () => {
    expect(isVisibleOnSomeDisplay({ x: -400, y: 10, width: 800, height: 600 }, [primary])).toBe(
      true
    )
  })

  it('rejects a window fully outside every display', () => {
    expect(isVisibleOnSomeDisplay({ x: 5000, y: 5000, width: 800, height: 600 }, [primary])).toBe(
      false
    )
  })
})

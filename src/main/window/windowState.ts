import { app, screen, type BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_WINDOW_STATE, sanitizeWindowState, type SavedWindowState } from './windowBounds'

const STATE_FILE = 'window-state.json'
const SAVE_DEBOUNCE_MS = 400

function stateFilePath(): string {
  return join(app.getPath('userData'), STATE_FILE)
}

function readSavedState(): unknown {
  try {
    return JSON.parse(readFileSync(stateFilePath(), 'utf-8'))
  } catch {
    // Missing or corrupted state is expected on first run - fall back to defaults.
    return null
  }
}

function writeState(state: SavedWindowState): void {
  try {
    writeFileSync(stateFilePath(), JSON.stringify(state), 'utf-8')
  } catch (err) {
    console.warn('Could not persist window state', err)
  }
}

export interface WindowStateKeeper {
  state: SavedWindowState
  /** Starts persisting this window's bounds, and restores the maximized state. */
  register: (window: BrowserWindow) => void
}

export function createWindowStateKeeper(): WindowStateKeeper {
  const displays = screen.getAllDisplays().map((display) => display.workArea)
  const state = sanitizeWindowState(readSavedState(), displays)

  let saveTimer: NodeJS.Timeout | undefined

  function captureAndSave(window: BrowserWindow): void {
    if (window.isDestroyed()) return
    // getNormalBounds() keeps the pre-maximize size, so un-maximizing after a
    // restart returns the window to the size the user actually chose.
    const bounds = window.getNormalBounds()
    writeState({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: window.isMaximized()
    })
  }

  function scheduleSave(window: BrowserWindow): void {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => captureAndSave(window), SAVE_DEBOUNCE_MS)
  }

  function register(window: BrowserWindow): void {
    if (state.isMaximized) window.maximize()

    // Registered individually because BrowserWindow.on is overloaded per event name.
    window.on('resize', () => scheduleSave(window))
    window.on('move', () => scheduleSave(window))
    window.on('maximize', () => scheduleSave(window))
    window.on('unmaximize', () => scheduleSave(window))

    window.on('close', () => {
      if (saveTimer) clearTimeout(saveTimer)
      captureAndSave(window)
    })
  }

  return { state, register }
}

export { DEFAULT_WINDOW_STATE }

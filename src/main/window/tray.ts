import { app, Menu, nativeImage, Tray, type BrowserWindow, type NativeImage } from 'electron'
import iconPng from '../../../resources/icon.png?asset'
// Copy of build/icon.ico (the installer/taskbar icon) - keep both in sync
// when the app icon changes. build/ itself isn't shipped with the app.
import iconIco from '../../../resources/icon.ico?asset'

let tray: Tray | null = null
let trayWindow: BrowserWindow | null = null

/** Must be called once, right after the main window is created - mirrors setUpdaterWindow/setEntityEventsWindow. */
export function setTrayWindow(window: BrowserWindow): void {
  trayWindow = window
}

/**
 * Handing Tray the 512px PNG leaves the downscale to the OS, which on Windows
 * renders it jagged at 16px. The .ico carries hand-sized 16/32/48px frames
 * and Windows picks the one matching the display scale; elsewhere, resize
 * the PNG ourselves with proper filtering.
 */
function trayIcon(): string | NativeImage {
  if (process.platform === 'win32') return iconIco
  const size = process.platform === 'darwin' ? 16 : 24
  return nativeImage.createFromPath(iconPng).resize({ width: size, height: size, quality: 'best' })
}

function buildTray(): Tray {
  const created = new Tray(trayIcon())
  created.setToolTip('PiCollection')
  created.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open PiCollection',
        click: (): void => {
          trayWindow?.show()
          trayWindow?.focus()
        }
      },
      { type: 'separator' },
      { label: 'Quit', click: (): void => app.quit() }
    ])
  )
  created.on('click', () => {
    trayWindow?.show()
    trayWindow?.focus()
  })
  return created
}

/**
 * Creates or destroys the tray icon to match the background-mode setting.
 * Called when the main window's close is intercepted (see index.ts) and
 * whenever the user toggles the setting in Settings while already running
 * in the background. Once created, the tray is intentionally left in place
 * for the rest of the session even after the window is reopened - not worth
 * the extra churn of destroying/recreating it on every show/hide.
 */
export function syncAppTray(backgroundModeEnabled: boolean): void {
  if (backgroundModeEnabled && !tray) {
    tray = buildTray()
  } else if (!backgroundModeEnabled && tray) {
    tray.destroy()
    tray = null
  }
}

export function isAppTrayActive(): boolean {
  return tray !== null
}

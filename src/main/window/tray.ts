import { app, Menu, Tray, type BrowserWindow } from 'electron'
import icon from '../../../resources/icon.png?asset'

let tray: Tray | null = null
let trayWindow: BrowserWindow | null = null

/** Must be called once, right after the main window is created - mirrors setUpdaterWindow/setEntityEventsWindow. */
export function setTrayWindow(window: BrowserWindow): void {
  trayWindow = window
}

function buildTray(): Tray {
  const created = new Tray(icon)
  created.setToolTip('PiCollection')
  created.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open PiCollection',
        click: () => {
          trayWindow?.show()
          trayWindow?.focus()
        }
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
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

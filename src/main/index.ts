import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { initDb } from './database/connection'
import { resolveElectronDbPath } from './database/electronDbPath'
import { runMigrations } from './database/migrations/migrator'
import { backfillMediaHashes } from './services/mediaHashBackfill'
import { registerMediaProtocolHandler, registerMediaProtocolScheme } from './media-protocol'
import { registerIpcHandlers } from './ipc/registerIpcHandlers'
import { createWindowStateKeeper } from './window/windowState'
import { MIN_WIDTH, MIN_HEIGHT } from './window/windowBounds'
import { checkForUpdates, initAutoUpdater } from './updater/autoUpdater'

registerMediaProtocolScheme()

/** Give the window a moment to finish loading before an update check starts competing for bandwidth. */
const STARTUP_UPDATE_CHECK_DELAY_MS = 5000

function createWindow(): BrowserWindow {
  const windowState = createWindowStateKeeper()

  const mainWindow = new BrowserWindow({
    x: windowState.state.x,
    y: windowState.state.y,
    width: windowState.state.width,
    height: windowState.state.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  windowState.register(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // External links (social links, "View source" on a suggested match, etc.)
  // open in the user's default OS browser instead of a new Electron window -
  // there's no in-app use for a second window today.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    // Create the browser window.
    // let name = require('../../package.json').name
    const version = require('../../package.json').version
    const windowtitle = 'PiCollection' + ' - ' + version
    mainWindow.setTitle(windowtitle)
  })

  return mainWindow
}

const setupDatabase = async (): Promise<void> => {
  const db = initDb(resolveElectronDbPath(), { verboseLogging: !app.isPackaged })
  await runMigrations(db)
  console.info('Database ready')
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    await setupDatabase()
  } catch (err) {
    console.error('Failed to initialize database', err)
    dialog.showErrorBox(
      'Database error',
      'PiCollection could not initialize its local database and cannot continue.\n\n' +
        (err instanceof Error ? err.message : String(err))
    )
    app.quit()
    return
  }

  registerMediaProtocolHandler()
  registerIpcHandlers()
  const mainWindow = createWindow()

  // Fire-and-forget: fills in hash/phash for media added before duplicate
  // detection existed, without delaying the window from showing.
  backfillMediaHashes().catch((err) => console.error('Media hash backfill failed', err))

  initAutoUpdater(mainWindow)
  // A quiet startup check - the renderer surfaces the result and lets the
  // user decide whether to download, it never installs anything on its own.
  setTimeout(() => {
    checkForUpdates().catch((err) => console.info('Startup update check skipped:', err.message))
  }, STARTUP_UPDATE_CHECK_DELAY_MS)

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.

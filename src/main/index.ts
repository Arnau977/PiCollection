import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { initDb } from './database/connection'
import { resolveElectronDbPath, resolveBackupsDir } from './database/electronDbPath'
import { runMigrations } from './database/migrations/migrator'
import {
  hasPendingMigrations,
  pruneSnapshots,
  snapshotDatabase
} from './database/migrations/preMigrationBackup'
import { backfillMediaHashes } from './services/mediaHashBackfill'
import { registerMediaProtocolHandler, registerMediaProtocolScheme } from './media-protocol'
import { registerIpcHandlers } from './ipc/registerIpcHandlers'
import { createWindowStateKeeper } from './window/windowState'
import { MIN_WIDTH, MIN_HEIGHT } from './window/windowBounds'
import { checkForUpdates, initAutoUpdater } from './updater/autoUpdater'
import { logError, logInfo } from './logging/logger'

registerMediaProtocolScheme()

// Node's default behavior for an uncaught exception is to print and terminate
// the process. Registering a handler at all suppresses that default, so this
// handler restores it after logging - it exists to capture the crash on the
// way out, not to keep the app limping along in a possibly-corrupted state
// (e.g. a half-open DB handle or half-initialized window).
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception', err)
  logError('process', 'Uncaught exception', err)
  dialog.showErrorBox(
    'Unexpected error',
    'PiCollection hit an unrecoverable error and needs to close.\n\n' +
      (err instanceof Error ? err.message : String(err))
  )
  app.exit(1)
})

// Unlike an uncaught exception, Node does not treat an unhandled rejection as
// fatal by default, and nothing in this app currently relies on that being
// fatal for correctness - so this stays log-only, matching pre-existing
// behavior. It must not silently suppress anything beyond logging.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection', reason)
  logError('process', 'Unhandled rejection', reason)
})

/**
 * Thrown by `setupDatabase()` when the pre-migration safety snapshot itself
 * fails (disk full, permissions, antivirus lock) - as opposed to a failure
 * in the migrations that snapshot exists to protect against. Kept as a
 * distinct type (not just a distinct message) so the top-level error dialog
 * can tell the two apart and avoid pointing the user at a backup folder that,
 * in this case, was never populated.
 */
class SnapshotFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SnapshotFailedError'
  }
}

/** Give the window a moment to finish loading before an update check starts competing for bandwidth. */
const STARTUP_UPDATE_CHECK_DELAY_MS = 5000
/** Also re-check periodically for sessions left running across days, not just at launch. */
const DAILY_UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

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
  const dbPath = resolveElectronDbPath()
  const db = initDb(dbPath, { verboseLogging: !app.isPackaged })

  try {
    if (await hasPendingMigrations(db)) {
      const backupsDir = resolveBackupsDir()
      await snapshotDatabase(dbPath, backupsDir)
      await pruneSnapshots(backupsDir)
      logInfo('lifecycle', 'Pre-migration snapshot created', { backupsDir })
    }
  } catch (err) {
    logError('lifecycle', 'Pre-migration snapshot failed', err)
    // Don't fall through to running migrations without a backup in place -
    // that would defeat the whole point of snapshotting first. Thrown as a
    // distinct error type so the top-level dialog below can tell this
    // apart from a genuine migration failure and avoid claiming a snapshot
    // exists when it never got created. Wrapping hasPendingMigrations too
    // (not just the snapshot/prune calls) means any failure in deciding
    // whether to snapshot also gets this accurate error, not the generic
    // "database could not initialize" one.
    throw new SnapshotFailedError(
      'Could not create a safety backup before updating the database, so the update was ' +
        'stopped before making any changes. Your data is untouched.'
    )
  }

  await runMigrations(db)
  console.info('Database ready')
  logInfo('lifecycle', 'Database ready')
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  logInfo('lifecycle', 'App ready')

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
    logError('lifecycle', 'Failed to initialize database', err)
    const detail = err instanceof Error ? err.message : String(err)
    // A snapshot failure gets its own wording: the boilerplate below claims a
    // pre-update snapshot may be sitting in the backups folder, which is
    // false in exactly this case - the snapshot is the thing that failed.
    const message =
      err instanceof SnapshotFailedError
        ? `PiCollection could not initialize its local database and cannot continue.\n\n${detail}`
        : 'PiCollection could not initialize its local database and cannot continue.\n\n' +
          'If this happened right after an update, a snapshot of your database from just ' +
          'before the update may be available in:\n' +
          resolveBackupsDir() +
          '\n\n' +
          detail
    dialog.showErrorBox('Database error', message)
    app.quit()
    return
  }

  registerMediaProtocolHandler()
  registerIpcHandlers()
  const mainWindow = createWindow()
  logInfo('lifecycle', 'Main window created')

  // Fire-and-forget: fills in hash/phash for media added before duplicate
  // detection existed, without delaying the window from showing.
  backfillMediaHashes().catch((err) => {
    console.error('Media hash backfill failed', err)
    logError('lifecycle', 'Media hash backfill failed', err)
  })

  initAutoUpdater(mainWindow)
  // A quiet startup check - the renderer surfaces the result and lets the
  // user decide whether to download, it never installs anything on its own.
  setTimeout(() => {
    checkForUpdates().catch((err) => console.info('Startup update check skipped:', err.message))
  }, STARTUP_UPDATE_CHECK_DELAY_MS)

  // Catches updates published while the app stays open across multiple days -
  // the startup check alone only covers the moment of launch.
  setInterval(() => {
    checkForUpdates().catch((err) => console.info('Daily update check skipped:', err.message))
  }, DAILY_UPDATE_CHECK_INTERVAL_MS)

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

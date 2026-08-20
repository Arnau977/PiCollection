import { app, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC } from '@shared/ipc/contracts'
import type { UpdateChannel, UpdaterEvent } from '@shared/models'
import {
  compareVersions,
  describeUpdaterError,
  extractHighlights,
  normalizeReleaseNotes
} from '@shared/utils'
import { readUpdateChannel, writeUpdateChannel } from './updaterSettings'
import { logError, logInfo } from '../logging/logger'

let updaterWindow: BrowserWindow | null = null
let initialized = false
// The last event broadcast, so a renderer component that mounts after it
// fired (e.g. the Settings page, opened well after the startup check) can
// learn the current state via getStatus() instead of only ever finding out
// from a check that happens to run while it's mounted.
let lastEvent: UpdaterEvent | null = null

function send(event: UpdaterEvent): void {
  lastEvent = event
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    updaterWindow.webContents.send(IPC.updater.event, event)
  }
}

export function getStatus(): UpdaterEvent | null {
  return lastEvent
}

/** Re-points which window receives updater events - call whenever a new main window is created (e.g. macOS activate-triggered recreation), not just at startup. */
export function setUpdaterWindow(window: BrowserWindow): void {
  updaterWindow = window
}

function applyChannel(channel: UpdateChannel): void {
  // Every build publishes the same `latest*.yml` manifest - there is no
  // separate beta manifest, and version numbers are always plain `X.Y.Z`
  // with no prerelease suffix. What a channel can see is decided entirely by
  // GitHub's own `prerelease` flag per release: `allowPrerelease` is the
  // switch that lets the beta channel resolve releases still flagged as
  // pre-release, while stable only ever resolves `/releases/latest`. The
  // `channel` assignment is kept in sync with it for consistency, but with a
  // single shared manifest it has no effect on its own. See docs/auto-update.md.
  autoUpdater.channel = channel === 'beta' ? 'beta' : 'latest'
  autoUpdater.allowPrerelease = channel === 'beta'
}

/** Wires electron-updater's events to the renderer and applies the saved channel. Call once, after the main window is created. */
export function initAutoUpdater(window: BrowserWindow): void {
  setUpdaterWindow(window)
  if (initialized) return
  initialized = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  // Switching from a beta build ahead of the latest stable release back to
  // the stable channel is a legitimate choice (see setChannel) - without
  // this, electron-updater silently refuses to ever offer a version older
  // than the one currently installed.
  autoUpdater.allowDowngrade = true
  applyChannel(readUpdateChannel())

  autoUpdater.on('checking-for-update', () => send({ type: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    send({
      type: 'available',
      version: info.version,
      highlights: extractHighlights(normalizeReleaseNotes(info.releaseNotes)),
      isDowngrade: compareVersions(info.version, app.getVersion()) < 0
    })
  )
  autoUpdater.on('update-not-available', () => send({ type: 'not-available' }))
  autoUpdater.on('download-progress', (progress) =>
    send({ type: 'download-progress', percent: Math.round(progress.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => send({ type: 'downloaded', version: info.version }))
  autoUpdater.on('error', (err) => {
    // electron-updater's own error messages are internal diagnostics (full
    // HTTP headers, stack traces, local file paths) - never meant for an
    // end user. Full detail goes to the debug log; the renderer only ever
    // sees a short, human message (see describeUpdaterError).
    logError('updater', 'Update check/download failed', err)
    send({ type: 'error', message: describeUpdaterError(err.message) })
  })
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    throw new Error('Update checks are only available in packaged builds.')
  }
  await autoUpdater.checkForUpdates()
}

export async function downloadUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate()
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}

export function getChannel(): UpdateChannel {
  return readUpdateChannel()
}

export async function setChannel(channel: UpdateChannel): Promise<void> {
  writeUpdateChannel(channel)
  logInfo('settings', 'Update channel changed', { channel })
  applyChannel(channel)
  // Immediately reflects the newly chosen channel's latest version instead
  // of leaving the last channel's stale status shown until the next
  // scheduled/manual check. The channel change itself has already
  // succeeded at this point, so a failed check (network, etc.) must not
  // make this call look like it failed too - the 'error' event still
  // reaches the renderer through the normal status stream.
  if (app.isPackaged) {
    try {
      await autoUpdater.checkForUpdates()
    } catch {
      // Already reported via the 'error' event listener above.
    }
  }
}

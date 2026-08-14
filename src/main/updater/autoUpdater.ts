import { app, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC } from '@shared/ipc/contracts'
import type { UpdateChannel, UpdaterEvent } from '@shared/models'
import { extractHighlights, normalizeReleaseNotes } from '@shared/utils'
import { readUpdateChannel, writeUpdateChannel } from './updaterSettings'
import { logInfo } from '../logging/logger'

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
  applyChannel(readUpdateChannel())

  autoUpdater.on('checking-for-update', () => send({ type: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    send({
      type: 'available',
      version: info.version,
      highlights: extractHighlights(normalizeReleaseNotes(info.releaseNotes))
    })
  )
  autoUpdater.on('update-not-available', () => send({ type: 'not-available' }))
  autoUpdater.on('download-progress', (progress) =>
    send({ type: 'download-progress', percent: Math.round(progress.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => send({ type: 'downloaded', version: info.version }))
  autoUpdater.on('error', (err) => send({ type: 'error', message: err.message }))
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

export function setChannel(channel: UpdateChannel): void {
  writeUpdateChannel(channel)
  logInfo('settings', 'Update channel changed', { channel })
  applyChannel(channel)
}

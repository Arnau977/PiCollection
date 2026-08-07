import { app, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC } from '@shared/ipc/contracts'
import type { UpdateChannel, UpdaterEvent } from '@shared/models'
import { extractHighlights, normalizeReleaseNotes } from '@shared/utils'
import { readUpdateChannel, writeUpdateChannel } from './updaterSettings'
import { logInfo } from '../logging/logger'

let updaterWindow: BrowserWindow | null = null
let initialized = false

function send(event: UpdaterEvent): void {
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    updaterWindow.webContents.send(IPC.updater.event, event)
  }
}

/** Re-points which window receives updater events - call whenever a new main window is created (e.g. macOS activate-triggered recreation), not just at startup. */
export function setUpdaterWindow(window: BrowserWindow): void {
  updaterWindow = window
}

function applyChannel(channel: UpdateChannel): void {
  // electron-updater's GitHub provider reads a per-channel manifest
  // (latest.yml for stable, beta.yml for beta) built from the version's
  // semver prerelease tag (e.g. `1.2.0-beta.1`) - allowPrerelease has to
  // agree with that or a stable-channel client would ignore beta releases.
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

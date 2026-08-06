import { useCallback, useEffect, useState } from 'react'
import type { UpdateChannel, UpdaterEvent } from '@shared/models'

export type UpdaterStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; highlights: string | null }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

interface UseAppUpdaterResult {
  status: UpdaterStatus
  channel: UpdateChannel
  appVersion: string | null
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  quitAndInstall: () => Promise<void>
  setChannel: (channel: UpdateChannel) => Promise<void>
}

function statusFromEvent(event: UpdaterEvent): UpdaterStatus {
  switch (event.type) {
    case 'checking':
      return { state: 'checking' }
    case 'available':
      return { state: 'available', version: event.version, highlights: event.highlights }
    case 'not-available':
      return { state: 'not-available' }
    case 'download-progress':
      return { state: 'downloading', percent: event.percent }
    case 'downloaded':
      return { state: 'downloaded', version: event.version }
    case 'error':
      return { state: 'error', message: event.message }
  }
}

/** Drives the update-check/download/install flow surfaced in Settings; the main process owns all electron-updater state. */
export function useAppUpdater(): UseAppUpdaterResult {
  const [status, setStatus] = useState<UpdaterStatus>({ state: 'idle' })
  const [channel, setChannelState] = useState<UpdateChannel>('stable')
  const [appVersion, setAppVersion] = useState<string | null>(null)

  useEffect(() => {
    window.api.updater.getChannel().then((result) => {
      if (result.success) setChannelState(result.data)
    })
    window.api.system.getAppVersion().then((result) => {
      if (result.success) setAppVersion(result.data)
    })
  }, [])

  useEffect(() => window.api.updater.onEvent((event) => setStatus(statusFromEvent(event))), [])

  const checkForUpdates = useCallback(async () => {
    const result = await window.api.updater.checkForUpdates()
    if (!result.success) setStatus({ state: 'error', message: result.error.message })
  }, [])

  const downloadUpdate = useCallback(async () => {
    const result = await window.api.updater.downloadUpdate()
    if (!result.success) setStatus({ state: 'error', message: result.error.message })
  }, [])

  const quitAndInstall = useCallback(async () => {
    await window.api.updater.quitAndInstall()
  }, [])

  const setChannel = useCallback(async (next: UpdateChannel) => {
    const result = await window.api.updater.setChannel(next)
    if (result.success) setChannelState(next)
  }, [])

  return {
    status,
    channel,
    appVersion,
    checkForUpdates,
    downloadUpdate,
    quitAndInstall,
    setChannel
  }
}

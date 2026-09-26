import { useCallback, useEffect, useState } from 'react'
import type { AutoBackupConfig, AutoBackupStatus } from '@shared/models'
import type { IpcResult } from '@shared/ipc/contracts'

export interface UseAutoBackup {
  status: AutoBackupStatus | null
  /** A request from this page is in flight (a scheduled run shows as `status.running` instead). */
  pending: boolean
  error: string | null
  update: (patch: Partial<Omit<AutoBackupConfig, 'folder'>>) => Promise<void>
  pickFolder: () => Promise<void>
  openFolder: () => Promise<void>
  runNow: () => Promise<void>
}

/**
 * Automatic-backup status for Settings: loaded once, then kept current by
 * main's `autoBackup:changed` pushes (scheduled runs have no request to
 * answer) and by each action's own response.
 */
export function useAutoBackup(): UseAutoBackup {
  const [status, setStatus] = useState<AutoBackupStatus | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.autoBackup.getStatus().then((result) => {
      if (result.success) setStatus(result.data)
      else setError(result.error.message)
    })
    return window.api.autoBackup.onChanged(setStatus)
  }, [])

  const apply = useCallback(
    async (request: () => Promise<IpcResult<AutoBackupStatus | void>>): Promise<void> => {
      setPending(true)
      const result = await request()
      if (result.success) {
        if (result.data) setStatus(result.data)
        setError(null)
      } else {
        setError(result.error.message)
      }
      setPending(false)
    },
    []
  )

  return {
    status,
    pending,
    error,
    update: (patch) => apply(() => window.api.autoBackup.updateConfig(patch)),
    pickFolder: () => apply(() => window.api.autoBackup.pickFolder()),
    openFolder: () => apply(() => window.api.autoBackup.openFolder()),
    runNow: () => apply(() => window.api.autoBackup.runNow())
  }
}

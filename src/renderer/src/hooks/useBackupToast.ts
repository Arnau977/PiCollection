import { useCallback, useEffect, useRef, useState } from 'react'

export type BackupToast = 'success' | 'error' | null

/**
 * Which toast, if any, the end of an automatic or "Back up now" run should
 * show: main pushes `running: true` then the final status, so a run has
 * finished when `running` flips back off. A successful run that found
 * nothing new to write stays silent.
 */
export function useBackupToast(): { toast: BackupToast; dismiss: () => void } {
  const [toast, setToast] = useState<BackupToast>(null)
  const wasRunning = useRef(false)

  useEffect(
    () =>
      window.api.autoBackup.onChanged((status) => {
        if (wasRunning.current && !status.running) {
          if (status.lastError) setToast('error')
          else if (status.lastRunWroteBackup) setToast('success')
        }
        wasRunning.current = status.running
      }),
    []
  )

  const dismiss = useCallback(() => setToast(null), [])
  return { toast, dismiss }
}

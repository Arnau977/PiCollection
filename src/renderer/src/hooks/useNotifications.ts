import { useCallback, useEffect, useState } from 'react'
import type { AppNotification, AppNotificationKind } from '@shared/models'

/**
 * The tray's items: fetched on mount and whenever the window regains focus
 * (main recomputes the cheap checks on each ask), then kept current by
 * main's `notifications:changed` pushes.
 */
export function useNotifications(): {
  items: AppNotification[]
  snooze: (kind: AppNotificationKind) => Promise<void>
} {
  const [items, setItems] = useState<AppNotification[]>([])

  useEffect(() => {
    const load = (): void => {
      window.api.notifications.getAll().then((result) => {
        if (result.success) setItems(result.data)
      })
    }
    load()
    window.addEventListener('focus', load)
    const unsubscribe = window.api.notifications.onChanged(setItems)
    return (): void => {
      window.removeEventListener('focus', load)
      unsubscribe()
    }
  }, [])

  const snooze = useCallback(async (kind: AppNotificationKind) => {
    const result = await window.api.notifications.snooze(kind)
    if (result.success) setItems(result.data)
  }, [])

  return { items, snooze }
}

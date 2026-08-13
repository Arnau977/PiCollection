import type { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc/contracts'
import type { EntitiesChangedEvent, EntityKind } from '@shared/models'

let entityEventsWindow: BrowserWindow | null = null

/** Re-points which window receives entity-change events - call whenever a new main window is created, same as `setUpdaterWindow`. */
export function setEntityEventsWindow(window: BrowserWindow): void {
  entityEventsWindow = window
}

/**
 * Pushes a main -> renderer notification that one or more entity kinds'
 * data (specifically their `mediaCount`) may have changed, so the
 * renderer's `useEntityLists` caches can invalidate themselves instead of
 * relying on every mutation call site remembering to call `refetch()`.
 * Mirrors `autoUpdater.ts`'s `send`/`setUpdaterWindow` push pattern.
 */
export function notifyEntitiesChanged(kinds: EntityKind[]): void {
  if (!kinds.length) return
  if (entityEventsWindow && !entityEventsWindow.isDestroyed()) {
    const event: EntitiesChangedEvent = { kinds }
    entityEventsWindow.webContents.send(IPC.entities.changed, event)
  }
}

export function __resetEntityEventsWindowForTests(): void {
  entityEventsWindow = null
}

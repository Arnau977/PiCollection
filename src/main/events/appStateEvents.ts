/** What changed, so a listener can decide how much to recompute. */
export type AppStateChange =
  | 'updater'
  | 'backup'
  | 'media'
  | 'missing-files'
  | 'source-folder'
  /** New files under the source folder (the watcher) - rescan only that count. */
  | 'source-folder-files'

type Listener = (change: AppStateChange) => void
const listeners = new Set<Listener>()

/**
 * In-process bus (main only) for "something the notification tray depends
 * on changed". Lets the updater, backups and media service announce changes
 * without importing the notifications service (which imports them - a cycle).
 */
export function onAppStateChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifyAppStateChanged(change: AppStateChange): void {
  for (const listener of listeners) listener(change)
}

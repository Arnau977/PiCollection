import type { MediaModel } from './Media'

/** Why a file left the app: deleted (from the queue, pending or the library) or replaced by a similar one. */
export type DiscardReason = 'deleted' | 'replaced'

/** A file taken out of the app but still on disk (until moved to the Recycle Bin). */
export interface DiscardedMediaModel {
  id: string
  /** As stored for media: relative to the source folder when it's under it. */
  route: string
  name: string
  type: MediaModel['type']
  reason: DiscardReason
  discardedAt: number
}

/** A batch-import file discarded before it was ever saved as media. */
export interface DiscardFileInput {
  route: string
  name: string
  type: MediaModel['type']
}

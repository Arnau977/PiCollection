import type { MediaModel } from './Media'

/**
 * Why a file left the app, settled when it does and kept from then on: a
 * repeat of a file still in the app, a variant of a similar one, a plain
 * delete, or replaced by a similar one.
 */
export type DiscardReason = 'duplicate' | 'variant' | 'deleted' | 'replaced'

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

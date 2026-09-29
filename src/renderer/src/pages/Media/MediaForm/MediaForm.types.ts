import type { MediaModel } from '@shared/models'

export interface InitialFile {
  route: string
  name: string
  type: MediaModel['type']
}

export interface QueueInfo {
  current: number
  total: number
  /** Moves to the next item, whether or not the current one was saved via "Guardar" first. */
  onNext: () => void
  /** Moves back to the previous item; omitted entirely on the first item of a queue. */
  onPrevious?: () => void
  /** Batch import only: sends this item and every one after it to Pending without reviewing them. */
  onSendRemainingToPending?: () => void
  /** How many of those aren't saved yet - the ones the action above would send. */
  remaining?: number
}

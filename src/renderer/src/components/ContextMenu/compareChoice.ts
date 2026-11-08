import { useSyncExternalStore } from 'react'
import type { MediaModel } from '@shared/models'

/**
 * The media picked with "Choose to compare", waiting for a second one. Lives
 * outside React so it survives moving between pages, like Explorer's
 * "Select for compare".
 */
let chosen: MediaModel | null = null
const listeners = new Set<() => void>()

export function setCompareChoice(media: MediaModel | null): void {
  chosen = media
  listeners.forEach((listener) => listener())
}

export function getCompareChoice(): MediaModel | null {
  return chosen
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return (): void => {
    listeners.delete(listener)
  }
}

export function useCompareChoice(): MediaModel | null {
  return useSyncExternalStore(subscribe, getCompareChoice)
}

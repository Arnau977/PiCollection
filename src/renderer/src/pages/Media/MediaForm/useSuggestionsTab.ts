import { useState } from 'react'

export type SuggestionsTab = 'source' | 'sauce' | 'wd14'

const STORAGE_KEY = 'picollection.suggestionsTab'

function readStoredTab(): SuggestionsTab {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'sauce' ? 'sauce' : 'wd14'
  } catch {
    return 'wd14'
  }
}

/**
 * Which suggestion source the rail shows. A captured media opens on its
 * source site (it needs no lookup and is the post the user chose to save);
 * otherwise the rail reopens on whichever lookup the user picked last,
 * defaulting to the local AI tagger.
 */
export function useSuggestionsTab(
  sourceAvailable: boolean
): [SuggestionsTab, (tab: SuggestionsTab) => void] {
  const [tab, setTab] = useState<SuggestionsTab>(() =>
    sourceAvailable ? 'source' : readStoredTab()
  )

  function select(next: SuggestionsTab): void {
    setTab(next)
    // The source tab only exists for captures, so it isn't worth remembering.
    if (next === 'source') return
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode or blocked storage: the choice just isn't remembered.
    }
  }

  return [tab, select]
}

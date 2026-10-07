import { useCallback, useState } from 'react'
import { normalizeForMatch } from '../utils/fuzzyMatch'
import { SHORTCUTS, useShortcut } from './useShortcut'

interface FindableTag {
  name: string
  aliases?: string[]
}

export interface TagFinderState {
  open: boolean
  query: string
  setQuery: (query: string) => void
  openFinder: () => void
  close: () => void
  /** True for every tag while nothing is typed. */
  matches: (tag: FindableTag) => boolean
}

/**
 * "Does this media have tag X?" - Ctrl+F opens a find bar that narrows a
 * media's tag chips to the ones whose name (or alias) contains the text.
 */
export function useTagFinder(enabled = true): TagFinderState {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const openFinder = useCallback(() => setOpen(true), [])
  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])
  useShortcut(SHORTCUTS.findTag, openFinder, enabled)

  const needle = open ? normalizeForMatch(query) : ''
  const matches = useCallback(
    (tag: FindableTag): boolean =>
      !needle ||
      [tag.name, ...(tag.aliases ?? [])].some((name) => normalizeForMatch(name).includes(needle)),
    [needle]
  )

  return { open, query, setQuery, openFinder, close, matches }
}

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DanbooruTagSuggestion } from '@shared/models'
import { useDebouncedValue } from '../../utils/useDebouncedValue'
import { useDanbooruCredentialsConfigured } from '../../hooks/useDanbooruCredentialsConfigured'
import './DanbooruTagAutocomplete.css'

const MIN_QUERY_LENGTH = 2
const MARGIN = 8

interface DanbooruTagAutocompleteProps {
  id: string
  value: string
  onChange: (value: string) => void
}

interface Position {
  top: number
  left: number
  width: number
}

function computePosition(anchor: DOMRect): Position {
  const left = Math.min(Math.max(anchor.left, MARGIN), window.innerWidth - anchor.width - MARGIN)
  return { top: anchor.bottom + 4, left, width: anchor.width }
}

/**
 * The suggestions list is portaled into <body> instead of rendered inline -
 * this field is used inside .manage-form-panel, which has its own
 * overflow-y: auto (so an edit panel taller than its row gets its own
 * scrollbar instead of being silently clipped by the page). An absolutely
 * positioned dropdown nested inside that box gets clipped by it too, hiding
 * the very part meant to overlay outside the form. Same portal pattern as
 * TagWikiInfo's popover, for the same reason.
 */
export function DanbooruTagAutocomplete({
  id,
  value,
  onChange
}: DanbooruTagAutocompleteProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [suggestions, setSuggestions] = useState<DanbooruTagSuggestion[]>([])
  const debouncedValue = useDebouncedValue(value, 200)
  const hasDanbooruAccount = useDanbooruCredentialsConfigured()

  useEffect(() => {
    const query = debouncedValue.trim()
    // Keeps the plain text input working either way - only the Danbooru-
    // backed suggestion dropdown is unavailable without a configured account
    // (see useDanbooruCredentialsConfigured), same as fetchDanbooruTags and
    // lookupTagWiki refusing the call on the main-process side.
    if (query.length < MIN_QUERY_LENGTH || !hasDanbooruAccount) {
      setSuggestions([])
      return
    }
    let cancelled = false
    window.api.danbooru.autocompleteTags(query).then((result) => {
      if (cancelled) return
      setSuggestions(result.success ? result.data : [])
    })
    return (): void => {
      cancelled = true
    }
  }, [debouncedValue, hasDanbooruAccount])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent): void {
      const target = event.target as Node
      if (!containerRef.current?.contains(target) && !listRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    // The list renders in a portal, positioned from a rect captured on open -
    // if the anchor's scroll container (.manage-form-panel) scrolls, the
    // anchor moves out from under it, so close rather than leave a
    // disconnected floating list (see TagWikiInfo's popover for the same
    // tradeoff).
    function handleScroll(event: Event): void {
      if (listRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('scroll', handleScroll, true)
    return (): void => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  function openAt(target: HTMLInputElement): void {
    setPosition(computePosition(target.getBoundingClientRect()))
    setOpen(true)
  }

  function handleSelect(name: string): void {
    onChange(name)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div className="danbooru-tag-autocomplete" ref={containerRef}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          openAt(e.target)
        }}
        onFocus={(e) => openAt(e.target)}
      />
      {open &&
        suggestions.length > 0 &&
        position &&
        createPortal(
          <ul
            className="danbooru-tag-autocomplete-list"
            role="listbox"
            ref={listRef}
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            {suggestions.map((suggestion) => (
              <li key={suggestion.name}>
                <button type="button" onClick={() => handleSelect(suggestion.name)}>
                  {suggestion.name}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  )
}

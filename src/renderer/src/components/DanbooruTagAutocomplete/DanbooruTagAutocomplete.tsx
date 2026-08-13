import { useEffect, useRef, useState } from 'react'
import type { DanbooruTagSuggestion } from '@shared/models'
import { useDebouncedValue } from '../../utils/useDebouncedValue'
import './DanbooruTagAutocomplete.css'

const MIN_QUERY_LENGTH = 2

interface DanbooruTagAutocompleteProps {
  id: string
  value: string
  onChange: (value: string) => void
}

export function DanbooruTagAutocomplete({
  id,
  value,
  onChange
}: DanbooruTagAutocompleteProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<DanbooruTagSuggestion[]>([])
  const debouncedValue = useDebouncedValue(value, 200)

  useEffect(() => {
    const query = debouncedValue.trim()
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([])
      return
    }
    let cancelled = false
    window.api.danbooru.autocompleteTags(query).then((result) => {
      if (cancelled) return
      setSuggestions(result.success ? result.data : [])
    })
    return () => {
      cancelled = true
    }
  }, [debouncedValue])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

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
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {open && suggestions.length > 0 && (
        <ul className="danbooru-tag-autocomplete-list" role="listbox">
          {suggestions.map((suggestion) => (
            <li key={suggestion.name}>
              <button type="button" onClick={() => handleSelect(suggestion.name)}>
                {suggestion.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

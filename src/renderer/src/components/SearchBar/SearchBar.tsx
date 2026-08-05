import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import type {
  ArtistModel,
  CharacterModel,
  MediaFilters,
  SeriesModel,
  TagModel
} from '@shared/models'
import { formatCharacterOptionLabel } from '../../utils/matchEntityNames'
import { useDebouncedValue } from '../../utils/useDebouncedValue'
import { InfoTooltip } from '../InfoTooltip/InfoTooltip'
import './SearchBar.css'

type SuggestionKind = 'tag' | 'character' | 'artist' | 'series'

interface Suggestion {
  kind: SuggestionKind
  id: string
  label: string
}

interface SearchBarProps {
  filters: MediaFilters
  onFiltersChange: (filters: MediaFilters) => void
  artists: ArtistModel[]
  tags: TagModel[]
  characters: CharacterModel[]
  series: SeriesModel[]
}

/** The word currently being typed: everything after the last space or parenthesis. */
const TRAILING_TOKEN = /[^\s()]*$/

function trailingToken(value: string): string {
  return value.match(TRAILING_TOKEN)?.[0] ?? ''
}

function quoteIfNeeded(name: string): string {
  return /\s/.test(name) ? `"${name}"` : name
}

/** Completes the half-typed word with a suggestion, keeping any leading `-`. */
function completeTrailingToken(value: string, replacement: string): string {
  const match = value.match(TRAILING_TOKEN)
  const start = match?.index ?? value.length
  const negation = (match?.[0] ?? '').startsWith('-') ? '-' : ''
  return `${value.slice(0, start)}${negation}${quoteIfNeeded(replacement)} `
}

/**
 * Removes the word currently being typed, leaving everything before it
 * (including any separator that was already there) untouched. Used for
 * character suggestions, which resolve to a structured filter instead of
 * being inserted as text - see `applySuggestion`.
 */
function removeTrailingToken(value: string): string {
  const match = value.match(TRAILING_TOKEN)
  const start = match?.index ?? value.length
  return value.slice(0, start)
}

export function SearchBar({
  filters,
  onFiltersChange,
  artists,
  tags,
  characters,
  series
}: SearchBarProps): JSX.Element {
  const { t } = useTranslation()
  const [query, setQuery] = useState(filters.query ?? '')
  const debouncedQuery = useDebouncedValue(query, 300)
  const [highlighted, setHighlighted] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const isFirstRender = useRef(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    onFiltersChange({ ...filters, query: debouncedQuery.trim() || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery])

  // A leading `-` is syntax, not part of the name being searched for.
  const token = trailingToken(query).replace(/^-+/, '').replace(/"/g, '').toLowerCase()

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!token) return []
    const matches = (name: string): boolean => name.toLowerCase().includes(token)

    return [
      ...tags
        .filter((tag) => matches(tag.name))
        .map((tag) => ({
          kind: 'tag' as const,
          id: tag.id,
          label: tag.name
        })),
      ...characters
        .filter((character) => matches(character.name))
        .map((character) => ({
          kind: 'character' as const,
          id: character.id,
          label: formatCharacterOptionLabel(character)
        })),
      ...series
        .filter((s) => matches(s.name))
        .map((s) => ({
          kind: 'series' as const,
          id: s.id,
          label: s.name
        })),
      ...artists
        .filter((artist) => matches(artist.name))
        .map((artist) => ({
          kind: 'artist' as const,
          id: artist.id,
          label: artist.name
        }))
    ].slice(0, 8)
  }, [token, tags, characters, series, artists])

  const visibleSuggestions = dismissed ? [] : suggestions

  useEffect(() => {
    setHighlighted(0)
  }, [suggestions.length])

  /**
   * Unlike tag/series/artist (unique names, safe to search as free text),
   * a character name can collide across series - `character.name` has no
   * UNIQUE constraint in the DB. Free text has no way to reference a
   * specific character's ID, so a clicked character suggestion is applied
   * as a structured `characterGroups` filter instead of being inserted
   * into the query, guaranteeing it resolves to exactly the character that
   * was clicked. It's added (AND) to the first existing group, or starts a
   * new one - never a new OR group, per the confirmed design.
   */
  function applyCharacterSuggestion(characterId: string): void {
    const nextQuery = removeTrailingToken(query)
    setQuery(nextQuery)

    const groups = filters.characterGroups ?? []
    const nextGroups: string[][] =
      groups.length === 0
        ? [[characterId]]
        : groups.map((group, index) =>
            index === 0 && !group.includes(characterId) ? [...group, characterId] : group
          )

    onFiltersChange({
      ...filters,
      query: nextQuery.trim() || undefined,
      characterGroups: nextGroups
    })
  }

  function applySuggestion(suggestion: Suggestion): void {
    if (suggestion.kind === 'character') {
      applyCharacterSuggestion(suggestion.id)
    } else {
      setQuery((current) => completeTrailingToken(current, suggestion.label))
    }
    setDismissed(true)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      setDismissed(true)
      return
    }
    if (visibleSuggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((i) => (i + 1) % visibleSuggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => (i - 1 + visibleSuggestions.length) % visibleSuggestions.length)
    } else if (e.key === 'Tab' && visibleSuggestions[highlighted]) {
      e.preventDefault()
      applySuggestion(visibleSuggestions[highlighted])
    }
  }

  const kindLabel: Record<SuggestionKind, string> = {
    tag: t('search.tagPrefix'),
    character: t('search.characterPrefix'),
    artist: t('search.artistPrefix'),
    series: t('search.seriesPrefix')
  }

  return (
    <div className="search-bar">
      <div className="search-bar-input-row">
        <Search size={16} className="search-bar-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          className="search-bar-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setDismissed(false)
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('search.placeholder')}
          aria-label={t('search.label')}
        />
        <InfoTooltip text={t('search.tooltip')} />
      </div>

      {visibleSuggestions.length > 0 && (
        <ul className="search-suggestions" role="listbox">
          {visibleSuggestions.map((suggestion, index) => (
            <li key={`${suggestion.kind}-${suggestion.id}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlighted}
                className={index === highlighted ? 'search-suggestion active' : 'search-suggestion'}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => applySuggestion(suggestion)}
              >
                <span className="search-suggestion-kind">{kindLabel[suggestion.kind]}</span>
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import type {
  ArtistModel,
  CharacterModel,
  FilterListModel,
  MediaFilters,
  SeriesModel,
  TagModel
} from '@shared/models'
import { fuzzyScore } from '../../utils/fuzzyMatch'
import { formatCharacterOptionLabel } from '../../utils/matchEntityNames'
import { useDebouncedValue } from '../../utils/useDebouncedValue'
import { InfoTooltip } from '../InfoTooltip/InfoTooltip'
import './SearchBar.css'

type SuggestionKind = 'tag' | 'character' | 'artist' | 'series' | 'ai' | 'list'

interface Suggestion {
  kind: SuggestionKind
  id: string
  label: string
  /** Text inserted into the query; defaults to `label` when omitted. */
  insertValue?: string
}

interface SearchBarProps {
  filters: MediaFilters
  onFiltersChange: (filters: MediaFilters) => void
  artists: ArtistModel[]
  tags: TagModel[]
  characters: CharacterModel[]
  series: SeriesModel[]
  filterLists: FilterListModel[]
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
  series,
  filterLists
}: SearchBarProps): JSX.Element {
  const { t } = useTranslation()
  const [query, setQuery] = useState(filters.query ?? '')
  const debouncedQuery = useDebouncedValue(query, 300)
  const [highlighted, setHighlighted] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [focused, setFocused] = useState(false)
  // The text the filters and the box last agreed on, which tells a change made
  // elsewhere from this box's own typing coming back through the filters.
  const appliedQuery = useRef(query.trim())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const next = debouncedQuery.trim()
    if (appliedQuery.current === next) return
    appliedQuery.current = next
    onFiltersChange({ ...filters, query: next || undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery])

  // Clearing the filters or opening and closing a list changes the query from
  // outside. Left stale, the old text would be applied again with the next key.
  useEffect(() => {
    const next = filters.query ?? ''
    if (appliedQuery.current === next.trim()) return
    appliedQuery.current = next.trim()
    setQuery(next)
  }, [filters.query])

  // A leading `-` is syntax, not part of the name being searched for.
  const rawToken = trailingToken(query)
  const isNegated = rawToken.startsWith('-')
  const token = rawToken.replace(/^-+/, '').replace(/"/g, '').toLowerCase()

  // With nothing typed the box lists the filter lists, so they can be found
  // without remembering their names.
  const browsingLists = !query.trim()

  const suggestions = useMemo<Suggestion[]>(() => {
    const lists = filterLists
      .filter((list) => !filters.filterListIds?.includes(list.id))
      .map((list): Suggestion => ({ kind: 'list', id: list.id, label: list.name }))
    if (browsingLists) return lists
    if (!token) return []
    // Every kind is scored on the same scale and ranked together, so a close
    // character match isn't pushed out of the top 8 by loose tag matches.
    const scored: { suggestion: Suggestion; score: number }[] = []
    function add(name: string, suggestion: Suggestion): void {
      const score = fuzzyScore(name, token)
      if (score !== null) scored.push({ suggestion, score })
    }
    // First, so a list wins a tie with the tag it may be named after. There's
    // no excluding a list, so a leading `-` doesn't offer them.
    if (!isNegated) for (const list of lists) add(list.label, list)
    for (const tag of tags) add(tag.name, { kind: 'tag', id: tag.id, label: tag.name })
    for (const character of characters) {
      add(character.name, {
        kind: 'character',
        id: character.id,
        label: formatCharacterOptionLabel(character)
      })
    }
    for (const s of series) add(s.name, { kind: 'series', id: s.id, label: s.name })
    for (const artist of artists)
      add(artist.name, { kind: 'artist', id: artist.id, label: artist.name })
    // Array.prototype.sort is stable, so equal scores keep the order above.
    scored.sort((a, b) => b.score - a.score)

    return [
      ...('ai'.startsWith(token)
        ? [
            {
              kind: 'ai' as const,
              id: 'ai',
              label: isNegated ? t('search.notAiSuggestion') : t('search.aiSuggestion'),
              insertValue: 'ai'
            }
          ]
        : []),
      ...scored.map((entry) => entry.suggestion)
    ].slice(0, 8)
  }, [
    browsingLists,
    token,
    isNegated,
    tags,
    characters,
    series,
    artists,
    filterLists,
    filters.filterListIds,
    t
  ])

  const visibleSuggestions = dismissed || !focused ? [] : suggestions

  // Nothing is preselected while browsing: Tab must still leave the box.
  const firstHighlight = browsingLists ? -1 : 0
  useEffect(() => {
    setHighlighted(firstHighlight)
  }, [suggestions.length, firstHighlight])

  /** A suggestion that becomes a structured filter takes the typed word out of the text. */
  function applyInPlaceOfTypedWord(changes: MediaFilters): void {
    const nextQuery = removeTrailingToken(query)
    setQuery(nextQuery)
    appliedQuery.current = nextQuery.trim()
    onFiltersChange({ ...filters, query: nextQuery.trim() || undefined, ...changes })
  }

  /**
   * Unlike tag/artist (unique names, safe to search as free text), a
   * character name can collide across series - `character.name` has no
   * UNIQUE constraint in the DB. Free text has no way to reference a
   * specific character's ID, so a clicked character suggestion is applied
   * as a structured `characterGroups` filter instead of being inserted
   * into the query, guaranteeing it resolves to exactly the character that
   * was clicked. It's added (AND) to the first existing group, or starts a
   * new one - never a new OR group, per the confirmed design.
   */
  function applyCharacterSuggestion(characterId: string): void {
    const groups = filters.characterGroups ?? []
    const nextGroups: string[][] =
      groups.length === 0
        ? [[characterId]]
        : groups.map((group, index) =>
            index === 0 && !group.includes(characterId) ? [...group, characterId] : group
          )

    applyInPlaceOfTypedWord({ characterGroups: nextGroups, noCharacter: undefined })
  }

  /**
   * A free-text series name only matches media linked to that exact series,
   * not its descendants - only the structured `seriesGroups` filter expands
   * through the parent/child closure on the backend. So, like characters, a
   * clicked series suggestion is applied as a structured filter instead of
   * being inserted into the query, added (AND) to the first existing group
   * or starting a new one - mirroring the character suggestion's grouping.
   */
  function applySeriesSuggestion(seriesId: string): void {
    const groups = filters.seriesGroups ?? []
    const nextGroups: string[][] =
      groups.length === 0
        ? [[seriesId]]
        : groups.map((group, index) =>
            index === 0 && !group.includes(seriesId) ? [...group, seriesId] : group
          )

    applyInPlaceOfTypedWord({ seriesGroups: nextGroups, noSeries: undefined })
  }

  function applyListSuggestion(listId: string): void {
    applyInPlaceOfTypedWord({ filterListIds: [...(filters.filterListIds ?? []), listId] })
  }

  function applySuggestion(suggestion: Suggestion): void {
    if (suggestion.kind === 'list') {
      applyListSuggestion(suggestion.id)
    } else if (suggestion.kind === 'character') {
      applyCharacterSuggestion(suggestion.id)
    } else if (suggestion.kind === 'series') {
      applySeriesSuggestion(suggestion.id)
    } else {
      const text = suggestion.insertValue ?? suggestion.label
      setQuery((current) => completeTrailingToken(current, text))
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
      setHighlighted(
        (i) => (Math.max(i, 0) - 1 + visibleSuggestions.length) % visibleSuggestions.length
      )
    } else if (e.key === 'Tab' && visibleSuggestions[highlighted]) {
      e.preventDefault()
      applySuggestion(visibleSuggestions[highlighted])
    }
  }

  const kindLabel: Record<SuggestionKind, string> = {
    tag: t('search.tagPrefix'),
    character: t('search.characterPrefix'),
    artist: t('search.artistPrefix'),
    series: t('search.seriesPrefix'),
    ai: t('filters.ai'),
    list: t('search.listPrefix')
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
          onFocus={() => {
            setFocused(true)
            if (browsingLists) setDismissed(false)
          }}
          onBlur={() => {
            setFocused(false)
            setHighlighted(firstHighlight)
          }}
          onClick={() => {
            if (browsingLists) setDismissed(false)
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('search.placeholder')}
          aria-label={t('search.label')}
        />
        <InfoTooltip text={t('search.tooltip')} />
      </div>

      {visibleSuggestions.length > 0 && (
        // Pressing an option mustn't blur the box, which would close the list
        // before the click lands.
        <ul className="search-suggestions" role="listbox" onMouseDown={(e) => e.preventDefault()}>
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

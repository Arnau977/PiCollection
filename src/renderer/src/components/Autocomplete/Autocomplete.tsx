import { Ban, ChevronDown, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  ComboBox,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
  type Key
} from 'react-aria-components'
import { filterByQuery } from '../../utils/filterByQuery'
import './Autocomplete.css'

const CREATE_KEY = '__create_new__'
// Caps the option pool shown before the user has typed anything - browsing the
// full list (which can be hundreds of tags/characters) isn't useful and makes
// the popover feel overwhelming; typing narrows it down instead.
const BROWSE_LIMIT = 10

interface AutocompleteProps<T> {
  name: string
  label: string
  options: T[]
  getOptionLabel: (option: T) => string
  getOptionValue: (option: T) => string
  onSelect: (option: T | null) => void
  selectedKey?: string | null
  /** When true, the search box clears back to empty after a pick instead of showing the picked label — used for multi-select pickers. */
  resetQueryAfterSelect?: boolean
  /** When provided, typing a name that matches no existing option shows a "create" item that calls this instead. */
  onCreate?: (name: string) => void
  /** Hides the visible label when the surrounding layout already provides one; `label` still names the field for assistive tech. */
  hideLabel?: boolean
  /**
   * Used only for the "does the typed text already match an existing option" (create-suppression)
   * check - distinct from `getOptionLabel`, which may render extra context (e.g. linked series)
   * that would otherwise prevent an exact match. Defaults to `getOptionLabel` when not provided.
   */
  getOptionMatchName?: (option: T) => string
  /** Disables the input and dropdown trigger — used to make a single-selection field unusable while a "none of these" toggle elsewhere is active. */
  disabled?: boolean
  /**
   * Renders a small icon toggle inside the field, next to the dropdown chevron, for "none of
   * these" filters. Deliberately a plain `<button>` rather than react-aria's `Button` — it must
   * stay clickable even when `disabled` is true, so the user can uncheck it to re-enable the
   * field; a RAC `Button` would inherit `isDisabled` from the surrounding `ComboBox` and become
   * unclickable along with everything else.
   */
  noneToggle?: {
    checked: boolean
    onChange: (checked: boolean) => void
    label: string
  }
}

export function Autocomplete<T>({
  name,
  label,
  options,
  getOptionLabel,
  getOptionValue,
  onSelect,
  selectedKey = null,
  resetQueryAfterSelect = false,
  onCreate,
  hideLabel = false,
  getOptionMatchName = getOptionLabel,
  disabled = false,
  noneToggle
}: AutocompleteProps<T>): JSX.Element {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  // Keeps the displayed text in sync when `selectedKey` changes from outside
  // a direct pick in this dropdown - e.g. a newly-created option is linked
  // in in a parent's async handler, a suggestion elsewhere sets the id
  // straight into state, or a form switches to editing a different record
  // (whose value for this field may be unset). Without this, the input
  // keeps showing whatever was previously selected - including text left
  // over from a different record - since `query` is otherwise only ever
  // set by `handleSelectionChange` below.
  const prevSelectedKeyRef = useRef(selectedKey)
  useEffect(() => {
    const keyChanged = selectedKey !== prevSelectedKeyRef.current
    prevSelectedKeyRef.current = selectedKey

    if (!selectedKey) {
      // Only clear on an actual transition, not on every unrelated re-render
      // while nothing is selected - otherwise this would wipe out text the
      // user is mid-typing to search for a new (not-yet-selected) option.
      if (keyChanged) setQuery('')
      return
    }
    const option = options.find((item) => getOptionValue(item) === selectedKey)
    if (option) setQuery(getOptionLabel(option))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, options])

  const filteredOptions = useMemo(() => {
    const matches = filterByQuery(options, query, getOptionLabel)
    return query.trim() ? matches : matches.slice(0, BROWSE_LIMIT)
  }, [options, query, getOptionLabel])

  const trimmedQuery = query.trim()
  const hasExactMatch = options.some(
    (option) => getOptionMatchName(option).toLowerCase() === trimmedQuery.toLowerCase()
  )
  const showCreateOption = Boolean(onCreate) && trimmedQuery.length > 0 && !hasExactMatch

  function handleInputChange(value: string): void {
    setQuery(value)
    // Clearing the text is the only way to remove a single selection (there's no
    // separate "x" button here, unlike MultiSelectAutocomplete's chips). Without
    // this, `selectedKey` stays set while the input is merely empty, and on
    // blur/Enter the ComboBox reverts the text back to the still-selected
    // option instead of clearing it.
    if (value === '' && selectedKey) {
      onSelect(null)
    }
  }

  function handleSelectionChange(key: Key | null): void {
    if (key === CREATE_KEY) {
      onCreate?.(trimmedQuery)
      setQuery('')
      return
    }
    const option = options.find((item) => getOptionValue(item) === key) ?? null
    onSelect(option)
    if (option && !resetQueryAfterSelect) {
      setQuery(getOptionLabel(option))
    } else {
      setQuery('')
    }
  }

  return (
    <ComboBox
      name={name}
      aria-label={label}
      selectedKey={selectedKey}
      inputValue={query}
      onInputChange={handleInputChange}
      onSelectionChange={handleSelectionChange}
      isDisabled={disabled}
    >
      {!hideLabel && <Label>{label}</Label>}
      <div
        className={noneToggle ? 'autocomplete-input-row has-none-toggle' : 'autocomplete-input-row'}
      >
        <Input />
        {noneToggle && (
          <button
            type="button"
            className="autocomplete-none-toggle"
            aria-pressed={noneToggle.checked}
            aria-label={noneToggle.label}
            onClick={() => noneToggle.onChange(!noneToggle.checked)}
          >
            <Ban size={14} />
          </button>
        )}
        <Button>
          <ChevronDown size={16} />
        </Button>
      </div>
      <Text slot="description" />
      <FieldError />
      <Popover>
        <ListBox
          renderEmptyState={() => (
            <div className="autocomplete-empty">{t('autocomplete.noResults')}</div>
          )}
        >
          {showCreateOption && (
            <ListBoxItem
              id={CREATE_KEY}
              textValue={trimmedQuery}
              className="autocomplete-create-item"
            >
              <Plus size={14} />
              {t('autocomplete.createOption', { name: trimmedQuery })}
            </ListBoxItem>
          )}
          {filteredOptions.map((option) => (
            <ListBoxItem
              key={getOptionValue(option)}
              id={getOptionValue(option)}
              textValue={getOptionLabel(option)}
            >
              {getOptionLabel(option)}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </ComboBox>
  )
}

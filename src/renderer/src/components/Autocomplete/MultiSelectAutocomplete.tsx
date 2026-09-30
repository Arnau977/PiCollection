import { useMemo } from 'react'
import { Crosshair, SquareCheck, SquareX, X } from 'lucide-react'
import { Autocomplete } from './Autocomplete'

/** An on/off switch on each selected chip that supports it (e.g. "only this one, without its forms"). */
export interface ChipToggle {
  isAvailable: (value: string) => boolean
  isOn: (value: string) => boolean
  onToggle: (value: string) => void
  /** Accessible name, followed by the chip's own label. */
  label: string
}

/**
 * Include/exclude per chip, shown as a checkbox-like box: a check means
 * "must have it", a cross "must not have it"; clicking flips between the two
 * (no chip at all is the third, "not filtered by it", state).
 */
export interface ChipExclusion {
  isExcluded: (value: string) => boolean
  onToggle: (value: string) => void
  /** Accessible names, each followed by the chip's own label. */
  includedLabel: string
  excludedLabel: string
}

interface MultiSelectAutocompleteProps<T> {
  name: string
  label: string
  options: T[]
  getOptionLabel: (option: T) => string
  getOptionValue: (option: T) => string
  selectedValues: string[]
  onChange: (values: string[]) => void
  onCreate?: (name: string) => void
  /** Hides the visible label when the surrounding layout already provides one. */
  hideLabel?: boolean
  /** Disables the picker — used to make the whole field unusable while a "none of these" toggle elsewhere is active. Existing chips (if any) are unaffected. */
  disabled?: boolean
  /** Passed through to `Autocomplete`; see its docs for the create-suppression matching behavior. */
  getOptionMatchName?: (option: T) => string
  /** Passed straight through to the inner `Autocomplete`; see its docs. */
  noneToggle?: {
    checked: boolean
    onChange: (checked: boolean) => void
    label: string
  }
  chipToggle?: ChipToggle
  chipExclusion?: ChipExclusion
  invalid?: boolean
}

export function MultiSelectAutocomplete<T>({
  name,
  label,
  options,
  getOptionLabel,
  getOptionValue,
  selectedValues,
  onChange,
  onCreate,
  hideLabel = false,
  disabled = false,
  getOptionMatchName,
  noneToggle,
  chipToggle,
  chipExclusion,
  invalid
}: MultiSelectAutocompleteProps<T>): JSX.Element {
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues])
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedSet.has(getOptionValue(option))),
    [options, selectedSet, getOptionValue]
  )
  const availableOptions = useMemo(
    () => options.filter((option) => !selectedSet.has(getOptionValue(option))),
    [options, selectedSet, getOptionValue]
  )

  function handleSelect(option: T | null): void {
    if (!option) return
    const value = getOptionValue(option)
    if (!selectedValues.includes(value)) {
      onChange([...selectedValues, value])
    }
  }

  function handleRemove(value: string): void {
    onChange(selectedValues.filter((selected) => selected !== value))
  }

  return (
    <div className="multi-select-autocomplete">
      <Autocomplete
        name={name}
        label={label}
        options={availableOptions}
        getOptionLabel={getOptionLabel}
        getOptionValue={getOptionValue}
        onSelect={handleSelect}
        selectedKey={null}
        resetQueryAfterSelect
        onCreate={onCreate}
        hideLabel={hideLabel}
        getOptionMatchName={getOptionMatchName}
        disabled={disabled}
        noneToggle={noneToggle}
        invalid={invalid}
      />
      {selectedOptions.length > 0 && (
        <ul className="multi-select-chips">
          {selectedOptions.map((option) => {
            const excluded = chipExclusion?.isExcluded(getOptionValue(option)) ?? false
            return (
              <li key={getOptionValue(option)} className={excluded ? 'chip is-excluded' : 'chip'}>
                {chipExclusion && (
                  <button
                    type="button"
                    className="chip-exclusion"
                    aria-label={`${excluded ? chipExclusion.excludedLabel : chipExclusion.includedLabel}: ${getOptionLabel(option)}`}
                    title={excluded ? chipExclusion.excludedLabel : chipExclusion.includedLabel}
                    onClick={() => chipExclusion.onToggle(getOptionValue(option))}
                  >
                    {excluded ? <SquareX size={14} /> : <SquareCheck size={14} />}
                  </button>
                )}
                <span className="chip-label">{getOptionLabel(option)}</span>
                {chipToggle?.isAvailable(getOptionValue(option)) && (
                  <button
                    type="button"
                    className="chip-toggle"
                    aria-pressed={chipToggle.isOn(getOptionValue(option))}
                    aria-label={`${chipToggle.label}: ${getOptionLabel(option)}`}
                    title={chipToggle.label}
                    onClick={() => chipToggle.onToggle(getOptionValue(option))}
                  >
                    <Crosshair size={12} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(getOptionValue(option))}
                  aria-label={`Quitar ${getOptionLabel(option)}`}
                >
                  <X size={12} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

import { X } from 'lucide-react'
import { Autocomplete } from './Autocomplete'

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
  noneToggle
}: MultiSelectAutocompleteProps<T>): JSX.Element {
  const selectedOptions = options.filter((option) =>
    selectedValues.includes(getOptionValue(option))
  )
  const availableOptions = options.filter(
    (option) => !selectedValues.includes(getOptionValue(option))
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
      />
      {selectedOptions.length > 0 && (
        <ul className="multi-select-chips">
          {selectedOptions.map((option) => (
            <li key={getOptionValue(option)} className="chip">
              {getOptionLabel(option)}
              <button
                type="button"
                onClick={() => handleRemove(getOptionValue(option))}
                aria-label={`Quitar ${getOptionLabel(option)}`}
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

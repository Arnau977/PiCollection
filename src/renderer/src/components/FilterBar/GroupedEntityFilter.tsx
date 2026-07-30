import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MultiSelectAutocomplete } from '../Autocomplete/MultiSelectAutocomplete'
import { InfoTooltip } from '../InfoTooltip/InfoTooltip'
import './GroupedEntityFilter.css'

interface GroupedEntityFilterProps<T> {
  label: string
  groups: string[][]
  onChange: (groups: string[][]) => void
  options: T[]
  getOptionLabel: (option: T) => string
  getOptionValue: (option: T) => string
}

/**
 * Builds an OR-of-AND-groups filter: items selected within a group are AND'd
 * together, and each group is OR'd against the others - e.g.
 * (Ishtar AND Ereshkigal) OR (Rin AND Shirou).
 */
export function GroupedEntityFilter<T>({
  label,
  groups,
  onChange,
  options,
  getOptionLabel,
  getOptionValue
}: GroupedEntityFilterProps<T>): JSX.Element {
  const { t } = useTranslation()
  const effectiveGroups = groups.length > 0 ? groups : [[]]

  function updateGroup(index: number, values: string[]): void {
    const next = [...effectiveGroups]
    next[index] = values
    onChange(next)
  }

  function addGroup(): void {
    onChange([...effectiveGroups, []])
  }

  function removeGroup(index: number): void {
    onChange(effectiveGroups.filter((_, i) => i !== index))
  }

  return (
    <div className="grouped-entity-filter">
      <div className="grouped-entity-filter-header">
        <span className="filter-label">{label}</span>
        <InfoTooltip text={t('filters.groupTooltip')} />
      </div>

      {effectiveGroups.map((group, index) => {
        const groupLabel = effectiveGroups.length > 1 ? `${label} ${index + 1}` : label
        return (
          <div key={index} className="grouped-entity-filter-group">
            {index > 0 && <div className="grouped-entity-filter-or">{t('filters.groupOr')}</div>}
            <div className="grouped-entity-filter-row">
              <MultiSelectAutocomplete
                name={`${label}-group-${index}`}
                // The filter header already shows the label, so only the
                // accessible name is kept here to avoid a visible duplicate.
                label={groupLabel}
                hideLabel
                options={options}
                getOptionLabel={getOptionLabel}
                getOptionValue={getOptionValue}
                selectedValues={group}
                onChange={(values) => updateGroup(index, values)}
              />
              {effectiveGroups.length > 1 && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${t('filters.removeGroup')}: ${groupLabel}`}
                  onClick={() => removeGroup(index)}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )
      })}

      <button type="button" className="grouped-entity-filter-add" onClick={addGroup}>
        <Plus size={14} />
        {t('filters.addGroup')}
      </button>
    </div>
  )
}

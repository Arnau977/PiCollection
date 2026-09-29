import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { parseGroupEntry, toGroupEntry } from '@shared/query/groupEntry'
import { MultiSelectAutocomplete, type ChipToggle } from '../Autocomplete/MultiSelectAutocomplete'
import { InfoTooltip } from '../InfoTooltip/InfoTooltip'
import './GroupedEntityFilter.css'

interface GroupedEntityFilterProps<T> {
  label: string
  groups: string[][]
  onChange: (groups: string[][]) => void
  options: T[]
  getOptionLabel: (option: T) => string
  getOptionValue: (option: T) => string
  /**
   * Renders a toggle for "no entity linked at all", mutually exclusive with
   * `groups`. The caller (not this component) is responsible for clearing
   * `groups` when it's checked — both changes must land in a single state
   * update on the caller's side, so this component only reports the
   * toggle's own state via `onChange` and never touches `groups` itself.
   */
  noneOption?: {
    checked: boolean
    onChange: (checked: boolean) => void
    label: string
  }
  /** Passed to each group's chips - see MultiSelectAutocomplete. */
  chipToggle?: ChipToggle
  /** Lets each chip flip between "must have" and "must not have" (see groupEntry.ts). */
  allowExclusion?: boolean
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
  getOptionValue,
  noneOption,
  chipToggle,
  allowExclusion = false
}: GroupedEntityFilterProps<T>): JSX.Element {
  const { t } = useTranslation()
  const effectiveGroups = groups.length > 0 ? groups : [[]]

  // The picker works on plain ids; exclusions are kept per group and
  // re-applied to whichever ids remain after a change.
  function excludedIn(index: number): Set<string> {
    return new Set(
      effectiveGroups[index]
        .map(parseGroupEntry)
        .flatMap(({ id, excluded }) => (excluded ? [id] : []))
    )
  }

  function updateGroup(index: number, values: string[], excluded = excludedIn(index)): void {
    const next = [...effectiveGroups]
    next[index] = values.map((id) => toGroupEntry({ id, excluded: excluded.has(id) }))
    onChange(next)
  }

  function toggleExcluded(index: number, id: string): void {
    const excluded = excludedIn(index)
    if (!excluded.delete(id)) excluded.add(id)
    updateGroup(
      index,
      effectiveGroups[index].map((entry) => parseGroupEntry(entry).id),
      excluded
    )
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
                selectedValues={group.map((entry) => parseGroupEntry(entry).id)}
                onChange={(values) => updateGroup(index, values)}
                disabled={noneOption?.checked}
                noneToggle={index === 0 ? noneOption : undefined}
                chipToggle={chipToggle}
                chipExclusion={
                  allowExclusion
                    ? {
                        isExcluded: (id) => excludedIn(index).has(id),
                        onToggle: (id) => toggleExcluded(index, id),
                        includedLabel: t('filters.included'),
                        excludedLabel: t('filters.excluded')
                      }
                    : undefined
                }
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

      <button
        type="button"
        className="grouped-entity-filter-add"
        onClick={addGroup}
        disabled={noneOption?.checked}
      >
        <Plus size={14} />
        {t('filters.addGroup')}
      </button>
    </div>
  )
}

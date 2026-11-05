import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import type { FilterListModel, SavedFilters } from '@shared/models'
import { hasActiveFilters } from '@shared/query/hasActiveFilters'
import { pruneMissingEntities, type KnownEntityIds } from '@shared/query/pruneMissingEntities'
import { MultiSelectAutocomplete } from '../../components/Autocomplete/MultiSelectAutocomplete'
import { FilterEntityFields } from '../../components/FilterBar/FilterEntityFields'
import { AiFilter, SfwFilter, TypeFilter } from '../../components/FilterBar/FilterSelects'
import { StableLabel } from '../../components/StableLabel/StableLabel'
import { listsSafeToInclude } from '../Gallery/filterListDraft'

interface FilterListFormProps {
  /** The list being edited, or null for a new one. */
  list: FilterListModel | null
  lists: FilterListModel[]
  /** Null until every entity list loaded cleanly: saving prunes against it. */
  known: KnownEntityIds | null
  onSaved: (id: string) => void
  onCancel: () => void
}

const getListName = (list: FilterListModel): string => list.name
const getListId = (list: FilterListModel): string => list.id

/** Enter in a picker picks; it mustn't also save whatever the form holds. */
function keepEnterInPicker(e: React.KeyboardEvent): void {
  if (e.key === 'Enter' && (e.target as HTMLElement).getAttribute('role') === 'combobox') {
    e.preventDefault()
  }
}

export function FilterListForm({
  list,
  lists,
  known,
  onSaved,
  onCancel
}: FilterListFormProps): JSX.Element {
  const { t } = useTranslation()
  const [name, setName] = useState(list?.name ?? '')
  const [filters, setFilters] = useState<SavedFilters>(list?.filters ?? {})
  const [includedListIds, setIncludedListIds] = useState(list?.includedListIds ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)

  const includable = useMemo(() => listsSafeToInclude(lists, list?.id ?? null), [lists, list?.id])

  // What saving will really store: a filter on something deleted doesn't count.
  const kept = known ? pruneMissingEntities(filters, known) : filters
  const trimmedName = name.trim()
  const blockedReason = !trimmedName
    ? t('filterLists.nameRequired')
    : !hasActiveFilters(kept) && includedListIds.length === 0
      ? t('filterLists.nothingLeft')
      : undefined
  const blocked = Boolean(blockedReason) || !known

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (blocked || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    const input = { name: trimmedName, filters: kept, includedListIds }
    const result = list
      ? await window.api.filterList.update(list.id, input)
      : await window.api.filterList.create(input)
    savingRef.current = false
    setSaving(false)
    if (result.success) onSaved(result.data.id)
    else setError(result.error.message)
  }

  return (
    <form
      className="manage-form-panel filter-list-form"
      onSubmit={handleSubmit}
      onKeyDownCapture={keepEnterInPicker}
    >
      <h2>{list ? t('manage.editingItem', { name: list.name }) : t('filterLists.newList')}</h2>
      <fieldset className="filter-list-form-body" disabled={saving}>
        <div className="manage-edit-actions">
          <button
            type="submit"
            className="btn btn-primary"
            aria-disabled={blocked ? true : undefined}
            title={blockedReason}
          >
            <StableLabel
              current={saving ? t('filterLists.saving') : t('filterLists.save')}
              labels={[t('filterLists.save'), t('filterLists.saving')]}
            />
          </button>
          {list && (
            <button type="button" className="btn" onClick={onCancel}>
              {t('manage.cancel')}
            </button>
          )}
        </div>

        {list?.hasMissingEntities && (
          <p className="filter-list-lost" role="status">
            <AlertTriangle size={16} aria-hidden="true" />
            {t('filterLists.lostFilterDetail')}
          </p>
        )}
        {error && (
          <p className="save-list-error" role="alert">
            {error}
          </p>
        )}

        <div className="filter-list-form-fields">
          <label className="filter-field">
            <span className="filter-label">{t('filters.name')}</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <MultiSelectAutocomplete
            name="filter-list-includes"
            label={t('filterLists.includedLists')}
            options={includable}
            getOptionLabel={getListName}
            getOptionValue={getListId}
            selectedValues={includedListIds}
            onChange={setIncludedListIds}
          />

          <label className="filter-field">
            <span className="filter-label">{t('filterLists.searchText')}</span>
            <input
              type="text"
              value={filters.query ?? ''}
              onChange={(e) => setFilters({ ...filters, query: e.target.value || undefined })}
            />
          </label>

          <div className="filter-list-form-selects">
            <TypeFilter filters={filters} onFiltersChange={setFilters} />
            <SfwFilter filters={filters} onFiltersChange={setFilters} />
            <AiFilter filters={filters} onFiltersChange={setFilters} />
          </div>

          <FilterEntityFields filters={filters} onFiltersChange={setFilters} />
        </div>
      </fieldset>
    </form>
  )
}

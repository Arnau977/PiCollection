import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import type { MediaFilters } from '@shared/models'
import { StableLabel } from '../../components/StableLabel/StableLabel'
import { useFilterLists } from '../../hooks/useEntityLists'
import type { ListEdit } from '../../hooks/useGallerySession'
import { FilterListChips } from './FilterListChips'
import { describeDraft, type DraftNames } from './filterListDraft'
import { activeHeldDefaults, listEditDraft } from './listEdit'

interface ListEditBarProps {
  filters: MediaFilters
  listEdit: ListEdit
  onRemoveList: (id: string) => void
  onCancel: () => void
  onSaved: (name: string) => void
}

const NO_NAMES: DraftNames = {
  lists: new Map(),
  artists: new Map(),
  tags: new Map(),
  characters: new Map(),
  series: new Map()
}

/**
 * Says the filters above are a list being edited, and takes the place of the
 * active-filters row while they are: Clear filters and Save as list would
 * only blur what Save changes means here.
 */
export function ListEditBar({
  filters,
  listEdit,
  onRemoveList,
  onCancel,
  onSaved
}: ListEditBarProps): JSX.Element | null {
  const { t } = useTranslation()
  const { data: lists } = useFilterLists()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)

  const list = lists.find((other) => other.id === listEdit.id)
  const draft = useMemo(() => listEditDraft(filters, listEdit), [filters, listEdit])
  const nothingLeft = useMemo(() => describeDraft(draft, NO_NAMES, t).length === 0, [draft, t])
  const held = useMemo(
    () =>
      describeDraft(
        { filters: activeHeldDefaults(filters, listEdit), includedListIds: [] },
        NO_NAMES,
        t
      ),
    [filters, listEdit, t]
  )

  if (!list) return null
  const name = list.name

  async function save(): Promise<void> {
    if (nothingLeft || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    const result = await window.api.filterList.update(listEdit.id, { name, ...draft })
    savingRef.current = false
    setSaving(false)
    if (result.success) onSaved(name)
    else setError(result.error.message)
  }

  return (
    <div className="gallery-active-filters">
      <Pencil size={16} aria-hidden="true" />
      <span role="status">{t('filterLists.editing', { name })}</span>
      <FilterListChips ids={filters.filterListIds ?? []} onRemove={onRemoveList} />
      {held.length > 0 && (
        <span className="list-edit-note">
          {t('filterLists.notSaved', { items: held.map((item) => item.label).join(', ') })}
        </span>
      )}
      {error && (
        <span className="list-edit-error" role="alert">
          {error}
        </span>
      )}
      <span className="action-bar-spacer" />
      <button type="button" className="btn" disabled={saving} onClick={onCancel}>
        {t('confirmDialog.cancel')}
      </button>
      <button
        type="button"
        className="btn btn-primary"
        aria-disabled={nothingLeft ? true : undefined}
        title={nothingLeft ? t('filterLists.nothingLeft') : undefined}
        disabled={saving}
        onClick={save}
      >
        <StableLabel
          current={saving ? t('filterLists.saving') : t('filterLists.saveChanges')}
          labels={[t('filterLists.saveChanges'), t('filterLists.saving')]}
        />
      </button>
    </div>
  )
}

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { FilterListModel, MediaFilters } from '@shared/models'
import { StableLabel } from '../../components/StableLabel/StableLabel'
import {
  useArtists,
  useCharacters,
  useFilterLists,
  useSeries,
  useTags
} from '../../hooks/useEntityLists'
import {
  describeDraft,
  toDraft,
  type DraftItem,
  type DraftSection,
  type FilterListDraft
} from './filterListDraft'
import '../../components/Autocomplete/Autocomplete.css'
import '../../components/ConfirmDialog/ConfirmDialog.css'
import './SaveFilterListDialog.css'

interface SaveFilterListDialogProps {
  filters: MediaFilters
  onClose: () => void
  onSaved: (list: FilterListModel, draft: FilterListDraft) => void
}

const SECTIONS: DraftSection[] = [
  'lists',
  'search',
  'type',
  'sfw',
  'ai',
  'artist',
  'tags',
  'characters',
  'series'
]

function namesById(items: { id: string; name: string }[]): Map<string, string> {
  return new Map(items.map((item) => [item.id, item.name]))
}

/**
 * Names the gallery's current filters as a list. Everything active is listed
 * and can be taken out first, so a default the user doesn't mean to keep
 * isn't frozen in unnoticed. Taking something out here leaves the gallery
 * as it is.
 */
export function SaveFilterListDialog({
  filters,
  onClose,
  onSaved
}: SaveFilterListDialogProps): JSX.Element {
  const { t } = useTranslation()
  const titleId = useId()
  const itemsId = useId()
  const { data: lists } = useFilterLists()
  const { data: artists } = useArtists()
  const { data: tags } = useTags()
  const { data: characters } = useCharacters()
  const { data: series } = useSeries()

  const [draft, setDraft] = useState(() => toDraft(filters))
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const items = useMemo(
    () =>
      describeDraft(
        draft,
        {
          lists: namesById(lists),
          artists: namesById(artists),
          tags: namesById(tags),
          characters: namesById(characters),
          series: namesById(series)
        },
        t
      ),
    [draft, lists, artists, tags, characters, series, t]
  )

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape' && !savingRef.current) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return (): void => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const trimmedName = name.trim()
  const nothingLeft = items.length === 0
  const blockedReason = nothingLeft
    ? t('filterLists.nothingLeft')
    : !trimmedName
      ? t('filterLists.nameRequired')
      : undefined

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (blockedReason || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    const result = await window.api.filterList.create({ name: trimmedName, ...draft })
    savingRef.current = false
    setSaving(false)
    if (result.success) onSaved(result.data, draft)
    else setError(result.error.message)
  }

  const sectionLabel: Record<DraftSection, string> = {
    lists: t('filterLists.lists'),
    search: t('search.label'),
    type: t('filters.type'),
    sfw: t('filters.sfw'),
    ai: t('filters.ai'),
    artist: t('filters.artist'),
    tags: t('filters.tags'),
    characters: t('filters.characters'),
    series: t('manage.series')
  }

  function renderItem(item: DraftItem): JSX.Element[] {
    const chip = (
      <li key={item.key} className={item.excluded ? 'chip is-excluded' : 'chip'}>
        <span className="chip-label">{item.label}</span>
        {item.excluded && <span className="visually-hidden">, {t('filterLists.excluded')}</span>}
        <button
          type="button"
          aria-label={t('autocomplete.removeChip', { name: item.label })}
          onClick={() => setDraft(item.without)}
        >
          <X size={14} />
        </button>
      </li>
    )
    if (!item.startsGroup) return [chip]
    return [
      <li key={`${item.key}-or`} className="save-list-or">
        {t('filterLists.or')}
      </li>,
      chip
    ]
  }

  return (
    <div
      className="confirm-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <form
        className="confirm-dialog save-list-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
      >
        <h3 id={titleId} className="confirm-dialog-title">
          {t('filterLists.saveAs')}
        </h3>
        <fieldset className="save-list-fields" disabled={saving}>
          <label className="save-list-name">
            <span>{t('filters.name')}</span>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={error ? true : undefined}
            />
          </label>

          {error && (
            <p className="save-list-error" role="alert">
              {error}
            </p>
          )}

          <p id={itemsId} className="save-list-heading">
            {t('filterLists.whatGetsSaved')}
          </p>
          <div className="save-list-items" role="group" aria-labelledby={itemsId}>
            {nothingLeft && <p className="save-list-hint">{t('filterLists.nothingLeft')}</p>}
            {SECTIONS.map((section) => {
              const inSection = items.filter((item) => item.section === section)
              if (inSection.length === 0) return null
              return (
                <div key={section} className="save-list-section">
                  <span className="save-list-section-label">{sectionLabel[section]}</span>
                  <ul className="multi-select-chips">{inSection.flatMap(renderItem)}</ul>
                </div>
              )
            })}
          </div>

          <div className="confirm-dialog-actions">
            <button type="button" className="btn" onClick={onClose}>
              {t('confirmDialog.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              aria-disabled={blockedReason ? true : undefined}
              title={blockedReason}
            >
              <StableLabel
                current={saving ? t('filterLists.saving') : t('filterLists.save')}
                labels={[t('filterLists.save'), t('filterLists.saving')]}
              />
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  )
}

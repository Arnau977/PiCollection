import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CharacterModel, SeriesModel, TagModel } from '@shared/models'
import { useCharacters, useSeries, useTags } from '../../hooks/useEntityLists'
import { MultiSelectAutocomplete } from '../../components/Autocomplete/MultiSelectAutocomplete'
import { formatCharacterOptionLabel } from '../../utils/matchEntityNames'
import '../../components/ConfirmDialog/ConfirmDialog.css'
import './BatchEditDialog.css'

export interface BatchEditSelections {
  addTagIds: string[]
  removeTagIds: string[]
  addCharacterIds: string[]
  removeCharacterIds: string[]
  addSeriesIds: string[]
  removeSeriesIds: string[]
  /** `null` means "don't change" - the only way to represent that for a boolean field. */
  sfw: boolean | null
}

const EMPTY_SELECTIONS: BatchEditSelections = {
  addTagIds: [],
  removeTagIds: [],
  addCharacterIds: [],
  removeCharacterIds: [],
  addSeriesIds: [],
  removeSeriesIds: [],
  sfw: null
}

interface BatchEditDialogProps {
  count: number
  onApply: (selections: BatchEditSelections) => void
  onCancel: () => void
}

function excluding<T extends { id: string }>(options: T[], excludedIds: string[]): T[] {
  const excluded = new Set(excludedIds)
  return options.filter((option) => !excluded.has(option.id))
}

export function BatchEditDialog({ count, onApply, onCancel }: BatchEditDialogProps): JSX.Element {
  const { t } = useTranslation()
  const tags = useTags()
  const characters = useCharacters()
  const series = useSeries()
  const [selections, setSelections] = useState<BatchEditSelections>(EMPTY_SELECTIONS)

  const hasSelection =
    [
      selections.addTagIds,
      selections.removeTagIds,
      selections.addCharacterIds,
      selections.removeCharacterIds,
      selections.addSeriesIds,
      selections.removeSeriesIds
    ].some((list) => list.length > 0) || selections.sfw !== null

  function updateSelection<K extends keyof BatchEditSelections>(key: K, values: string[]): void {
    setSelections((prev) => ({ ...prev, [key]: values }))
  }

  function updateSfw(value: boolean | null): void {
    setSelections((prev) => ({ ...prev, sfw: value }))
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.target === e.currentTarget) onCancel()
  }

  return (
    <div className="confirm-dialog-backdrop" onClick={handleBackdropClick}>
      <div
        className="confirm-dialog batch-edit-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('batchEdit.title', { count })}
      >
        <h3 className="confirm-dialog-title">{t('batchEdit.title', { count })}</h3>
        <div className="batch-edit-dialog-body">
          <div className="batch-edit-section">
            <MultiSelectAutocomplete<TagModel>
              name="batch-add-tags"
              label={t('batchEdit.addTags')}
              options={excluding(tags.data, selections.removeTagIds)}
              getOptionLabel={(tag) => tag.name}
              getOptionValue={(tag) => tag.id}
              selectedValues={selections.addTagIds}
              onChange={(values) => updateSelection('addTagIds', values)}
            />
            <MultiSelectAutocomplete<TagModel>
              name="batch-remove-tags"
              label={t('batchEdit.removeTags')}
              options={excluding(tags.data, selections.addTagIds)}
              getOptionLabel={(tag) => tag.name}
              getOptionValue={(tag) => tag.id}
              selectedValues={selections.removeTagIds}
              onChange={(values) => updateSelection('removeTagIds', values)}
            />
          </div>
          <div className="batch-edit-section">
            <MultiSelectAutocomplete<CharacterModel>
              name="batch-add-characters"
              label={t('batchEdit.addCharacters')}
              options={excluding(characters.data, selections.removeCharacterIds)}
              getOptionLabel={formatCharacterOptionLabel}
              getOptionValue={(character) => character.id}
              selectedValues={selections.addCharacterIds}
              onChange={(values) => updateSelection('addCharacterIds', values)}
            />
            <MultiSelectAutocomplete<CharacterModel>
              name="batch-remove-characters"
              label={t('batchEdit.removeCharacters')}
              options={excluding(characters.data, selections.addCharacterIds)}
              getOptionLabel={formatCharacterOptionLabel}
              getOptionValue={(character) => character.id}
              selectedValues={selections.removeCharacterIds}
              onChange={(values) => updateSelection('removeCharacterIds', values)}
            />
          </div>
          <div className="batch-edit-section">
            <MultiSelectAutocomplete<SeriesModel>
              name="batch-add-series"
              label={t('batchEdit.addSeries')}
              options={excluding(series.data, selections.removeSeriesIds)}
              getOptionLabel={(s) => s.name}
              getOptionValue={(s) => s.id}
              selectedValues={selections.addSeriesIds}
              onChange={(values) => updateSelection('addSeriesIds', values)}
            />
            <MultiSelectAutocomplete<SeriesModel>
              name="batch-remove-series"
              label={t('batchEdit.removeSeries')}
              options={excluding(series.data, selections.addSeriesIds)}
              getOptionLabel={(s) => s.name}
              getOptionValue={(s) => s.id}
              selectedValues={selections.removeSeriesIds}
              onChange={(values) => updateSelection('removeSeriesIds', values)}
            />
          </div>
          <div className="batch-edit-section">
            <span className="filter-label">{t('batchEdit.sfwLabel')}</span>
            <label className="radio-row">
              <input
                type="radio"
                name="batch-sfw"
                checked={selections.sfw === null}
                onChange={() => updateSfw(null)}
              />
              {t('batchEdit.sfwNoChange')}
            </label>
            <label className="radio-row">
              <input
                type="radio"
                name="batch-sfw"
                checked={selections.sfw === true}
                onChange={() => updateSfw(true)}
              />
              {t('batchEdit.sfwMarkSfw')}
            </label>
            <label className="radio-row">
              <input
                type="radio"
                name="batch-sfw"
                checked={selections.sfw === false}
                onChange={() => updateSfw(false)}
              />
              {t('batchEdit.sfwMarkNsfw')}
            </label>
          </div>
        </div>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t('batchEdit.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!hasSelection}
            onClick={() => onApply(selections)}
          >
            {t('batchEdit.apply')}
          </button>
        </div>
      </div>
    </div>
  )
}

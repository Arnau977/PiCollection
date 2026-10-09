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
  /** Same `null` = "don't change" convention as `sfw`. */
  isAiGenerated: boolean | null
}

const EMPTY_SELECTIONS: BatchEditSelections = {
  addTagIds: [],
  removeTagIds: [],
  addCharacterIds: [],
  removeCharacterIds: [],
  addSeriesIds: [],
  removeSeriesIds: [],
  sfw: null,
  isAiGenerated: null
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

interface FlagRadioGroupProps {
  name: string
  label: string
  value: boolean | null
  onChange: (value: boolean | null) => void
  trueLabel: string
  falseLabel: string
}

/** A boolean field that's left as is (`null`) or set to true/false on every selected media. */
function FlagRadioGroup({
  name,
  label,
  value,
  onChange,
  trueLabel,
  falseLabel
}: FlagRadioGroupProps): JSX.Element {
  const { t } = useTranslation()
  const options: Array<[boolean | null, string]> = [
    [null, t('batchEdit.noChange')],
    [true, trueLabel],
    [false, falseLabel]
  ]
  return (
    <fieldset className="batch-edit-flag">
      <legend className="filter-label">{label}</legend>
      {options.map(([optionValue, optionLabel]) => (
        <label key={String(optionValue)} className="radio-row">
          <input
            type="radio"
            name={name}
            checked={value === optionValue}
            onChange={() => onChange(optionValue)}
          />
          {optionLabel}
        </label>
      ))}
    </fieldset>
  )
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
    ].some((list) => list.length > 0) ||
    selections.sfw !== null ||
    selections.isAiGenerated !== null

  function updateSelection<K extends keyof BatchEditSelections>(key: K, values: string[]): void {
    setSelections((prev) => ({ ...prev, [key]: values }))
  }

  function updateFlag(key: 'sfw' | 'isAiGenerated', value: boolean | null): void {
    setSelections((prev) => ({ ...prev, [key]: value }))
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
          <div className="batch-edit-section batch-edit-flags">
            <FlagRadioGroup
              name="batch-sfw"
              label={t('batchEdit.sfwLabel')}
              value={selections.sfw}
              onChange={(value) => updateFlag('sfw', value)}
              trueLabel={t('batchEdit.sfwMarkSfw')}
              falseLabel={t('batchEdit.sfwMarkNsfw')}
            />
            <FlagRadioGroup
              name="batch-ai"
              label={t('batchEdit.aiLabel')}
              value={selections.isAiGenerated}
              onChange={(value) => updateFlag('isAiGenerated', value)}
              trueLabel={t('batchEdit.aiMarkAi')}
              falseLabel={t('batchEdit.aiMarkNotAi')}
            />
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

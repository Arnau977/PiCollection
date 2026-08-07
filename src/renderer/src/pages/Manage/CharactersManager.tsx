import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { useCharacters, useSeries } from '../../hooks/useEntityLists'
import { useConfirm } from '../../components/ConfirmDialog/ConfirmDialogContext'
import { EntityThumbnail } from '../../components/EntityThumbnail'
import { useEntityThumbnails } from '../../hooks/useEntityThumbnail'
import { MultiSelectAutocomplete } from '../../components/Autocomplete/MultiSelectAutocomplete'
import { filterByQuery } from '../../utils/filterByQuery'
import {
  loadManageSort,
  saveManageSort,
  sortManageEntities,
  type ManageSort
} from '../../utils/manageSort'
import { ManageSortControl } from '../../components/ManageSortControl/ManageSortControl'
import { formatCompactCount } from '../../utils/formatCompactCount'
import type { CharacterModel, SeriesModel } from '@shared/models'

interface CharacterFormValues {
  name: string
  seriesIds: string[]
  aliases: string
}

const EMPTY_FORM: CharacterFormValues = { name: '', seriesIds: [], aliases: '' }

function getSeriesLabel(series: SeriesModel): string {
  return series.name
}

function toCsv(values: string[]): string {
  return values.join(', ')
}

function fromCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export function CharactersManager(): JSX.Element {
  const { t } = useTranslation()
  const { data: characters, loading, refetch } = useCharacters()
  const series = useSeries()
  const confirm = useConfirm()
  const [form, setForm] = useState<CharacterFormValues>(EMPTY_FORM)
  const [editing, setEditing] = useState<CharacterModel | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<ManageSort>(() => loadManageSort('characters'))
  const [seriesFilter, setSeriesFilter] = useState<string>('')

  function updateSort(next: ManageSort): void {
    setSort(next)
    saveManageSort('characters', next)
  }

  const searchedCharacters = filterByQuery(characters, search, (character) =>
    [character.name, ...(character.aliases ?? [])].join(' ')
  )
  const seriesFilteredCharacters = seriesFilter
    ? searchedCharacters.filter((character) => character.series.some((s) => s.id === seriesFilter))
    : searchedCharacters
  const visibleCharacters = sortManageEntities(seriesFilteredCharacters, sort)
  const visibleCharacterIds = useMemo(
    () => visibleCharacters.map((character) => character.id),
    [visibleCharacters]
  )
  const thumbnails = useEntityThumbnails('character', visibleCharacterIds)

  function startEdit(character: CharacterModel): void {
    setEditing(character)
    setForm({
      name: character.name,
      seriesIds: character.series.map((s) => s.id),
      aliases: toCsv(character.aliases ?? [])
    })
  }

  function resetForm(): void {
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const trimmed = form.name.trim()
    if (!trimmed) return
    const input = {
      name: trimmed,
      seriesIds: form.seriesIds,
      aliases: fromCsv(form.aliases)
    }
    const result = editing
      ? await window.api.character.update(editing.id, input)
      : await window.api.character.create(input)
    if (result.success) {
      resetForm()
      setError(null)
      refetch()
    } else {
      setError(result.error.message)
    }
  }

  async function handleDelete(id: string, name: string, mediaCount: number): Promise<void> {
    if (mediaCount > 0) {
      const ok = await confirm({
        message: t('manage.confirmDeleteWithMedia', { name, count: mediaCount }),
        danger: true
      })
      if (!ok) return
    }
    const result = await window.api.character.delete(id)
    if (result.success) {
      if (editing?.id === id) resetForm()
      refetch()
    } else {
      setError(result.error.message)
    }
  }

  return (
    <div className="manage-panel manage-panel-split">
      <div className="manage-form-panel">
        <h2>{editing ? t('manage.editingItem', { name: editing.name }) : t('manage.addNew')}</h2>
        <form className="manage-add-form-stacked" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="character-name">{t('manage.name')}</label>
            <input
              id="character-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <MultiSelectAutocomplete
            name="character-series"
            label={t('manage.series')}
            options={series.data}
            getOptionLabel={getSeriesLabel}
            getOptionValue={(s) => s.id}
            selectedValues={form.seriesIds}
            onChange={(seriesIds) => setForm((prev) => ({ ...prev, seriesIds }))}
          />

          <div className="field">
            <label htmlFor="character-aliases">{t('manage.aliases')}</label>
            <input
              id="character-aliases"
              type="text"
              value={form.aliases}
              onChange={(e) => setForm((prev) => ({ ...prev, aliases: e.target.value }))}
              placeholder={t('manage.aliasesPlaceholder')}
            />
            <span className="field-hint">{t('manage.aliasesHint')}</span>
          </div>

          <div className="manage-edit-actions">
            <button type="submit" className="btn btn-primary" disabled={!form.name.trim()}>
              {editing ? t('manage.save') : t('manage.add')}
            </button>
            {editing && (
              <button type="button" className="btn" onClick={resetForm}>
                {t('manage.cancel')}
              </button>
            )}
          </div>
        </form>

        {error && <p role="alert">{error}</p>}
      </div>

      <div className="manage-list-panel">
        <input
          type="search"
          className="manage-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('manage.searchPlaceholder')}
          aria-label={t('manage.searchLabel')}
        />

        <div className="manage-sort-row">
          <ManageSortControl sort={sort} onChange={updateSort} />
          <label className="filter-field">
            <span className="filter-label">{t('manage.series')}</span>
            <select value={seriesFilter} onChange={(e) => setSeriesFilter(e.target.value)}>
              <option value="">{t('manage.seriesFilterAll')}</option>
              {series.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="manage-list-scroll">
          {loading ? (
            <p className="loading-state">{t('gallery.loading')}</p>
          ) : characters.length === 0 ? (
            <p className="manage-empty">{t('manage.empty')}</p>
          ) : visibleCharacters.length === 0 ? (
            <p className="manage-empty">{t('manage.noResults')}</p>
          ) : (
            <ul className="manage-list">
              {visibleCharacters.map((character) => (
                <li
                  key={character.id}
                  className={
                    editing?.id === character.id
                      ? 'manage-list-item manage-list-item-editing'
                      : 'manage-list-item'
                  }
                >
                  <EntityThumbnail
                    route={thumbnails.get(character.id)?.route ?? null}
                    loading={!thumbnails.has(character.id)}
                  />
                  <div className="manage-item-info">
                    <span className="manage-item-name">{character.name}</span>
                    {character.series.length > 0 && (
                      <span className="manage-item-meta">
                        {character.series.map((s) => s.name).join(', ')}
                      </span>
                    )}
                    {character.aliases && character.aliases.length > 0 && (
                      <span className="manage-item-aliases">{character.aliases.join(', ')}</span>
                    )}
                  </div>
                  <span className="manage-item-count">
                    {formatCompactCount(character.mediaCount ?? 0)}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${t('manage.edit')} ${character.name}`}
                    onClick={() => startEdit(character)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${t('manage.delete')} ${character.name}`}
                    onClick={() =>
                      handleDelete(character.id, character.name, character.mediaCount ?? 0)
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

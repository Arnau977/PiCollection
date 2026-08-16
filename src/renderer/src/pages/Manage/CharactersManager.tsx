import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, Users } from 'lucide-react'
import { useCharacters, useSeries } from '../../hooks/useEntityLists'
import { useConfirm } from '../../components/ConfirmDialog/ConfirmDialogContext'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { EntityThumbnail } from '../../components/EntityThumbnail/EntityThumbnail'
import { useEntityThumbnails } from '../../hooks/useEntityThumbnail'
import { Autocomplete } from '../../components/Autocomplete/Autocomplete'
import { MultiSelectAutocomplete } from '../../components/Autocomplete/MultiSelectAutocomplete'
import { filterByQuery } from '../../utils/filterByQuery'
import { fromCsv, toCsv } from '../../utils/csvList'
import {
  loadManageSort,
  loadManageViewMode,
  saveManageSort,
  saveManageViewMode,
  sortManageEntities,
  type ManageSort,
  type ManageViewMode
} from '../../utils/manageSort'
import { ManageSortControl } from '../../components/ManageSortControl/ManageSortControl'
import {
  buildAncestorAwareEntityTree,
  buildEntityTree,
  computeRolledUpCounts
} from '../../utils/buildEntityTree'
import { formatCompactCount } from '../../utils/formatCompactCount'
import { useDebouncedValue } from '../../utils/useDebouncedValue'
import type { CharacterModel, SeriesModel } from '@shared/models'

interface CharacterFormValues {
  name: string
  seriesIds: string[]
  aliases: string
  parentId: string | undefined
}

const EMPTY_FORM: CharacterFormValues = { name: '', seriesIds: [], aliases: '', parentId: undefined }

function getSeriesLabel(series: SeriesModel): string {
  return series.name
}

function getCharacterLabel(character: CharacterModel): string {
  return character.name
}

export function CharactersManager(): JSX.Element {
  const { t } = useTranslation()
  const { data: characters, loading, refetch } = useCharacters()
  const series = useSeries()
  const confirm = useConfirm()
  const [form, setForm] = useState<CharacterFormValues>(EMPTY_FORM)
  const [editing, setEditing] = useState<CharacterModel | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<ManageSort>(() => loadManageSort('characters'))
  const [seriesFilter, setSeriesFilter] = useState<string>('')

  function updateSort(next: ManageSort): void {
    setSort(next)
    saveManageSort('characters', next)
  }

  const [viewMode, setViewMode] = useState<ManageViewMode>(() => loadManageViewMode('characters'))

  function updateViewMode(next: ManageViewMode): void {
    setViewMode(next)
    saveManageViewMode('characters', next)
  }

  const treeNodes = useMemo(() => {
    const searchedCharacters = filterByQuery(characters, debouncedSearch, (character) =>
      [character.name, ...(character.aliases ?? [])].join(' ')
    )
    const seriesFilteredCharacters = seriesFilter
      ? searchedCharacters.filter((character) =>
          character.series.some((s) => s.id === seriesFilter)
        )
      : searchedCharacters

    if (viewMode === 'flat') {
      return sortManageEntities(seriesFilteredCharacters, sort).map((character) => ({
        entity: character,
        depth: 0,
        rolledUpCount: character.mediaCount ?? 0
      }))
    }

    const rolledUpCounts = computeRolledUpCounts(characters)
    const getCount = (character: CharacterModel): number => rolledUpCounts.get(character.id) ?? 0
    const sortedCharacters = sortManageEntities(seriesFilteredCharacters, sort, getCount)
    const isFiltering = debouncedSearch.trim().length > 0 || seriesFilter.length > 0
    if (!isFiltering) return buildEntityTree(sortManageEntities(characters, sort, getCount))
    return buildAncestorAwareEntityTree(sortedCharacters, sortManageEntities(characters, sort, getCount))
  }, [characters, debouncedSearch, seriesFilter, sort, viewMode])
  const visibleCharacterIds = useMemo(() => treeNodes.map((node) => node.entity.id), [treeNodes])
  const thumbnails = useEntityThumbnails('character', visibleCharacterIds)

  // A character can't be its own parent; the backend also rejects deeper cycles (e.g. parenting
  // to one of its own descendants), so this is a best-effort narrowing rather than the source of
  // truth.
  const parentOptions = characters.filter((c) => c.id !== editing?.id)

  function startEdit(character: CharacterModel): void {
    setEditing(character)
    setForm({
      name: character.name,
      seriesIds: character.series.map((s) => s.id),
      aliases: toCsv(character.aliases ?? []),
      parentId: character.parentId ?? undefined
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
      aliases: fromCsv(form.aliases),
      parentId: form.parentId
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
            <Autocomplete
              name="character-parent"
              label={t('manage.parentCharacter')}
              options={parentOptions}
              getOptionLabel={getCharacterLabel}
              getOptionValue={(c) => c.id}
              selectedKey={form.parentId ?? null}
              onSelect={(c) => setForm((prev) => ({ ...prev, parentId: c?.id }))}
            />
          </div>

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
          <ManageSortControl
            sort={sort}
            onChange={updateSort}
            viewMode={viewMode}
            onViewModeChange={updateViewMode}
          />
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
            <EmptyState icon={<Users />} title={t('manage.empty')} />
          ) : treeNodes.length === 0 ? (
            <EmptyState icon={<Users />} title={t('manage.noResults')} />
          ) : (
            <ul className="manage-list">
              {treeNodes.map(({ entity: character, depth, rolledUpCount }) => (
                <li
                  key={character.id}
                  className={`manage-list-item depth-${depth}${editing?.id === character.id ? ' manage-list-item-editing' : ''}`}
                  style={depth > 0 ? { marginLeft: depth * 20 } : undefined}
                >
                  {depth > 0 && (
                    <span className="manage-item-connector" aria-hidden="true">
                      └
                    </span>
                  )}
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
                  <span className="manage-item-count">{formatCompactCount(rolledUpCount)}</span>
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

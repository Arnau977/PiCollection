import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { useSeries } from '../../hooks/useEntityLists'
import { useConfirm } from '../../components/ConfirmDialog/ConfirmDialogContext'
import { EntityThumbnail } from '../../components/EntityThumbnail'
import { useEntityThumbnails } from '../../hooks/useEntityThumbnail'
import { Autocomplete } from '../../components/Autocomplete/Autocomplete'
import { filterByQuery } from '../../utils/filterByQuery'
import {
  loadManageSort,
  saveManageSort,
  sortManageEntities,
  type ManageSort
} from '../../utils/manageSort'
import { ManageSortControl } from '../../components/ManageSortControl/ManageSortControl'
import { buildAncestorAwareSeriesTree, buildSeriesTree } from '../../utils/buildSeriesTree'
import { formatCompactCount } from '../../utils/formatCompactCount'
import type { SeriesModel } from '@shared/models'

interface SeriesFormValues {
  name: string
  aliases: string
  parentId: string | undefined
}

const EMPTY_FORM: SeriesFormValues = { name: '', aliases: '', parentId: undefined }

function toCsv(values: string[]): string {
  return values.join(', ')
}

function fromCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export function SeriesManager(): JSX.Element {
  const { t } = useTranslation()
  const { data: seriesList, loading, refetch } = useSeries()
  const confirm = useConfirm()
  const [form, setForm] = useState<SeriesFormValues>(EMPTY_FORM)
  const [editing, setEditing] = useState<SeriesModel | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<ManageSort>(() => loadManageSort('series'))

  function updateSort(next: ManageSort): void {
    setSort(next)
    saveManageSort('series', next)
  }

  const isSearching = search.trim().length > 0
  const sortedSeries = sortManageEntities(seriesList, sort)
  const visibleSeries = sortManageEntities(
    filterByQuery(seriesList, search, (series) =>
      [series.name, ...(series.aliases ?? [])].join(' ')
    ),
    sort
  )
  // While searching, still show each match's ancestor chain (pulled from the full sorted list)
  // so the hierarchy reads the same way it does unfiltered - just restricted to matches plus the
  // ancestors needed to place them.
  const treeNodes = isSearching
    ? buildAncestorAwareSeriesTree(visibleSeries, sortedSeries)
    : buildSeriesTree(sortedSeries)
  const visibleSeriesIds = useMemo(() => treeNodes.map((node) => node.series.id), [treeNodes])
  const thumbnails = useEntityThumbnails('series', visibleSeriesIds)

  // A series can't be its own parent; the backend also rejects deeper cycles (e.g. parenting to
  // one of its own descendants), so this is a best-effort narrowing rather than the source of truth.
  const parentOptions = seriesList.filter((s) => s.id !== editing?.id)

  function startEdit(series: SeriesModel): void {
    setEditing(series)
    setForm({
      name: series.name,
      aliases: toCsv(series.aliases ?? []),
      parentId: series.parentId ?? undefined
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
    const input = { name: trimmed, aliases: fromCsv(form.aliases), parentId: form.parentId }
    const result = editing
      ? await window.api.series.update(editing.id, input)
      : await window.api.series.create(input)
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
    const result = await window.api.series.delete(id)
    if (result.success) {
      if (editing?.id === id) resetForm()
      refetch()
    } else {
      setError(result.error.message)
    }
  }

  function renderItem(series: SeriesModel, depth: number, count: number): JSX.Element {
    return (
      <li
        key={series.id}
        className={`manage-list-item depth-${depth}${editing?.id === series.id ? ' manage-list-item-editing' : ''}`}
        style={depth > 0 ? { marginLeft: depth * 20 } : undefined}
      >
        {depth > 0 && (
          <span className="manage-item-connector" aria-hidden="true">
            └
          </span>
        )}
        <EntityThumbnail
          route={thumbnails.get(series.id)?.route ?? null}
          loading={!thumbnails.has(series.id)}
        />
        <div className="manage-item-info">
          <span className="manage-item-name">{series.name}</span>
          {series.aliases && series.aliases.length > 0 && (
            <span className="manage-item-aliases">{series.aliases.join(', ')}</span>
          )}
        </div>
        <span className="manage-item-count">{formatCompactCount(count)}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label={`${t('manage.edit')} ${series.name}`}
          onClick={() => startEdit(series)}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`${t('manage.delete')} ${series.name}`}
          onClick={() => handleDelete(series.id, series.name, series.mediaCount ?? 0)}
        >
          <Trash2 size={16} />
        </button>
      </li>
    )
  }

  return (
    <div className="manage-panel manage-panel-split">
      <div className="manage-form-panel">
        <h2>{editing ? t('manage.editingItem', { name: editing.name }) : t('manage.addNew')}</h2>
        <form className="manage-add-form-stacked" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="series-name">{t('manage.name')}</label>
            <input
              id="series-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="field">
            <label htmlFor="series-aliases">{t('manage.aliases')}</label>
            <input
              id="series-aliases"
              type="text"
              value={form.aliases}
              onChange={(e) => setForm((prev) => ({ ...prev, aliases: e.target.value }))}
              placeholder={t('manage.aliasesPlaceholder')}
            />
            <span className="field-hint">{t('manage.seriesAliasesHint')}</span>
          </div>

          <div className="field">
            <Autocomplete
              name="series-parent"
              label={t('manage.parentSeries')}
              options={parentOptions}
              getOptionLabel={(s) => s.name}
              getOptionValue={(s) => s.id}
              selectedKey={form.parentId ?? null}
              onSelect={(s) => setForm((prev) => ({ ...prev, parentId: s?.id }))}
            />
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
        </div>

        <div className="manage-list-scroll">
          {loading ? (
            <p className="loading-state">{t('gallery.loading')}</p>
          ) : seriesList.length === 0 ? (
            <p className="manage-empty">{t('manage.empty')}</p>
          ) : visibleSeries.length === 0 ? (
            <p className="manage-empty">{t('manage.noResults')}</p>
          ) : (
            <ul className="manage-list">
              {treeNodes.map((node) => renderItem(node.series, node.depth, node.rolledUpCount))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

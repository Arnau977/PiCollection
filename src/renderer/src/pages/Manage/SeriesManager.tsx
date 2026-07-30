import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { useSeries } from '../../hooks/useEntityLists'
import { EntityThumbnail } from '../../components/EntityThumbnail'
import { filterByQuery } from '../../utils/filterByQuery'
import type { SeriesModel } from '@shared/models'

interface SeriesFormValues {
  name: string
  aliases: string
}

const EMPTY_FORM: SeriesFormValues = { name: '', aliases: '' }

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
  const [form, setForm] = useState<SeriesFormValues>(EMPTY_FORM)
  const [editing, setEditing] = useState<SeriesModel | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const visibleSeries = filterByQuery(seriesList, search, (series) => series.name)

  function startEdit(series: SeriesModel): void {
    setEditing(series)
    setForm({ name: series.name, aliases: toCsv(series.aliases ?? []) })
  }

  function resetForm(): void {
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const trimmed = form.name.trim()
    if (!trimmed) return
    const input = { name: trimmed, aliases: fromCsv(form.aliases) }
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

  async function handleDelete(id: string, name: string): Promise<void> {
    if (!window.confirm(t('manage.confirmDelete', { name }))) return
    const result = await window.api.series.delete(id)
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

        {loading ? (
          <p className="loading-state">{t('gallery.loading')}</p>
        ) : seriesList.length === 0 ? (
          <p className="manage-empty">{t('manage.empty')}</p>
        ) : visibleSeries.length === 0 ? (
          <p className="manage-empty">{t('manage.noResults')}</p>
        ) : (
          <ul className="manage-list">
            {visibleSeries.map((series) => (
              <li
                key={series.id}
                className={
                  editing?.id === series.id
                    ? 'manage-list-item manage-list-item-editing'
                    : 'manage-list-item'
                }
              >
                <EntityThumbnail kind="series" id={series.id} />
                <span className="manage-item-name">{series.name}</span>
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
                  onClick={() => handleDelete(series.id, series.name)}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

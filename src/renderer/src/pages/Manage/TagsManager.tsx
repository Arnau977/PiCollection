import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Tags as TagsIcon, Trash2 } from 'lucide-react'
import type { TagModel } from '@shared/models'
import { useTags } from '../../hooks/useEntityLists'
import { useConfirm } from '../../components/ConfirmDialog/ConfirmDialogContext'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import { EntityThumbnail } from '../../components/EntityThumbnail'
import { DanbooruTagAutocomplete } from '../../components/DanbooruTagAutocomplete/DanbooruTagAutocomplete'
import { useEntityThumbnails } from '../../hooks/useEntityThumbnail'
import { filterByQuery } from '../../utils/filterByQuery'
import { fromCsv, toCsv } from '../../utils/csvList'
import {
  loadManageSort,
  saveManageSort,
  sortManageEntities,
  type ManageSort
} from '../../utils/manageSort'
import { ManageSortControl } from '../../components/ManageSortControl/ManageSortControl'
import { formatCompactCount } from '../../utils/formatCompactCount'
import { useDebouncedValue } from '../../utils/useDebouncedValue'

interface TagFormValues {
  name: string
  aliases: string
}

const EMPTY_FORM: TagFormValues = { name: '', aliases: '' }

export function TagsManager(): JSX.Element {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const { data: tags, loading, refetch } = useTags()
  const [form, setForm] = useState<TagFormValues>(EMPTY_FORM)
  const [editing, setEditing] = useState<TagModel | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 200)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<ManageSort>(() => loadManageSort('tags'))

  function updateSort(next: ManageSort): void {
    setSort(next)
    saveManageSort('tags', next)
  }

  const visibleTags = useMemo(
    () =>
      sortManageEntities(
        filterByQuery(tags, debouncedSearch, (tag) => [tag.name, ...(tag.aliases ?? [])].join(' ')),
        sort
      ),
    [tags, debouncedSearch, sort]
  )
  const visibleTagIds = useMemo(() => visibleTags.map((tag) => tag.id), [visibleTags])
  const thumbnails = useEntityThumbnails('tag', visibleTagIds)

  function startEdit(tag: TagModel): void {
    setEditing(tag)
    setForm({ name: tag.name, aliases: toCsv(tag.aliases ?? []) })
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
      ? await window.api.tag.update(editing.id, input)
      : await window.api.tag.create(input)
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
    const result = await window.api.tag.delete(id)
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
            <label htmlFor="tag-name">{t('manage.name')}</label>
            <DanbooruTagAutocomplete
              id="tag-name"
              value={form.name}
              onChange={(name) => setForm((prev) => ({ ...prev, name }))}
            />
          </div>

          <div className="field">
            <label htmlFor="tag-aliases">{t('manage.aliases')}</label>
            <input
              id="tag-aliases"
              type="text"
              value={form.aliases}
              onChange={(e) => setForm((prev) => ({ ...prev, aliases: e.target.value }))}
              placeholder={t('manage.aliasesPlaceholder')}
            />
            <span className="field-hint">{t('manage.tagAliasesHint')}</span>
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
          ) : tags.length === 0 ? (
            <EmptyState icon={<TagsIcon />} title={t('manage.empty')} />
          ) : visibleTags.length === 0 ? (
            <EmptyState icon={<TagsIcon />} title={t('manage.noResults')} />
          ) : (
            <ul className="manage-list">
              {visibleTags.map((tag) => (
                <li
                  key={tag.id}
                  className={
                    editing?.id === tag.id
                      ? 'manage-list-item manage-list-item-editing'
                      : 'manage-list-item'
                  }
                >
                  <EntityThumbnail
                    route={thumbnails.get(tag.id)?.route ?? null}
                    loading={!thumbnails.has(tag.id)}
                  />
                  <div className="manage-item-info">
                    <span className="manage-item-name">{tag.name}</span>
                    {tag.aliases && tag.aliases.length > 0 && (
                      <span className="manage-item-aliases">{tag.aliases.join(', ')}</span>
                    )}
                  </div>
                  <span className="manage-item-count">
                    {formatCompactCount(tag.mediaCount ?? 0)}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${t('manage.edit')} ${tag.name}`}
                    onClick={() => startEdit(tag)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${t('manage.delete')} ${tag.name}`}
                    onClick={() => handleDelete(tag.id, tag.name, tag.mediaCount ?? 0)}
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

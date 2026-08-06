import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import type { TagModel } from '@shared/models'
import { useTags } from '../../hooks/useEntityLists'
import { useConfirm } from '../../components/ConfirmDialog/ConfirmDialogContext'
import { EntityThumbnail } from '../../components/EntityThumbnail'
import { filterByQuery } from '../../utils/filterByQuery'
import {
  loadManageSort,
  saveManageSort,
  sortManageEntities,
  type ManageSort
} from '../../utils/manageSort'
import { ManageSortControl } from '../../components/ManageSortControl/ManageSortControl'
import { formatCompactCount } from '../../utils/formatCompactCount'

export function TagsManager(): JSX.Element {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const { data: tags, loading, refetch } = useTags()
  const [formName, setFormName] = useState('')
  const [editing, setEditing] = useState<TagModel | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<ManageSort>(() => loadManageSort('tags'))

  function updateSort(next: ManageSort): void {
    setSort(next)
    saveManageSort('tags', next)
  }

  const visibleTags = sortManageEntities(
    filterByQuery(tags, search, (tag) => tag.name),
    sort
  )

  function startEdit(tag: TagModel): void {
    setEditing(tag)
    setFormName(tag.name)
  }

  function resetForm(): void {
    setEditing(null)
    setFormName('')
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const trimmed = formName.trim()
    if (!trimmed) return
    const result = editing
      ? await window.api.tag.update(editing.id, { name: trimmed })
      : await window.api.tag.create({ name: trimmed })
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
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder={t('manage.name')}
            aria-label={t('manage.name')}
          />
          <div className="manage-edit-actions">
            <button type="submit" className="btn btn-primary" disabled={!formName.trim()}>
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
            <p className="manage-empty">{t('manage.empty')}</p>
          ) : visibleTags.length === 0 ? (
            <p className="manage-empty">{t('manage.noResults')}</p>
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
                  <EntityThumbnail kind="tag" id={tag.id} />
                  <span className="manage-item-name">{tag.name}</span>
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

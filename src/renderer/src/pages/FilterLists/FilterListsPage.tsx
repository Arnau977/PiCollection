import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowLeft, Bookmark, Images, Pencil, Trash2 } from 'lucide-react'
import { PATH } from '@renderer/app.routes.const'
import type { FilterListModel } from '@shared/models'
import { pruneMissingEntities, type KnownEntityIds } from '@shared/query/pruneMissingEntities'
import { useConfirm } from '../../components/ConfirmDialog/ConfirmDialogContext'
import { EmptyState } from '../../components/EmptyState/EmptyState'
import {
  useArtists,
  useCharacters,
  useFilterLists,
  useSeries,
  useTags
} from '../../hooks/useEntityLists'
import { filterByQuery } from '../../utils/filterByQuery'
import { openGalleryFiltered } from '../../utils/openInGallery'
import { describeList, reachesLostFilter, type DraftNames } from '../Gallery/filterListDraft'
import { useRevealAfterSave } from '../Manage/useRevealAfterSave'
import { FilterListForm } from './FilterListForm'
import '../Gallery/SaveFilterListDialog.css'
import '../Manage/ManagePage.css'
import './FilterListsPage.css'

function idsOf(items: { id: string }[]): Set<string> {
  return new Set(items.map((item) => item.id))
}

function namesById(items: { id: string; name: string }[]): Map<string, string> {
  return new Map(items.map((item) => [item.id, item.name]))
}

/** Where saved filter lists are created, edited and deleted, a step off the gallery. */
export default function FilterListsPage(): JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const filterLists = useFilterLists()
  const artists = useArtists()
  const tags = useTags()
  const characters = useCharacters()
  const series = useSeries()
  const lists = filterLists.data
  const { listRef, reveal } = useRevealAfterSave(lists)

  const [editingId, setEditingId] = useState<string | null>(null)
  // Remounts the form, so a list just created doesn't stay in its fields.
  const [formVersion, setFormVersion] = useState(0)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const editing = lists.find((list) => list.id === editingId) ?? null

  const ready = [artists, tags, characters, series].every(
    (entities) => !entities.loading && !entities.error
  )
  const known = useMemo<KnownEntityIds | null>(
    () =>
      ready
        ? {
            artists: idsOf(artists.data),
            tags: idsOf(tags.data),
            characters: idsOf(characters.data),
            series: idsOf(series.data)
          }
        : null,
    [ready, artists.data, tags.data, characters.data, series.data]
  )
  const names = useMemo<DraftNames>(
    () => ({
      lists: namesById(lists),
      artists: namesById(artists.data),
      tags: namesById(tags.data),
      characters: namesById(characters.data),
      series: namesById(series.data)
    }),
    [lists, artists.data, tags.data, characters.data, series.data]
  )
  const visible = useMemo(() => filterByQuery(lists, search, (list) => list.name), [lists, search])

  function closeForm(): void {
    setEditingId(null)
    setFormVersion((version) => version + 1)
  }

  function summaryOf(list: FilterListModel): string {
    if (!known) return ''
    const filters = pruneMissingEntities(list.filters, known)
    return describeList({ ...list, filters }, names, t)
  }

  async function handleDelete(list: FilterListModel): Promise<void> {
    const ok = await confirm({
      message: t('filterLists.confirmDelete', { name: list.name }),
      danger: true
    })
    if (!ok) return
    const result = await window.api.filterList.delete(list.id)
    if (result.success) {
      setError(null)
      if (editingId === list.id) closeForm()
    } else {
      setError(result.error.message)
    }
  }

  return (
    <div className="page manage-page filter-lists-page">
      <div className="filter-lists-header">
        <button type="button" className="btn" onClick={() => navigate(PATH.GALLERY)}>
          <ArrowLeft size={16} />
          {t('filterLists.backToGallery')}
        </button>
        <h1 className="page-title">{t('filterLists.title')}</h1>
      </div>

      <div className="card manage-content">
        <div className="manage-panel manage-panel-split">
          <FilterListForm
            key={`${editing?.id ?? 'new'}-${formVersion}`}
            list={editing}
            lists={lists}
            known={known}
            onSaved={(id) => {
              closeForm()
              reveal(id)
            }}
            onCancel={closeForm}
          />

          <div className="manage-list-panel">
            <input
              type="search"
              className="manage-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('manage.searchPlaceholder')}
              aria-label={t('manage.searchLabel')}
            />

            {error && (
              <p className="save-list-error" role="alert">
                {error}
              </p>
            )}

            <div className="manage-list-scroll" ref={listRef}>
              {filterLists.loading && lists.length === 0 ? (
                <p className="loading-state">{t('gallery.loading')}</p>
              ) : lists.length === 0 ? (
                <EmptyState
                  icon={<Bookmark />}
                  title={t('filterLists.empty')}
                  hint={t('filterLists.emptyHint')}
                />
              ) : visible.length === 0 ? (
                <EmptyState icon={<Bookmark />} title={t('manage.noResults')} />
              ) : (
                <ul className="manage-list">
                  {visible.map((list) => (
                    <li
                      key={list.id}
                      data-entity-id={list.id}
                      className={
                        editingId === list.id
                          ? 'manage-list-item manage-list-item-editing'
                          : 'manage-list-item'
                      }
                    >
                      <div className="filter-lists-item-text">
                        <span className="manage-item-name">{list.name}</span>
                        {reachesLostFilter(lists, list.id) && (
                          <span className="filter-lists-item-lost">
                            <AlertTriangle size={14} aria-hidden="true" />
                            {list.hasMissingEntities
                              ? t('filterLists.lostFilter')
                              : t('filterLists.lostFilterInside')}
                          </span>
                        )}
                        <span className="filter-lists-item-summary">{summaryOf(list)}</span>
                      </div>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t('filterLists.showInGallery', { name: list.name })}
                        title={t('filterLists.showInGallery', { name: list.name })}
                        onClick={() => openGalleryFiltered({ filterListIds: [list.id] }, navigate)}
                      >
                        <Images size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`${t('manage.edit')} ${list.name}`}
                        onClick={() => setEditingId(list.id)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`${t('manage.delete')} ${list.name}`}
                        onClick={() => handleDelete(list)}
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
      </div>
    </div>
  )
}

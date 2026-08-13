import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { PATH } from '@renderer/app.routes.const'
import type { MediaFilters } from '@shared/models'
import Gallery from '../../components/Gallery'
import { FilterBar } from '../../components/FilterBar/FilterBar'
import { GalleryToolbar } from '../../components/GalleryToolbar/GalleryToolbar'
import { BatchEditDialog, type BatchEditSelections } from './BatchEditDialog'
import { useConfirm } from '../../components/ConfirmDialog/ConfirmDialogContext'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useGalleryDefaults } from '../../hooks/useGalleryDefaults'
import { useGallerySession } from '../../hooks/useGallerySession'
import { hasActiveFilters } from '../../utils/hasActiveFilters'
import type { GalleryDensity } from '../../utils/gallerySettings'
import './GalleryPage.css'

const GalleryPage: React.FC = () => {
  const { t } = useTranslation()
  const { defaults, setDefaults } = useGalleryDefaults()
  // Filters survive navigating away and back; only "Clear filters" or closing
  // the app resets them.
  const { filters, sorting, page, setFilters, setSorting, setPage } = useGallerySession(() => ({
    filters: { sfw: defaults.sfw, type: defaults.type },
    sorting: { prop: defaults.sortProp, desc: defaults.sortDesc },
    page: 0
  }))
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBatchEdit, setShowBatchEdit] = useState(false)
  const [deletingSelected, setDeletingSelected] = useState(false)

  const pageSize = defaults.pageSize
  // Pending media lives only under the dedicated Pending tab - always excluded
  // here regardless of the user's own filters, so clearing filters can't
  // surface it either.
  const effectiveFilters = useMemo(
    () => ({ ...filters, pendingTagging: false, limit: pageSize, offset: page * pageSize }),
    [filters, page, pageSize]
  )
  const { data: media, total, loading, error, refetch } = useMediaQuery(effectiveFilters, sorting)

  // Selected ids may no longer be relevant once the filtered/sorted set changes.
  useEffect(() => {
    setSelectedIds(new Set())
  }, [filters, sorting])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filtersActive = hasActiveFilters(filters)

  function handlePageSizeChange(nextPageSize: number): void {
    setDefaults({ ...defaults, pageSize: nextPageSize })
    setPage(0)
  }

  function handleDensityChange(density: GalleryDensity): void {
    setDefaults({ ...defaults, density })
  }

  function toggleSelect(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllOnPage(): void {
    setSelectedIds((prev) => new Set([...prev, ...media.map((item) => item.id)]))
  }

  function clearSelection(): void {
    setSelectedIds(new Set())
  }

  async function handleDeleteSelected(): Promise<void> {
    const ok = await confirm({
      message: t('gallery.confirmDeleteSelected', { count: selectedIds.size }),
      danger: true
    })
    if (!ok) return
    setDeletingSelected(true)
    await Promise.all([...selectedIds].map((id) => window.api.media.delete(id)))
    clearSelection()
    refetch()
    setDeletingSelected(false)
  }

  async function handleBatchEditApply(selections: BatchEditSelections): Promise<void> {
    await window.api.media.batchUpdateAssociations({
      mediaIds: [...selectedIds],
      ...selections
    })
    setShowBatchEdit(false)
    clearSelection()
    refetch()
  }

  return (
    <div className="page gallery-page">
      <h1 className="page-title">{t('gallery.title')}</h1>

      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        sorting={sorting}
        onSortingChange={setSorting}
      />

      {filtersActive && (
        <div className="gallery-active-filters">
          <span>{t('gallery.filtersActive')}</span>
          <button type="button" className="btn" onClick={() => setFilters({} as MediaFilters)}>
            {t('gallery.clearFilters')}
          </button>
        </div>
      )}

      <div className="gallery-page-actions">
        <button className="btn btn-primary" onClick={() => navigate(PATH.ADD_MEDIA)}>
          <Plus size={16} />
          {t('gallery.addMedia')}
        </button>
      </div>

      <GalleryToolbar
        total={total}
        density={defaults.density}
        onDensityChange={handleDensityChange}
        pageSize={pageSize}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <div className="gallery-scroll-region">
        {error && (
          <p className="gallery-page-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="loading-state">{t('gallery.loading')}</p>
        ) : (
          <Gallery
            media={media}
            blurNsfw={defaults.blurNsfw}
            hideNames={defaults.hideNames}
            density={defaults.density}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="gallery-bulk-bar">
          <span className="gallery-bulk-count">
            {t('gallery.selectedCount', { count: selectedIds.size })}
          </span>
          <button type="button" className="btn" onClick={selectAllOnPage}>
            {t('gallery.selectAllOnPage')}
          </button>
          <button type="button" className="btn" onClick={clearSelection}>
            {t('gallery.clearSelection')}
          </button>
          <button type="button" className="btn" onClick={() => setShowBatchEdit(true)}>
            {t('gallery.editMetadata')}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={deletingSelected}
            onClick={handleDeleteSelected}
          >
            {deletingSelected ? t('media.deleting') : t('gallery.deleteSelected')}
          </button>
        </div>
      )}

      {showBatchEdit && (
        <BatchEditDialog
          count={selectedIds.size}
          onApply={handleBatchEditApply}
          onCancel={() => setShowBatchEdit(false)}
        />
      )}
    </div>
  )
}

export default GalleryPage

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { PATH } from '@renderer/app.routes.const'
import type { MediaFilters } from '@shared/models'
import Gallery from '../../components/Gallery/Gallery'
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
  const location = useLocation()
  const confirm = useConfirm()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBatchEdit, setShowBatchEdit] = useState(false)
  const [deletingSelected, setDeletingSelected] = useState(false)
  // "Back to gallery" passes the media you were viewing (and its position
  // under the gallery's own filters/sorting) so its card can be scrolled
  // back into view (centered) once the grid re-renders, instead of leaving
  // you at the top of whatever page you land on.
  const focusState = location.state as { focusMediaId?: string; focusIndex?: number } | null
  const focusMediaId = focusState?.focusMediaId
  const focusIndex = focusState?.focusIndex
  const hasScrolledToFocusRef = useRef(false)
  const hasJumpedToFocusPageRef = useRef(false)

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

  // The gallery session usually already keeps the same page/filters across
  // the round trip to a media's detail view, so the item is normally already
  // in this page's list - just needs its card scrolled into view. But it may
  // not be (e.g. arriving from Home's differently-filtered/sorted "recent
  // additions" grid instead of the gallery itself): if `focusIndex` (the
  // item's position under the gallery's own filters/sorting) is known and
  // the item isn't on the currently loaded page, jump to the page that
  // contains it and let this effect re-run once that page's data lands.
  // Both steps are guarded by a ref so each only ever fires once per visit,
  // and the router state is cleared once the target is found so paging
  // afterwards, or a refetch, doesn't re-trigger any of this.
  useEffect(() => {
    if (!focusMediaId || loading || hasScrolledToFocusRef.current) return
    const target = document.querySelector(`[data-media-id="${focusMediaId}"]`)
    if (target) {
      hasScrolledToFocusRef.current = true
      target.scrollIntoView({ block: 'center' })
      navigate(location.pathname, { replace: true, state: null })
      return
    }
    if (focusIndex != null && !hasJumpedToFocusPageRef.current) {
      hasJumpedToFocusPageRef.current = true
      setPage(Math.floor(focusIndex / pageSize))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the loaded media set changes
  }, [focusMediaId, focusIndex, loading, media, pageSize])

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
      <div className="gallery-page-header">
        <h1 className="page-title">{t('gallery.title')}</h1>
        <button className="btn btn-primary" onClick={() => navigate(PATH.ADD_MEDIA)}>
          <Plus size={16} />
          {t('gallery.addMedia')}
        </button>
      </div>

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

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { PATH } from '@renderer/app.routes.const'
import type { MediaFilters } from '@shared/models'
import Gallery from '../../components/Gallery'
import { FilterBar } from '../../components/FilterBar/FilterBar'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useGalleryDefaults } from '../../hooks/useGalleryDefaults'
import { useGallerySession } from '../../hooks/useGallerySession'
import { hasActiveFilters } from '../../utils/hasActiveFilters'
import './GalleryPage.css'

const PAGE_SIZE = 60

const GalleryPage: React.FC = () => {
  const { t } = useTranslation()
  const { defaults } = useGalleryDefaults()
  // Filters survive navigating away and back; only "Clear filters" or closing
  // the app resets them.
  const { filters, sorting, page, setFilters, setSorting, setPage } = useGallerySession(() => ({
    filters: { sfw: defaults.sfw, type: defaults.type },
    sorting: { prop: defaults.sortProp, desc: defaults.sortDesc },
    page: 0
  }))
  const navigate = useNavigate()

  const effectiveFilters = useMemo(
    () => ({ ...filters, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    [filters, page]
  )
  const { data: media, total, loading, error } = useMediaQuery(effectiveFilters, sorting)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtersActive = hasActiveFilters(filters)

  return (
    <div className="page">
      <div className="gallery-page-header">
        <h1>{t('gallery.title')}</h1>
        <span className="gallery-count">{t('gallery.mediaCount', { count: total })}</span>
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

      <div className="gallery-page-actions">
        <button className="btn btn-primary" onClick={() => navigate(PATH.ADD_MEDIA)}>
          <Plus size={16} />
          {t('gallery.addMedia')}
        </button>
      </div>

      {error && (
        <p className="gallery-page-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="loading-state">{t('gallery.loading')}</p>
      ) : (
        <Gallery media={media} blurNsfw={defaults.blurNsfw} hideNames={defaults.hideNames} />
      )}
      {!loading && total > 0 && (
        <div className="pagination">
          <button
            type="button"
            className="btn"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            {t('gallery.pagination.previous')}
          </button>
          <span>{t('gallery.pagination.page', { page: page + 1, total: totalPages })}</span>
          <button
            type="button"
            className="btn"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            {t('gallery.pagination.next')}
          </button>
        </div>
      )}
    </div>
  )
}

export default GalleryPage

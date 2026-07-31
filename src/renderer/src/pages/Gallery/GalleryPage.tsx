import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { PATH } from '@renderer/app.routes.const'
import type { MediaFilters } from '@shared/models'
import Gallery from '../../components/Gallery'
import { FilterBar } from '../../components/FilterBar/FilterBar'
import { GalleryToolbar } from '../../components/GalleryToolbar/GalleryToolbar'
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

  const pageSize = defaults.pageSize
  const effectiveFilters = useMemo(
    () => ({ ...filters, limit: pageSize, offset: page * pageSize }),
    [filters, page, pageSize]
  )
  const { data: media, total, loading, error } = useMediaQuery(effectiveFilters, sorting)

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const filtersActive = hasActiveFilters(filters)

  function handlePageSizeChange(nextPageSize: number): void {
    setDefaults({ ...defaults, pageSize: nextPageSize })
    setPage(0)
  }

  function handleDensityChange(density: GalleryDensity): void {
    setDefaults({ ...defaults, density })
  }

  return (
    <div className="page gallery-page">
      <h1 className="gradient-title">{t('gallery.title')}</h1>

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
          />
        )}
      </div>
    </div>
  )
}

export default GalleryPage

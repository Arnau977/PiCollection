import { useTranslation } from 'react-i18next'
import { Grid2x2, Grid3x3, LayoutGrid } from 'lucide-react'
import type { GalleryDensity } from '../../utils/gallerySettings'
import { Pagination } from '../Pagination/Pagination'
import './GalleryToolbar.css'

const PAGE_SIZE_OPTIONS = [24, 60, 120, 240] as const

const DENSITY_OPTIONS: { value: GalleryDensity; Icon: typeof Grid3x3 }[] = [
  { value: 'compact', Icon: Grid3x3 },
  { value: 'comfortable', Icon: Grid2x2 },
  { value: 'large', Icon: LayoutGrid }
]

interface GalleryToolbarProps {
  total: number
  density: GalleryDensity
  onDensityChange: (density: GalleryDensity) => void
  pageSize: number
  onPageSizeChange: (pageSize: number) => void
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function GalleryToolbar({
  total,
  density,
  onDensityChange,
  pageSize,
  onPageSizeChange,
  page,
  totalPages,
  onPageChange
}: GalleryToolbarProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="gallery-toolbar">
      <span className="gallery-toolbar-count">{t('gallery.mediaCount', { count: total })}</span>

      <div className="gallery-density-group" role="group" aria-label={t('gallery.density.label')}>
        {DENSITY_OPTIONS.map(({ value, Icon }) => (
          <button
            key={value}
            type="button"
            className={value === density ? 'gallery-density-btn active' : 'gallery-density-btn'}
            aria-pressed={value === density}
            aria-label={t(`gallery.density.${value}`)}
            title={t(`gallery.density.${value}`)}
            onClick={() => onDensityChange(value)}
          >
            <Icon size={16} aria-hidden="true" />
          </button>
        ))}
      </div>

      <label className="gallery-page-size">
        <span>{t('gallery.pageSize.label')}</span>
        <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      {total > 0 && <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />}
    </div>
  )
}

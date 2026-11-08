import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { MediaFilters } from '@shared/models'
import { FilterEntityFields } from '../../components/FilterBar/FilterEntityFields'
import { FILTER_PANEL_ID } from './useFilterPanelOpen'

interface GalleryFilterPanelProps {
  filters: MediaFilters
  onFiltersChange: (filters: MediaFilters) => void
  open: boolean
  /** What's acting on the gallery (the active filters, or the list being edited). */
  header: ReactNode
}

/**
 * The entity filters stacked in a column left of the gallery, so their chips
 * take height there instead of pushing the grid down. It scrolls as a whole.
 * Hidden, it stays mounted so it can slide shut; aria-hidden plus the CSS
 * `visibility` at the end of the slide take it out of reach.
 */
export function GalleryFilterPanel({
  filters,
  onFiltersChange,
  open,
  header
}: GalleryFilterPanelProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <aside
      id={FILTER_PANEL_ID}
      className={open ? 'gallery-filter-panel' : 'gallery-filter-panel is-closed'}
      aria-label={t('filters.panel')}
      aria-hidden={open ? undefined : true}
    >
      <div className="gallery-filter-panel-inner card">
        {open && header}
        <div className="gallery-filter-panel-fields">
          <FilterEntityFields filters={filters} onFiltersChange={onFiltersChange} />
        </div>
      </div>
    </aside>
  )
}

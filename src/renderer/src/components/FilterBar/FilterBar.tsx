import { useTranslation } from 'react-i18next'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { MediaFilters, MediaSortableProp, Sorting } from '@shared/models'
import {
  useArtists,
  useCharacters,
  useFilterLists,
  useSeries,
  useTags
} from '../../hooks/useEntityLists'
import { listsSafeToInclude } from '../../pages/Gallery/filterListDraft'
import { SearchBar } from '../SearchBar/SearchBar'
import { TypeFilter } from './FilterSelects'
import { MoreFiltersPopover } from './MoreFiltersPopover'
import './FilterBar.css'

interface FilterBarProps {
  filters: MediaFilters
  onFiltersChange: (filters: MediaFilters) => void
  sorting?: Sorting
  onSortingChange: (sorting: Sorting) => void
  /** The list open for editing: it can't be offered as a list to apply. */
  editingListId?: string
  /** Shows or hides the side panel holding the entity filters (FilterEntityFields). */
  panelToggle?: { open: boolean; controls: string; onToggle: () => void }
}

export function FilterBar({
  filters,
  onFiltersChange,
  sorting,
  onSortingChange,
  editingListId,
  panelToggle
}: FilterBarProps): JSX.Element {
  const { t } = useTranslation()
  const { data: artists } = useArtists()
  const panelLabel = panelToggle?.open ? t('filters.hidePanel') : t('filters.showPanel')
  const { data: tags } = useTags()
  const { data: characters } = useCharacters()
  const { data: series } = useSeries()
  const { data: filterLists } = useFilterLists()

  return (
    <div className="filter-bar card">
      {panelToggle && (
        <div className="filter-field filter-panel-toggle">
          <span className="filter-label">&nbsp;</span>
          <button
            type="button"
            className="btn filter-panel-toggle-btn"
            aria-expanded={panelToggle.open}
            aria-controls={panelToggle.controls}
            title={panelLabel}
            onClick={panelToggle.onToggle}
          >
            {panelToggle.open ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            {t('filters.panel')}
          </button>
        </div>
      )}

      <div className="filter-bar-search">
        <SearchBar
          filters={filters}
          onFiltersChange={onFiltersChange}
          artists={artists}
          tags={tags}
          characters={characters}
          series={series}
          filterLists={listsSafeToInclude(filterLists, editingListId ?? null)}
        />
      </div>

      <TypeFilter filters={filters} onFiltersChange={onFiltersChange} />

      <label className="filter-field">
        <span className="filter-label">{t('filters.sortBy')}</span>
        <select
          value={sorting?.prop ?? 'createdAt'}
          onChange={(e) =>
            onSortingChange({ prop: e.target.value as MediaSortableProp, desc: sorting?.desc })
          }
        >
          <option value="createdAt">{t('filters.sortDate')}</option>
          <option value="name">{t('filters.sortName')}</option>
          <option value="fileSize">{t('filters.sortSize')}</option>
        </select>
      </label>

      <div className="filter-field filter-sort-direction">
        <span className="filter-label">&nbsp;</span>
        <button
          type="button"
          className="btn"
          onClick={() => onSortingChange({ prop: sorting?.prop, desc: !sorting?.desc })}
        >
          {sorting?.desc ? t('filters.descending') : t('filters.ascending')}
        </button>
      </div>

      <div className="filter-field filter-more">
        <span className="filter-label">&nbsp;</span>
        <MoreFiltersPopover filters={filters} onFiltersChange={onFiltersChange} />
      </div>
    </div>
  )
}

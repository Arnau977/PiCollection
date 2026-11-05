import { useTranslation } from 'react-i18next'
import type { MediaFilters, MediaSortableProp, Sorting } from '@shared/models'
import {
  useArtists,
  useCharacters,
  useFilterLists,
  useSeries,
  useTags
} from '../../hooks/useEntityLists'
import { SearchBar } from '../SearchBar/SearchBar'
import { FilterEntityFields } from './FilterEntityFields'
import { TypeFilter } from './FilterSelects'
import { MoreFiltersPopover } from './MoreFiltersPopover'
import './FilterBar.css'

interface FilterBarProps {
  filters: MediaFilters
  onFiltersChange: (filters: MediaFilters) => void
  sorting?: Sorting
  onSortingChange: (sorting: Sorting) => void
}

export function FilterBar({
  filters,
  onFiltersChange,
  sorting,
  onSortingChange
}: FilterBarProps): JSX.Element {
  const { t } = useTranslation()
  const { data: artists } = useArtists()
  const { data: tags } = useTags()
  const { data: characters } = useCharacters()
  const { data: series } = useSeries()
  const { data: filterLists } = useFilterLists()

  return (
    <div className="filter-bar card">
      <SearchBar
        filters={filters}
        onFiltersChange={onFiltersChange}
        artists={artists}
        tags={tags}
        characters={characters}
        series={series}
        filterLists={filterLists}
      />

      <div className="filter-bar-row">
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

      {/* Tag/character/series/artist search is the actual point of a
          booru-style library - always visible, not a step behind a toggle. */}
      <div className="filter-bar-row filter-bar-core">
        <FilterEntityFields filters={filters} onFiltersChange={onFiltersChange} />
      </div>
    </div>
  )
}

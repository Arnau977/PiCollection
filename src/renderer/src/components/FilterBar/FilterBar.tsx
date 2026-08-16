import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import type { ArtistModel, MediaFilters, MediaSortableProp, SeriesModel, Sorting, TagModel } from '@shared/models'
import { useArtists, useCharacters, useSeries, useTags } from '../../hooks/useEntityLists'
import { formatCharacterOptionLabel } from '../../utils/matchEntityNames'
import { Autocomplete } from '../Autocomplete/Autocomplete'
import { SearchBar } from '../SearchBar/SearchBar'
import { GroupedEntityFilter } from './GroupedEntityFilter'
import './FilterBar.css'

interface FilterBarProps {
  filters: MediaFilters
  onFiltersChange: (filters: MediaFilters) => void
  sorting?: Sorting
  onSortingChange: (sorting: Sorting) => void
}

function hasNonEmptyGroup(groups: string[][] | undefined): boolean {
  return Boolean(groups?.some((group) => group.length > 0))
}

/** Drops the field entirely once every group is empty, keeping filters objects tidy. */
function normalizeGroups(groups: string[][]): string[][] | undefined {
  return hasNonEmptyGroup(groups) ? groups : undefined
}

function getArtistLabel(artist: ArtistModel): string {
  return artist.name
}

function getTagLabel(tag: TagModel): string {
  return tag.name
}

function getSeriesLabel(series: SeriesModel): string {
  return series.name
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

  const advancedActiveCount = [
    filters.artistId ? 1 : 0,
    hasNonEmptyGroup(filters.tagGroups) ? 1 : 0,
    hasNonEmptyGroup(filters.characterGroups) ? 1 : 0,
    filters.noCharacter ? 1 : 0,
    hasNonEmptyGroup(filters.seriesGroups) ? 1 : 0,
    filters.noSeries ? 1 : 0
  ].reduce((a, b) => a + b, 0)

  const [showAdvanced, setShowAdvanced] = useState(advancedActiveCount > 0)

  return (
    <div className="filter-bar card">
      <SearchBar
        filters={filters}
        onFiltersChange={onFiltersChange}
        artists={artists}
        tags={tags}
        characters={characters}
        series={series}
      />

      <div className="filter-bar-row">
        <label className="filter-field">
          <span className="filter-label">{t('filters.sfw')}</span>
          <select
            value={filters.sfw === undefined ? 'all' : filters.sfw ? 'sfw' : 'nsfw'}
            onChange={(e) => {
              const selected = e.target.value
              onFiltersChange({
                ...filters,
                sfw: selected === 'all' ? undefined : selected === 'sfw'
              })
            }}
          >
            <option value="all">{t('filters.sfwAll')}</option>
            <option value="sfw">{t('filters.sfwOnly')}</option>
            <option value="nsfw">{t('filters.nsfwOnly')}</option>
          </select>
        </label>

        <label className="filter-field">
          <span className="filter-label">{t('filters.ai')}</span>
          <select
            value={filters.isAiGenerated === undefined ? 'all' : filters.isAiGenerated ? 'ai' : 'notAi'}
            onChange={(e) => {
              const selected = e.target.value
              onFiltersChange({
                ...filters,
                isAiGenerated: selected === 'all' ? undefined : selected === 'ai'
              })
            }}
          >
            <option value="all">{t('filters.aiAll')}</option>
            <option value="ai">{t('filters.aiOnly')}</option>
            <option value="notAi">{t('filters.aiExcluded')}</option>
          </select>
        </label>

        <label className="filter-field">
          <span className="filter-label">{t('filters.type')}</span>
          <select
            value={filters.type ?? 'all'}
            onChange={(e) => {
              const selected = e.target.value
              onFiltersChange({
                ...filters,
                type: selected === 'all' ? undefined : (selected as MediaFilters['type'])
              })
            }}
          >
            <option value="all">{t('filters.typeAll')}</option>
            <option value="image">{t('filters.typeImage')}</option>
            <option value="video">{t('filters.typeVideo')}</option>
            <option value="gif">{t('filters.typeGif')}</option>
          </select>
        </label>

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
      </div>

      <button
        type="button"
        className="filter-advanced-toggle"
        aria-expanded={showAdvanced}
        onClick={() => setShowAdvanced((v) => !v)}
      >
        <ChevronDown size={16} className={showAdvanced ? 'chevron-open' : ''} />
        {t('filters.advanced')}
        {advancedActiveCount > 0 && (
          <span className="filter-advanced-badge">{advancedActiveCount}</span>
        )}
      </button>

      {showAdvanced && (
        <div className="filter-bar-row filter-bar-advanced">
          <div className="filter-field">
            <Autocomplete
              name="artist-filter"
              label={t('filters.artist')}
              options={artists}
              getOptionLabel={getArtistLabel}
              getOptionValue={(artist) => artist.id}
              selectedKey={filters.artistId ?? null}
              onSelect={(artist) => onFiltersChange({ ...filters, artistId: artist?.id })}
            />
          </div>

          <GroupedEntityFilter
            label={t('filters.tags')}
            groups={filters.tagGroups ?? []}
            onChange={(tagGroups) =>
              onFiltersChange({ ...filters, tagGroups: normalizeGroups(tagGroups) })
            }
            options={tags}
            getOptionLabel={getTagLabel}
            getOptionValue={(tag) => tag.id}
          />

          <GroupedEntityFilter
            label={t('filters.characters')}
            groups={filters.characterGroups ?? []}
            onChange={(characterGroups) =>
              onFiltersChange({ ...filters, characterGroups: normalizeGroups(characterGroups) })
            }
            options={characters}
            getOptionLabel={formatCharacterOptionLabel}
            getOptionValue={(character) => character.id}
            noneOption={{
              checked: filters.noCharacter ?? false,
              onChange: (checked) =>
                onFiltersChange({
                  ...filters,
                  noCharacter: checked || undefined,
                  characterGroups: checked ? undefined : filters.characterGroups
                }),
              label: t('filters.noCharacter')
            }}
          />

          <GroupedEntityFilter
            label={t('manage.series')}
            groups={filters.seriesGroups ?? []}
            onChange={(seriesGroups) =>
              onFiltersChange({ ...filters, seriesGroups: normalizeGroups(seriesGroups) })
            }
            options={series}
            getOptionLabel={getSeriesLabel}
            getOptionValue={(s) => s.id}
            noneOption={{
              checked: filters.noSeries ?? false,
              onChange: (checked) =>
                onFiltersChange({
                  ...filters,
                  noSeries: checked || undefined,
                  seriesGroups: checked ? undefined : filters.seriesGroups
                }),
              label: t('filters.noSeries')
            }}
          />
        </div>
      )}
    </div>
  )
}

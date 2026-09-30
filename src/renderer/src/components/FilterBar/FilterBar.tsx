import { useTranslation } from 'react-i18next'
import type { ArtistModel, MediaFilters, MediaSortableProp, SeriesModel, Sorting, TagModel } from '@shared/models'
import { useArtists, useCharacters, useSeries, useTags } from '../../hooks/useEntityLists'
import { groupEntityIds } from '@shared/query/groupEntry'
import { formatCharacterOptionLabel } from '../../utils/matchEntityNames'
import { Autocomplete } from '../Autocomplete/Autocomplete'
import { SearchBar } from '../SearchBar/SearchBar'
import { GroupedEntityFilter } from './GroupedEntityFilter'
import { MoreFiltersPopover } from './MoreFiltersPopover'
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

/** Exact ids only make sense for entities still selected in some group. */
function keepExact(
  exact: string[] | undefined,
  groups: string[][] | undefined
): string[] | undefined {
  const selected = new Set(groupEntityIds(groups))
  const kept = (exact ?? []).filter((id) => selected.has(id))
  return kept.length > 0 ? kept : undefined
}

function toggleExact(exact: string[] | undefined, id: string): string[] | undefined {
  const next = exact?.includes(id) ? exact.filter((other) => other !== id) : [...(exact ?? []), id]
  return next.length > 0 ? next : undefined
}

/** Ids that some other entity names as its parent - only those have forms/subseries to leave out. */
function parentIds(entities: { parentId?: string | null }[]): Set<string> {
  return new Set(entities.flatMap((entity) => (entity.parentId ? [entity.parentId] : [])))
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
  const characterParents = parentIds(characters)
  const seriesParents = parentIds(series)

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

        <div className="filter-field filter-more">
          <span className="filter-label">&nbsp;</span>
          <MoreFiltersPopover filters={filters} onFiltersChange={onFiltersChange} />
        </div>
      </div>

      {/* Tag/character/series/artist search is the actual point of a
          booru-style library - always visible, not a step behind a toggle. */}
      <div className="filter-bar-row filter-bar-core">
        <div className="filter-field field-accent field-accent-artist">
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

        <div className="field-accent field-accent-tags">
          <GroupedEntityFilter
            label={t('filters.tags')}
            groups={filters.tagGroups ?? []}
            onChange={(tagGroups) =>
              onFiltersChange({ ...filters, tagGroups: normalizeGroups(tagGroups) })
            }
            allowExclusion
            options={tags}
            getOptionLabel={getTagLabel}
            getOptionValue={(tag) => tag.id}
          />
        </div>

        <div className="field-accent field-accent-characters">
          <GroupedEntityFilter
            label={t('filters.characters')}
            groups={filters.characterGroups ?? []}
            onChange={(characterGroups) =>
              onFiltersChange({
                ...filters,
                characterGroups: normalizeGroups(characterGroups),
                exactCharacterIds: keepExact(filters.exactCharacterIds, characterGroups)
              })
            }
            chipToggle={{
              isAvailable: (id) => characterParents.has(id),
              isOn: (id) => filters.exactCharacterIds?.includes(id) ?? false,
              onToggle: (id) =>
                onFiltersChange({
                  ...filters,
                  exactCharacterIds: toggleExact(filters.exactCharacterIds, id)
                }),
              label: t('filters.exactCharacter')
            }}
            allowExclusion
            options={characters}
            getOptionLabel={formatCharacterOptionLabel}
            getOptionValue={(character) => character.id}
            noneOption={{
              checked: filters.noCharacter ?? false,
              onChange: (checked) =>
                onFiltersChange({
                  ...filters,
                  noCharacter: checked || undefined,
                  characterGroups: checked ? undefined : filters.characterGroups,
                  exactCharacterIds: checked ? undefined : filters.exactCharacterIds
                }),
              label: t('filters.noCharacter')
            }}
          />
        </div>

        <div className="field-accent field-accent-series">
          <GroupedEntityFilter
            label={t('manage.series')}
            groups={filters.seriesGroups ?? []}
            onChange={(seriesGroups) =>
              onFiltersChange({
                ...filters,
                seriesGroups: normalizeGroups(seriesGroups),
                exactSeriesIds: keepExact(filters.exactSeriesIds, seriesGroups)
              })
            }
            chipToggle={{
              isAvailable: (id) => seriesParents.has(id),
              isOn: (id) => filters.exactSeriesIds?.includes(id) ?? false,
              onToggle: (id) =>
                onFiltersChange({
                  ...filters,
                  exactSeriesIds: toggleExact(filters.exactSeriesIds, id)
                }),
              label: t('filters.exactSeries')
            }}
            allowExclusion
            options={series}
            getOptionLabel={getSeriesLabel}
            getOptionValue={(s) => s.id}
            noneOption={{
              checked: filters.noSeries ?? false,
              onChange: (checked) =>
                onFiltersChange({
                  ...filters,
                  noSeries: checked || undefined,
                  seriesGroups: checked ? undefined : filters.seriesGroups,
                  exactSeriesIds: checked ? undefined : filters.exactSeriesIds
                }),
              label: t('filters.noSeries')
            }}
          />
        </div>
      </div>
    </div>
  )
}

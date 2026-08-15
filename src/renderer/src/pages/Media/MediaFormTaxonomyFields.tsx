import { useTranslation } from 'react-i18next'
import type { CharacterModel, SeriesModel, TagModel } from '@shared/models'
import { MultiSelectAutocomplete } from '../../components/Autocomplete/MultiSelectAutocomplete'
import { formatCharacterOptionLabel } from '../../utils/matchEntityNames'

interface MediaFormTaxonomyFieldsProps {
  tagOptions: TagModel[]
  pendingTags: TagModel[]
  selectedTagIds: string[]
  onTagsChange: (tagIds: string[]) => void
  onCreateTag: (name: string) => void

  characterOptions: CharacterModel[]
  pendingCharacters: CharacterModel[]
  selectedCharacterIds: string[]
  onCharactersChange: (characterIds: string[]) => void
  onCreateCharacter: (name: string, seriesIds?: string[]) => void

  seriesOptions: SeriesModel[]
  pendingSeries: SeriesModel[]
  selectedSeriesIds: string[]
  onSeriesChange: (seriesIds: string[]) => void
  onCreateSeries: (name: string) => string
}

export function MediaFormTaxonomyFields({
  tagOptions,
  pendingTags,
  selectedTagIds,
  onTagsChange,
  onCreateTag,
  characterOptions,
  pendingCharacters,
  selectedCharacterIds,
  onCharactersChange,
  onCreateCharacter,
  seriesOptions,
  pendingSeries,
  selectedSeriesIds,
  onSeriesChange,
  onCreateSeries
}: MediaFormTaxonomyFieldsProps): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="media-form-group">
      <h2>{t('addMedia.groupTaxonomy')}</h2>
      <div className="media-form-field-accent media-form-field-accent-tags">
        <MultiSelectAutocomplete
          name="tags"
          label={t('filters.tags')}
          options={tagOptions}
          getOptionLabel={(tag) =>
            pendingTags.some((p) => p.id === tag.id)
              ? t('autocomplete.pendingLabel', { name: tag.name })
              : tag.name
          }
          getOptionMatchName={(tag) => tag.name}
          getOptionValue={(tag) => tag.id}
          selectedValues={selectedTagIds}
          onChange={onTagsChange}
          onCreate={onCreateTag}
        />
      </div>
      <div className="media-form-field-accent media-form-field-accent-characters">
        <MultiSelectAutocomplete
          name="characters"
          label={t('filters.characters')}
          options={characterOptions}
          getOptionLabel={(character) =>
            pendingCharacters.some((p) => p.id === character.id)
              ? t('autocomplete.pendingLabel', { name: formatCharacterOptionLabel(character) })
              : formatCharacterOptionLabel(character)
          }
          getOptionMatchName={(character) => character.name}
          getOptionValue={(character) => character.id}
          selectedValues={selectedCharacterIds}
          onChange={onCharactersChange}
          onCreate={onCreateCharacter}
        />
      </div>
      <div className="media-form-field-accent media-form-field-accent-series">
        <MultiSelectAutocomplete
          name="series"
          label={t('manage.series')}
          options={seriesOptions}
          getOptionLabel={(s) =>
            pendingSeries.some((p) => p.id === s.id)
              ? t('autocomplete.pendingLabel', { name: s.name })
              : s.name
          }
          getOptionMatchName={(s) => s.name}
          getOptionValue={(s) => s.id}
          selectedValues={selectedSeriesIds}
          onChange={onSeriesChange}
          onCreate={onCreateSeries}
        />
      </div>
    </div>
  )
}

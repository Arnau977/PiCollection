import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CharacterModel, SeriesModel, TagModel } from '@shared/models'
import { MultiSelectAutocomplete } from '../../../components/Autocomplete/MultiSelectAutocomplete'
import { TagFinder } from '../../../components/TagFinder/TagFinder'
import { useTagFinder } from '../../../hooks/useTagFinder'
import { formatCharacterOptionLabel } from '../../../utils/matchEntityNames'
import type { MediaFormField } from './mediaFormError'
import { TagChip } from '../../../components/Media/TagChip'
import { autoTagProperties, useAutoTags } from '../../../hooks/useAutoTags'
import { CharacterParentBar } from './CharacterParentBar'
import type { CharacterParentLinks } from './useCharacterParentLinks'

interface MediaFormTaxonomyFieldsProps {
  /** The field a failed save pointed at (see MediaFormSaveError). */
  invalidField?: MediaFormField
  tagOptions: TagModel[]
  pendingTags: TagModel[]
  selectedTagIds: string[]
  onTagsChange: (tagIds: string[]) => void
  onCreateTag: (name: string) => void
  /** Tags the media has through automatic rules - shown, not editable here. */
  autoTags?: TagModel[]

  characterOptions: CharacterModel[]
  pendingCharacters: CharacterModel[]
  selectedCharacterIds: string[]
  onCharactersChange: (characterIds: string[]) => void
  onCreateCharacter: (name: string, seriesIds?: string[]) => void
  /** "Form of" links set from the form (useCharacterParentLinks). */
  characterLinks?: Pick<CharacterParentLinks, 'parentOf' | 'setParent' | 'excludedParents'>

  seriesOptions: SeriesModel[]
  pendingSeries: SeriesModel[]
  selectedSeriesIds: string[]
  onSeriesChange: (seriesIds: string[]) => void
  onCreateSeries: (name: string) => string
}

export function MediaFormTaxonomyFields({
  invalidField,
  tagOptions,
  pendingTags,
  selectedTagIds,
  onTagsChange,
  onCreateTag,
  autoTags = [],
  characterOptions,
  pendingCharacters,
  selectedCharacterIds,
  onCharactersChange,
  onCreateCharacter,
  characterLinks,
  seriesOptions,
  pendingSeries,
  selectedSeriesIds,
  onSeriesChange,
  onCreateSeries
}: MediaFormTaxonomyFieldsProps): JSX.Element {
  const { t } = useTranslation()
  const tagFinder = useTagFinder()
  const selectedTags = tagOptions.filter((tag) => selectedTagIds.includes(tag.id))
  // One picked by hand as well is just a normal tag now.
  const shownAutoTags = autoTags.filter((tag) => !selectedTagIds.includes(tag.id))
  const { status: autoTagStatus } = useAutoTags({ enabled: shownAutoTags.length > 0 })
  // The chip whose "form of" bar is open; its button gets focus back on close.
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const linkOpener = useRef<HTMLElement | null>(null)
  const charactersById = new Map(characterOptions.map((character) => [character.id, character]))
  const linking =
    linkingId && selectedCharacterIds.includes(linkingId)
      ? charactersById.get(linkingId)
      : undefined

  function closeLinking(): void {
    setLinkingId(null)
    linkOpener.current?.focus()
  }

  return (
    <div className="media-form-group">
      <h2>{t('addMedia.groupTaxonomy')}</h2>
      <div className="field-accent field-accent-tags" data-form-field="tags">
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
          invalid={invalidField === 'tags'}
          chipFilter={tagFinder.matches}
          chipsHeader={
            <TagFinder
              finder={tagFinder}
              matchCount={selectedTags.filter(tagFinder.matches).length}
              total={selectedTags.length}
            />
          }
        />
        {shownAutoTags.length > 0 && (
          <div className="media-form-auto-tags">
            <span className="media-form-auto-tags-label">{t('autoTags.formLabel')}</span>
            <ul className="chip-list chip-list-tags">
              {shownAutoTags.map((tag) => (
                <TagChip
                  key={tag.id}
                  name={tag.name}
                  autoProperties={autoTagProperties(autoTagStatus, tag.id)}
                />
              ))}
            </ul>
            <span className="media-form-auto-tags-hint">{t('autoTags.formHint')}</span>
          </div>
        )}
      </div>
      <div className="field-accent field-accent-characters" data-form-field="characters">
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
          invalid={invalidField === 'characters'}
          chipHint={(character) => {
            const parentId = characterLinks?.parentOf(character.id)
            const parent = parentId ? charactersById.get(parentId) : undefined
            return parent ? (
              <span className="chip-hint">{t('suggestions.formOf', { parent: parent.name })}</span>
            ) : null
          }}
          chipAction={
            characterLinks && {
              label: t('characterParent.action'),
              isActive: (id) => id === linking?.id,
              onClick: (id): void => {
                linkOpener.current = document.activeElement as HTMLElement | null
                setLinkingId((prev) => (prev === id ? null : id))
              }
            }
          }
          chipsHeader={
            characterLinks &&
            linking && (
              <CharacterParentBar
                childName={linking.name}
                parentId={characterLinks.parentOf(linking.id)}
                options={characterOptions.filter(
                  (character) => !characterLinks.excludedParents(linking.id).has(character.id)
                )}
                getOptionLabel={formatCharacterOptionLabel}
                onPick={(parentId) => {
                  characterLinks.setParent(linking.id, parentId)
                  closeLinking()
                }}
                onClose={closeLinking}
              />
            )
          }
        />
      </div>
      <div className="field-accent field-accent-series" data-form-field="series">
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
          invalid={invalidField === 'series'}
        />
      </div>
    </div>
  )
}

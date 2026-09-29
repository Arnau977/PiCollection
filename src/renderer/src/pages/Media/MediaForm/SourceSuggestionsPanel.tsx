import { useTranslation } from 'react-i18next'
import { Plus, ShieldAlert, ShieldCheck, Sparkles } from 'lucide-react'
import { TagWikiInfo } from '../../../components/TagWikiInfo/TagWikiInfo'
import { titleCaseTagName } from '../../../utils/matchEntityNames'
import {
  SAUCE_MISSING_CATEGORIES,
  countSourceLinkable,
  countSourceSuggestions
} from './missingSuggestionCounts'
import { CharacterFormOfHint } from './CharacterFormOfHint'
import type { MediaFormSuggestions } from './useMediaFormSuggestions'

interface SourceSuggestionsPanelProps {
  source: MediaFormSuggestions['source']
  onAdd: MediaFormSuggestions['addSourceSuggestion']
  onAddExisting: MediaFormSuggestions['addSourceExisting']
  onAddAllExisting: MediaFormSuggestions['addAllSourceExisting']
  onApplyRating: (sfw: boolean) => void
  onApplyAiGenerated: MediaFormSuggestions['applySourceAiGenerated']
}

/**
 * Everything the capture's source site had - nothing is applied until
 * clicked. Names the library already has come first in each row; names it
 * doesn't are marked "new" and get created on click.
 */
export function SourceSuggestionsPanel({
  source,
  onAdd,
  onAddExisting,
  onAddAllExisting,
  onApplyRating,
  onApplyAiGenerated
}: SourceSuggestionsPanelProps): JSX.Element {
  const { t } = useTranslation()

  if (countSourceSuggestions(source) === 0) {
    return <p className="sauce-hint">{t('sourceSuggestions.nothingLeft')}</p>
  }

  const linkable = countSourceLinkable(source)

  return (
    <div className="sauce-panel">
      <p className="sauce-hint">{t('sourceSuggestions.hint')}</p>

      {linkable > 1 && (
        <button type="button" className="btn" onClick={onAddAllExisting}>
          <Plus size={16} />
          {t('sourceSuggestions.addAllExisting', { count: linkable })}
        </button>
      )}

      {source.suggestedSfw !== undefined && (
        <div className="sauce-missing-row wd14-rating-row">
          <span className="sauce-cat-label">{t('wd14.ratingLabel')}</span>
          <button
            type="button"
            className="sauce-add-chip"
            onClick={() => onApplyRating(source.suggestedSfw as boolean)}
          >
            <span className={`badge ${source.suggestedSfw ? 'badge-neutral' : 'badge-accent'}`}>
              {source.suggestedSfw ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
              {t(source.suggestedSfw ? 'media.sfwBadge' : 'media.nsfwBadge')}
            </span>
          </button>
        </div>
      )}

      {source.suggestsAiGenerated && (
        <div className="sauce-missing-row wd14-rating-row">
          <span className="sauce-cat-label">{t('sourceSuggestions.aiLabel')}</span>
          <button type="button" className="sauce-add-chip" onClick={onApplyAiGenerated}>
            <span className="badge badge-neutral">
              <Sparkles size={12} />
              {t('media.aiGeneratedBadge')}
            </span>
          </button>
        </div>
      )}

      {SAUCE_MISSING_CATEGORIES.map(({ category, labelKey }) => {
        const existing = source.existing[category]
        const missing = source.missing[category]
        if (existing.length + missing.length === 0) return null
        const display = (name: string): string =>
          category === 'tags' ? titleCaseTagName(name) : name
        return (
          <div className="sauce-missing-row" key={category}>
            <span className="sauce-cat-label">{t(labelKey)}</span>
            <ul className={`chip-list chip-list-${category}`}>
              {existing.map((entity) => (
                <li key={entity.id}>
                  <button
                    type="button"
                    className="sauce-add-chip"
                    onClick={() => onAddExisting(category, entity)}
                    aria-label={t('sourceSuggestions.addExisting', { name: entity.name })}
                  >
                    <Plus size={12} />
                    {entity.name}
                  </button>
                </li>
              ))}
              {missing.map((name) => (
                <li key={name}>
                  <button
                    type="button"
                    className="sauce-add-chip"
                    onClick={() => onAdd(category, name)}
                  >
                    <Plus size={12} />
                    {display(name)}
                    <span className="suggestion-form-of">· {t('sourceSuggestions.new')}</span>
                    {category === 'characters' && (
                      <CharacterFormOfHint parent={source.characterParents[name]} />
                    )}
                  </button>
                  {category === 'tags' && <TagWikiInfo tagName={name} />}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

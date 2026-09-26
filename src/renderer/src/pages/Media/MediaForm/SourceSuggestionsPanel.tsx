import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { TagWikiInfo } from '../../../components/TagWikiInfo/TagWikiInfo'
import { titleCaseTagName } from '../../../utils/matchEntityNames'
import { SAUCE_MISSING_CATEGORIES, countSourceMissing } from './missingSuggestionCounts'
import type { MediaFormSuggestions } from './useMediaFormSuggestions'

interface SourceSuggestionsPanelProps {
  source: MediaFormSuggestions['source']
  onAdd: MediaFormSuggestions['addSourceSuggestion']
}

/** What the capture's source site had and the library doesn't - never applied until clicked. */
export function SourceSuggestionsPanel({ source, onAdd }: SourceSuggestionsPanelProps): JSX.Element {
  const { t } = useTranslation()

  if (countSourceMissing(source.missing) === 0) {
    return <p className="sauce-hint">{t('sourceSuggestions.nothingMissing')}</p>
  }

  return (
    <div className="sauce-panel">
      <p className="sauce-hint">{t('sourceSuggestions.hint')}</p>
      {SAUCE_MISSING_CATEGORIES.map(
        ({ category, labelKey }) =>
          source.missing[category].length > 0 && (
            <div className="sauce-missing-row" key={category}>
              <span className="sauce-cat-label">{t(labelKey)}</span>
              <ul className={`chip-list chip-list-${category}`}>
                {source.missing[category].map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      className="sauce-add-chip"
                      onClick={() => onAdd(category, name)}
                    >
                      <Plus size={12} />
                      {category === 'tags' ? titleCaseTagName(name) : name}
                    </button>
                    {category === 'tags' && <TagWikiInfo tagName={name} />}
                  </li>
                ))}
              </ul>
            </div>
          )
      )}
    </div>
  )
}

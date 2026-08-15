import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Cpu, Plus } from 'lucide-react'
import { PATH } from '../../app.routes.const'
import { titleCaseTagName } from '../../utils/matchEntityNames'
import { TagWikiInfo } from '../../components/TagWikiInfo/TagWikiInfo'
import { WD14_MISSING_CATEGORIES, countWd14Missing } from './missingSuggestionCounts'
import type { MediaFormSuggestions } from './useMediaFormSuggestions'

/**
 * WD14 has no category, only a per-tag confidence score - fading
 * lower-confidence chips gives a wall of same-looking tags a scan order
 * without extra chrome (see .wd14-confidence-* in MediaForm.css).
 */
function wd14ConfidenceClass(score: number): string {
  if (score >= 0.6) return 'wd14-confidence-high'
  if (score >= 0.45) return 'wd14-confidence-medium'
  return 'wd14-confidence-low'
}

interface Wd14SuggestionsPanelProps {
  wd14Runtime: MediaFormSuggestions['wd14Runtime']
  wd14: MediaFormSuggestions['wd14']
  inputRoute: string
  saving: boolean
  onAddMissing: MediaFormSuggestions['addWd14Suggestion']
}

export function Wd14SuggestionsPanel({
  wd14Runtime,
  wd14,
  inputRoute,
  saving,
  onAddMissing
}: Wd14SuggestionsPanelProps): JSX.Element {
  const { t } = useTranslation()

  if (wd14Runtime.status !== 'installed') {
    return (
      <p className="sauce-hint">
        {t('wd14.notInstalledHint')}{' '}
        <Link to={PATH.SETTINGS}>{t('wd14.notInstalledHintLink')}</Link>
      </p>
    )
  }

  const totalMissing = countWd14Missing(wd14.missing)

  return (
    <div className="sauce-panel">
      <button
        type="button"
        className="btn"
        onClick={() => wd14.run(inputRoute)}
        disabled={!inputRoute || saving || wd14.status === 'loading'}
      >
        <Cpu size={16} />
        {wd14.status === 'loading' ? t('wd14.searching') : t('wd14.button')}
      </button>
      <p className="sauce-hint">{t('wd14.privacyHint')}</p>

      {wd14.status === 'error' && (
        <p role="alert" className="sauce-error">
          {wd14.error}
        </p>
      )}

      {wd14.status === 'ready' &&
        (wd14.appliedCount === 0 && totalMissing === 0 ? (
          <p className="sauce-hint">{t('wd14.noSuggestions')}</p>
        ) : (
          <>
            <div className="sauce-result-head">
              <span>{t('wd14.applied', { count: wd14.appliedCount })}</span>
              <button type="button" className="btn" onClick={wd14.reset}>
                {t('wd14.dismiss')}
              </button>
            </div>
            {WD14_MISSING_CATEGORIES.map(
              ({ category, labelKey }) =>
                wd14.missing[category].length > 0 && (
                  <div className="sauce-missing-row" key={category}>
                    <span className="sauce-cat-label">{t(labelKey)}</span>
                    <ul className="chip-list chip-list-tags">
                      {wd14.missing[category].map(({ name, score }) => (
                        <li
                          key={name}
                          className={`wd14-missing-chip ${wd14ConfidenceClass(score)}`}
                        >
                          <button
                            type="button"
                            className="sauce-add-chip"
                            onClick={() => onAddMissing(category, name)}
                          >
                            <Plus size={12} />
                            {category === 'tags' ? titleCaseTagName(name) : name}
                          </button>
                          <TagWikiInfo tagName={name} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )
            )}
          </>
        ))}
    </div>
  )
}

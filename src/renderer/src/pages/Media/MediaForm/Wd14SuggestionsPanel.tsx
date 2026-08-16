import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Cpu, Plus, ShieldAlert, ShieldCheck } from 'lucide-react'
import { PATH } from '../../../app.routes.const'
import { titleCaseTagName } from '../../../utils/matchEntityNames'
import { TagWikiInfo } from '../../../components/TagWikiInfo/TagWikiInfo'
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

/**
 * Danbooru's 4-tier rating is ordered general < sensitive < questionable <
 * explicit - "sensitive" covers mild fanservice (a swimsuit, a slit dress),
 * not actual explicit content, so it maps to this app's binary flag the
 * same way "general" does. Only the two higher tiers count as NSFW here,
 * matching the toggle's own "Explicit content" label.
 */
function wd14RatingImpliesSfw(rating: string): boolean {
  return rating === 'general' || rating === 'sensitive'
}

interface Wd14SuggestionsPanelProps {
  wd14Runtime: MediaFormSuggestions['wd14Runtime']
  wd14: MediaFormSuggestions['wd14']
  inputRoute: string
  inputSfw: boolean
  saving: boolean
  onAddMissing: MediaFormSuggestions['addWd14Suggestion']
  onApplyRating: (sfw: boolean) => void
}

export function Wd14SuggestionsPanel({
  wd14Runtime,
  wd14,
  inputRoute,
  inputSfw,
  saving,
  onAddMissing,
  onApplyRating
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
  // Only worth surfacing when it would actually change something - hide it
  // once applying (or the toggle already agreeing on its own) makes the
  // suggested and current value match.
  const suggestedSfw = wd14.rating != null && wd14RatingImpliesSfw(wd14.rating.name)
  const showRatingHint = wd14.status === 'ready' && wd14.rating != null && suggestedSfw !== inputSfw

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

      {showRatingHint && wd14.rating && (
        <div className="sauce-missing-row wd14-rating-row">
          <span className="sauce-cat-label">{t('wd14.ratingLabel')}</span>
          <button type="button" className="sauce-add-chip" onClick={() => onApplyRating(suggestedSfw)}>
            <span className={`badge ${suggestedSfw ? 'badge-neutral' : 'badge-accent'}`}>
              {suggestedSfw ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
              {t(suggestedSfw ? 'media.sfwBadge' : 'media.nsfwBadge')}
            </span>
            <span className="sauce-hint">
              {t('wd14.ratingDetail', {
                rating: wd14.rating.name,
                score: Math.round(wd14.rating.score * 100)
              })}
            </span>
          </button>
        </div>
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

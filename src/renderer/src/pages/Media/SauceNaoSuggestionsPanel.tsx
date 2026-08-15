import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ExternalLink, Plus, ScanSearch } from 'lucide-react'
import type { MediaInput } from '@shared/models'
import { PATH } from '../../app.routes.const'
import { SAUCE_MISSING_CATEGORIES } from './missingSuggestionCounts'
import type { MediaFormSuggestions } from './useMediaFormSuggestions'

interface SauceNaoSuggestionsPanelProps {
  hasApiKey: boolean
  sauce: MediaFormSuggestions['sauce']
  inputRoute: string
  inputType: MediaInput['type']
  saving: boolean
  onAddMissing: MediaFormSuggestions['addMissingSuggestion']
}

export function SauceNaoSuggestionsPanel({
  hasApiKey,
  sauce,
  inputRoute,
  inputType,
  saving,
  onAddMissing
}: SauceNaoSuggestionsPanelProps): JSX.Element {
  const { t } = useTranslation()

  if (!hasApiKey) {
    return (
      <p className="sauce-hint">
        {t('sauceNao.noApiKeyHint')}{' '}
        <Link to={PATH.SETTINGS}>{t('sauceNao.noApiKeyHintLink')}</Link>
      </p>
    )
  }

  return (
    <div className="sauce-panel">
      <button
        type="button"
        className="btn"
        onClick={() => sauce.run(inputRoute)}
        disabled={!inputRoute || saving || sauce.status === 'loading'}
      >
        <ScanSearch size={16} />
        {sauce.status === 'loading' ? t('sauceNao.searching') : t('sauceNao.button')}
      </button>
      <p className="sauce-hint">{t('sauceNao.privacyHint')}</p>
      {inputType === 'video' && <p className="sauce-hint">{t('sauceNao.videoHint')}</p>}

      {sauce.status === 'error' && (
        <p role="alert" className="sauce-error">
          {sauce.error}
        </p>
      )}

      {sauce.status === 'ready' && !sauce.match && (
        <>
          <p className="sauce-hint">{t('sauceNao.noMatch')}</p>
          {sauce.remaining && (
            <p className="sauce-quota">{t('sauceNao.quota', { count: sauce.remaining.long })}</p>
          )}
        </>
      )}

      {sauce.match && (
        <>
          <div className="sauce-result-head">
            <span className="badge badge-accent">
              {t('sauceNao.similarity', { value: Math.round(sauce.match.similarity) })}
            </span>
            <span>{sauce.match.indexName}</span>
            {sauce.match.sourceUrl && (
              <a href={sauce.match.sourceUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={12} />
                {t('sauceNao.viewSource')}
              </a>
            )}
            {sauce.remaining && (
              <span className="sauce-quota">
                {t('sauceNao.quota', { count: sauce.remaining.long })}
              </span>
            )}
            <button type="button" className="btn" onClick={sauce.reset}>
              {t('sauceNao.dismiss')}
            </button>
          </div>
          <p className="sauce-hint">{t('sauceNao.applied', { count: sauce.appliedCount })}</p>

          {SAUCE_MISSING_CATEGORIES.map(
            ({ category, labelKey }) =>
              sauce.missing[category].length > 0 && (
                <div className="sauce-missing-row" key={category}>
                  <span className="sauce-cat-label">{t(labelKey)}</span>
                  <ul className={`chip-list chip-list-${category}`}>
                    {sauce.missing[category].map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          className="sauce-add-chip"
                          onClick={() => onAddMissing(category, name)}
                        >
                          <Plus size={12} />
                          {name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
          )}
        </>
      )}
    </div>
  )
}

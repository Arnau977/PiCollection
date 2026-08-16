import { Cpu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWd14Runtime } from '../../hooks/useWd14Runtime'
import { useWd14NsfwThreshold } from '../../hooks/useWd14NsfwThreshold'
import type { Wd14NsfwThreshold } from '../../utils/wd14RatingSettings'
import './LocalTaggingSection.css'

const STEP_LABEL_KEYS = {
  python: 'settings.localTaggingDownloadingPython',
  packages: 'settings.localTaggingDownloadingPackages',
  model: 'settings.localTaggingDownloadingModel',
  extracting: 'settings.localTaggingExtracting',
  installing: 'settings.localTaggingInstallingPackages'
} as const

/**
 * Ordered loosest -> strictest, matching the slider's left-to-right reading
 * order - the default ("questionable") sits in the middle as the neutral
 * starting position.
 */
const THRESHOLD_STEPS: Wd14NsfwThreshold[] = ['explicit', 'questionable', 'sensitive']

const THRESHOLD_LABEL_KEYS: Record<Wd14NsfwThreshold, string> = {
  explicit: 'settings.localTaggingNsfwThresholdExplicit',
  questionable: 'settings.localTaggingNsfwThresholdQuestionable',
  sensitive: 'settings.localTaggingNsfwThresholdSensitive'
}

export function LocalTaggingSection(): JSX.Element {
  const { t } = useTranslation()
  const { status, percent, step, errorMessage, install, remove } = useWd14Runtime()
  const { threshold, setThreshold } = useWd14NsfwThreshold()

  return (
    <section className="card">
      <h2>
        <Cpu size={16} aria-hidden="true" />
        {t('settings.localTaggingTitle')}
      </h2>
      <p className="settings-version">{t('settings.localTaggingHint')}</p>

      {status === 'installing' && (
        <div className="local-tagging-progress">
          <p className="settings-version">
            {step ? t(STEP_LABEL_KEYS[step]) : ''} {percent}%
          </p>
          <div
            className="local-tagging-progress-track"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('settings.localTaggingTitle')}
          >
            <div className="local-tagging-progress-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {status === 'installed' && (
        <>
          <p className="settings-version">{t('settings.localTaggingInstalled')}</p>

          <div className="local-tagging-threshold">
            <label htmlFor="wd14-nsfw-threshold">
              {t('settings.localTaggingNsfwThreshold')}
            </label>
            <p className="settings-version">{t('settings.localTaggingNsfwThresholdHint')}</p>
            <input
              id="wd14-nsfw-threshold"
              type="range"
              className="local-tagging-threshold-input"
              min={0}
              max={THRESHOLD_STEPS.length - 1}
              step={1}
              value={THRESHOLD_STEPS.indexOf(threshold)}
              onChange={(e) => setThreshold(THRESHOLD_STEPS[Number(e.target.value)])}
              aria-valuetext={t(THRESHOLD_LABEL_KEYS[threshold])}
            />
            <div className="local-tagging-threshold-labels">
              {THRESHOLD_STEPS.map((option) => (
                <span key={option} className={option === threshold ? 'is-active' : undefined}>
                  {t(THRESHOLD_LABEL_KEYS[option])}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {status === 'error' && errorMessage && (
        <p role="alert">{t('settings.localTaggingError', { message: errorMessage })}</p>
      )}

      {status === 'installed' ? (
        <button type="button" className="btn" onClick={remove}>
          {t('settings.localTaggingRemove')}
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          disabled={status === 'installing'}
          onClick={install}
        >
          {status === 'error' ? t('settings.localTaggingRetry') : t('settings.localTaggingEnable')}
        </button>
      )}
    </section>
  )
}

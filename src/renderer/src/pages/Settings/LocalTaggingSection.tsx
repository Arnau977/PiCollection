import { Cpu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWd14Runtime } from '../../hooks/useWd14Runtime'
import './LocalTaggingSection.css'

const STEP_LABEL_KEYS = {
  python: 'settings.localTaggingDownloadingPython',
  packages: 'settings.localTaggingDownloadingPackages',
  model: 'settings.localTaggingDownloadingModel'
} as const

export function LocalTaggingSection(): JSX.Element {
  const { t } = useTranslation()
  const { status, percent, step, errorMessage, install, remove } = useWd14Runtime()

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
        <p className="settings-version">{t('settings.localTaggingInstalled')}</p>
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

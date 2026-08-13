import { Cpu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWd14Runtime } from '../../hooks/useWd14Runtime'

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
        <p className="settings-version">
          {step ? t(STEP_LABEL_KEYS[step]) : ''} {percent}%
        </p>
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

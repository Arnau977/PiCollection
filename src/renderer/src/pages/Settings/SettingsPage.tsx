import { useTranslation } from 'react-i18next'
import type { MediaFilters, MediaSortableProp } from '@shared/models'
import { useGalleryDefaults } from '../../hooks/useGalleryDefaults'
import { useAppUpdater } from '../../hooks/useAppUpdater'
import { LANGUAGES } from '../../i18n'
import './SettingsPage.css'

export default function SettingsPage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const { defaults, setDefaults } = useGalleryDefaults()
  const updater = useAppUpdater()

  return (
    <div className="page settings-page">
      <h1>{t('settings.title')}</h1>

      <section className="card">
        <h2>{t('settings.language')}</h2>
        <label className="radio-row">
          <input
            type="radio"
            name="language"
            checked={i18n.language.startsWith(LANGUAGES.ENGLISH)}
            onChange={() => i18n.changeLanguage(LANGUAGES.ENGLISH)}
          />
          {t('settings.languageEnglish')}
        </label>
        <label className="radio-row">
          <input
            type="radio"
            name="language"
            checked={i18n.language.startsWith(LANGUAGES.SPANISH)}
            onChange={() => i18n.changeLanguage(LANGUAGES.SPANISH)}
          />
          {t('settings.languageSpanish')}
        </label>
      </section>

      <section className="card">
        <h2>{t('settings.defaultFilters')}</h2>

        <label className="field">
          <span>{t('filters.sfw')}</span>
          <select
            value={defaults.sfw === undefined ? 'all' : defaults.sfw ? 'sfw' : 'nsfw'}
            onChange={(e) => {
              const selected = e.target.value
              setDefaults({
                ...defaults,
                sfw: selected === 'all' ? undefined : selected === 'sfw'
              })
            }}
          >
            <option value="all">{t('filters.sfwAll')}</option>
            <option value="sfw">{t('filters.sfwOnly')}</option>
            <option value="nsfw">{t('filters.nsfwOnly')}</option>
          </select>
        </label>

        <label className="field">
          <span>{t('filters.type')}</span>
          <select
            value={defaults.type ?? 'all'}
            onChange={(e) => {
              const selected = e.target.value
              setDefaults({
                ...defaults,
                type: selected === 'all' ? undefined : (selected as MediaFilters['type'])
              })
            }}
          >
            <option value="all">{t('filters.typeAll')}</option>
            <option value="image">{t('filters.typeImage')}</option>
            <option value="video">{t('filters.typeVideo')}</option>
            <option value="gif">{t('filters.typeGif')}</option>
          </select>
        </label>

        <label className="field">
          <span>{t('filters.sortBy')}</span>
          <select
            value={defaults.sortProp}
            onChange={(e) =>
              setDefaults({ ...defaults, sortProp: e.target.value as MediaSortableProp })
            }
          >
            <option value="createdAt">{t('filters.sortDate')}</option>
            <option value="name">{t('filters.sortName')}</option>
            <option value="sfw">{t('filters.sortSfw')}</option>
          </select>
        </label>

        <button
          type="button"
          className="btn"
          onClick={() => setDefaults({ ...defaults, sortDesc: !defaults.sortDesc })}
        >
          {defaults.sortDesc ? t('filters.descending') : t('filters.ascending')}
        </button>
      </section>

      <section className="card">
        <h2>{t('settings.nsfwBlur')}</h2>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={defaults.blurNsfw}
            onChange={(e) => setDefaults({ ...defaults, blurNsfw: e.target.checked })}
          />
          {t('settings.nsfwBlurHint')}
        </label>
      </section>

      <section className="card">
        <h2>{t('settings.hideNames')}</h2>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={defaults.hideNames}
            onChange={(e) => setDefaults({ ...defaults, hideNames: e.target.checked })}
          />
          {t('settings.hideNamesHint')}
        </label>
      </section>

      <section className="card">
        <h2>{t('settings.updates')}</h2>

        {updater.appVersion && (
          <p className="settings-version">
            {t('settings.currentVersion', { version: updater.appVersion })}
          </p>
        )}

        <div className="update-channel-group">
          <span className="filter-label">{t('settings.updateChannel')}</span>
          <label className="radio-row">
            <input
              type="radio"
              name="update-channel"
              checked={updater.channel === 'stable'}
              onChange={() => updater.setChannel('stable')}
            />
            {t('settings.channelStable')}
            <span className="update-channel-hint">{t('settings.channelStableHint')}</span>
          </label>
          <label className="radio-row">
            <input
              type="radio"
              name="update-channel"
              checked={updater.channel === 'beta'}
              onChange={() => updater.setChannel('beta')}
            />
            {t('settings.channelBeta')}
            <span className="update-channel-hint">{t('settings.channelBetaHint')}</span>
          </label>
        </div>

        {updater.status.state !== 'idle' && (
          <p className="update-status">
            {updater.status.state === 'checking' && t('settings.checkingForUpdates')}
            {updater.status.state === 'not-available' && t('settings.upToDate')}
            {updater.status.state === 'available' &&
              t('settings.updateAvailable', { version: updater.status.version })}
            {updater.status.state === 'downloading' &&
              t('settings.downloadingUpdate', { percent: updater.status.percent })}
            {updater.status.state === 'downloaded' &&
              t('settings.updateReady', { version: updater.status.version })}
            {updater.status.state === 'error' &&
              t('settings.updateCheckFailed', { message: updater.status.message })}
          </p>
        )}

        {updater.status.state === 'downloaded' ? (
          <button type="button" className="btn" onClick={updater.quitAndInstall}>
            {t('settings.restartAndInstall')}
          </button>
        ) : updater.status.state === 'available' ? (
          <button type="button" className="btn" onClick={updater.downloadUpdate}>
            {t('settings.downloadUpdate')}
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            disabled={updater.status.state === 'checking' || updater.status.state === 'downloading'}
            onClick={updater.checkForUpdates}
          >
            {t('settings.checkForUpdates')}
          </button>
        )}
      </section>
    </div>
  )
}

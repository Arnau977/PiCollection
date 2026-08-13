import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components'
import {
  Languages,
  SlidersHorizontal,
  EyeOff,
  Type,
  RefreshCw,
  ScanSearch,
  Bug
} from 'lucide-react'
import type { MediaFilters, MediaSortableProp } from '@shared/models'
import { useGalleryDefaults } from '../../hooks/useGalleryDefaults'
import { useAppUpdater } from '../../hooks/useAppUpdater'
import { LANGUAGES } from '../../i18n'
import { BackupSection } from './BackupSection'
import { MissingFilesSection } from './MissingFilesSection'
import { SourceFolderSection } from './SourceFolderSection'
import { LocalTaggingSection } from './LocalTaggingSection'
import './SettingsPage.css'

/** Loads/saves the optional SauceNAO API key (raises the free anonymous rate limit). */
function useSauceNaoApiKeyField(): {
  value: string
  saved: boolean
  onChange: (value: string) => void
  save: () => Promise<void>
  clear: () => Promise<void>
} {
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.api.sauceNao.getApiKey().then((result) => {
      if (result.success && result.data) setValue(result.data)
    })
  }, [])

  function onChange(next: string): void {
    setValue(next)
    setSaved(false)
  }

  async function save(): Promise<void> {
    await window.api.sauceNao.setApiKey(value.trim() || undefined)
    setSaved(true)
  }

  async function clear(): Promise<void> {
    setValue('')
    await window.api.sauceNao.setApiKey(undefined)
    setSaved(true)
  }

  return { value, saved, onChange, save, clear }
}

/** Loads/saves the debug-logging on/off setting. */
function useLoggingSettings(): {
  enabled: boolean
  toggle: () => void
  openFolder: () => void
} {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    window.api.logging.getEnabled().then((result) => {
      if (result.success) setEnabled(result.data)
    })
  }, [])

  function toggle(): void {
    const next = !enabled
    setEnabled(next)
    window.api.logging.setEnabled(next)
  }

  function openFolder(): void {
    window.api.logging.openFolder()
  }

  return { enabled, toggle, openFolder }
}

export default function SettingsPage(): JSX.Element {
  const { t, i18n } = useTranslation()
  const { defaults, setDefaults } = useGalleryDefaults()
  const updater = useAppUpdater()
  const sauceNaoApiKey = useSauceNaoApiKeyField()
  const logging = useLoggingSettings()

  return (
    <div className="page settings-page">
      <h1 className="page-title">{t('settings.title')}</h1>

      <Tabs className="settings-tabs">
        <TabList aria-label={t('settings.title')} className="settings-tablist">
          <Tab id="general" className="settings-tab">
            {t('settings.tabGeneral')}
          </Tab>
          <Tab id="filters" className="settings-tab">
            {t('settings.tabFilters')}
          </Tab>
          <Tab id="data" className="settings-tab">
            {t('settings.tabData')}
          </Tab>
          <Tab id="advanced" className="settings-tab">
            {t('settings.tabAdvanced')}
          </Tab>
        </TabList>

        <TabPanel id="general" className="settings-sections">
          <section className="card">
            <h2>
              <Languages size={16} aria-hidden="true" />
              {t('settings.language')}
            </h2>
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
            <h2>
              <EyeOff size={16} aria-hidden="true" />
              {t('settings.nsfwBlur')}
            </h2>
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
            <h2>
              <Type size={16} aria-hidden="true" />
              {t('settings.hideNames')}
            </h2>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={defaults.hideNames}
                onChange={(e) => setDefaults({ ...defaults, hideNames: e.target.checked })}
              />
              {t('settings.hideNamesHint')}
            </label>
          </section>
        </TabPanel>

        <TabPanel id="filters" className="settings-sections">
          <section className="card">
            <h2>
              <SlidersHorizontal size={16} aria-hidden="true" />
              {t('settings.defaultFilters')}
            </h2>

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
        </TabPanel>

        <TabPanel id="data" className="settings-sections">
          <BackupSection />
          <MissingFilesSection />
          <SourceFolderSection />
        </TabPanel>

        <TabPanel id="advanced" className="settings-sections">
          <section className="card">
            <h2>
              <RefreshCw size={16} aria-hidden="true" />
              {t('settings.updates')}
            </h2>

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

            {updater.status.state === 'available' && updater.status.highlights && (
              <div className="update-highlights">
                <h3>{t('settings.whatsNew')}</h3>
                <ul>
                  {updater.status.highlights
                    .split('\n')
                    .map((line) => line.replace(/^[-*]\s*/, '').trim())
                    .filter(Boolean)
                    .map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                </ul>
              </div>
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
                disabled={
                  updater.status.state === 'checking' || updater.status.state === 'downloading'
                }
                onClick={updater.checkForUpdates}
              >
                {t('settings.checkForUpdates')}
              </button>
            )}
          </section>

          <section className="card">
            <h2>
              <ScanSearch size={16} aria-hidden="true" />
              {t('settings.sauceNaoApiKey')}
            </h2>
            <p className="settings-version">{t('settings.sauceNaoApiKeyHint')}</p>
            <label className="field">
              <span>{t('settings.sauceNaoApiKey')}</span>
              <input
                type="password"
                value={sauceNaoApiKey.value}
                onChange={(e) => sauceNaoApiKey.onChange(e.target.value)}
                autoComplete="off"
              />
            </label>
            <div className="settings-field-actions">
              <button type="button" className="btn btn-primary" onClick={sauceNaoApiKey.save}>
                {t('settings.sauceNaoApiKeySave')}
              </button>
              <button type="button" className="btn" onClick={sauceNaoApiKey.clear}>
                {t('settings.sauceNaoApiKeyClear')}
              </button>
              {sauceNaoApiKey.saved && (
                <span className="settings-version">{t('settings.sauceNaoApiKeySaved')}</span>
              )}
            </div>
          </section>

          <section className="card">
            <h2>
              <Bug size={16} aria-hidden="true" />
              {t('settings.loggingTitle')}
            </h2>
            <p className="settings-version">{t('settings.loggingHint')}</p>
            <label className="checkbox-row">
              <input type="checkbox" checked={logging.enabled} onChange={logging.toggle} />
              {t('settings.loggingEnable')}
            </label>
            <button type="button" className="btn" onClick={logging.openFolder}>
              {t('settings.loggingOpenFolder')}
            </button>
          </section>

          <LocalTaggingSection />
        </TabPanel>
      </Tabs>
    </div>
  )
}

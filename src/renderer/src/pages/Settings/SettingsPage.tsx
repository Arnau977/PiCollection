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
  Bug,
  Scale
} from 'lucide-react'
import type { MediaFilters, MediaSortableProp } from '@shared/models'
import { useGalleryDefaults } from '../../hooks/useGalleryDefaults'
import { useAppUpdater } from '../../hooks/useAppUpdater'
import { useAutoBackup } from '../../hooks/useAutoBackup'
import { useConfirm } from '../../components/ConfirmDialog/ConfirmDialogContext'
import { SettingsRow } from '../../components/SettingsRow/SettingsRow'
import { LANGUAGES } from '../../i18n'
import { AutoStartRow } from './AutoStartRow'
import { BackupSection } from './BackupSection'
import { MissingFilesSection } from './MissingFilesSection'
import { SourceFolderSection } from './SourceFolderSection'
import { LocalTaggingSection } from './LocalTaggingSection'
import { DanbooruSection } from './DanbooruSection'
import { ExtensionBridgeSection } from './ExtensionBridgeSection'
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
  const confirm = useConfirm()
  const sauceNaoApiKey = useSauceNaoApiKeyField()
  const logging = useLoggingSettings()
  const autoBackup = useAutoBackup()
  const [licensesError, setLicensesError] = useState<string | null>(null)
  const autoBackupFailed = Boolean(autoBackup.status?.enabled && autoBackup.status.lastError)
  const updateReady =
    updater.status.state === 'available' || updater.status.state === 'downloaded'

  async function handleDownloadUpdate(): Promise<void> {
    if (updater.status.state === 'available' && updater.status.isDowngrade) {
      const confirmed = await confirm(
        t('settings.updateDowngradeConfirm', { version: updater.status.version })
      )
      if (!confirmed) return
    }
    await updater.downloadUpdate()
  }

  async function openLicenses(): Promise<void> {
    const result = await window.api.system.openThirdPartyNotices()
    setLicensesError(result.success ? null : result.error.message)
  }

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
            <span className="settings-tab-label">
              {t('settings.tabData')}
              {autoBackupFailed && (
                <span className="settings-tab-badge settings-tab-badge-danger" aria-hidden="true" />
              )}
            </span>
          </Tab>
          <Tab id="advanced" className="settings-tab">
            <span className="settings-tab-label">
              {t('settings.tabAdvanced')}
              {updateReady && <span className="settings-tab-badge" aria-hidden="true" />}
            </span>
          </Tab>
        </TabList>

        <TabPanel id="general" className="settings-sections">
          <section className="card">
            <SettingsRow icon={<Languages size={16} aria-hidden="true" />} title={t('settings.language')}>
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
            </SettingsRow>

            <SettingsRow
              icon={<EyeOff size={16} aria-hidden="true" />}
              title={t('settings.nsfwBlur')}
              description={t('settings.nsfwBlurHint')}
            >
              <input
                type="checkbox"
                aria-label={t('settings.nsfwBlur')}
                checked={defaults.blurNsfw}
                onChange={(e) => setDefaults({ ...defaults, blurNsfw: e.target.checked })}
              />
            </SettingsRow>

            <SettingsRow
              icon={<Type size={16} aria-hidden="true" />}
              title={t('settings.hideNames')}
              description={t('settings.hideNamesHint')}
            >
              <input
                type="checkbox"
                aria-label={t('settings.hideNames')}
                checked={defaults.hideNames}
                onChange={(e) => setDefaults({ ...defaults, hideNames: e.target.checked })}
              />
            </SettingsRow>

            <AutoStartRow />
          </section>
        </TabPanel>

        <TabPanel id="filters" className="settings-sections">
          <section className="card">
            <h2>
              <SlidersHorizontal size={16} aria-hidden="true" />
              {t('settings.defaultFilters')}
            </h2>

            <SettingsRow title={t('filters.sfw')}>
              <select
                aria-label={t('filters.sfw')}
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
            </SettingsRow>

            <SettingsRow title={t('filters.type')}>
              <select
                aria-label={t('filters.type')}
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
            </SettingsRow>

            <SettingsRow title={t('filters.sortBy')}>
              <select
                aria-label={t('filters.sortBy')}
                value={defaults.sortProp}
                onChange={(e) =>
                  setDefaults({ ...defaults, sortProp: e.target.value as MediaSortableProp })
                }
              >
                <option value="createdAt">{t('filters.sortDate')}</option>
                <option value="name">{t('filters.sortName')}</option>
              </select>
              <button
                type="button"
                className="btn"
                onClick={() => setDefaults({ ...defaults, sortDesc: !defaults.sortDesc })}
              >
                {defaults.sortDesc ? t('filters.descending') : t('filters.ascending')}
              </button>
            </SettingsRow>
          </section>
        </TabPanel>

        <TabPanel id="data" className="settings-sections">
          <BackupSection autoBackup={autoBackup} />
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

            {updater.status.state === 'available' && updater.status.isDowngrade && (
              <p className="update-downgrade-warning" role="alert">
                {t('settings.updateDowngradeWarning')}
              </p>
            )}

            {updater.status.state === 'downloaded' ? (
              <button type="button" className="btn" onClick={updater.quitAndInstall}>
                {t('settings.restartAndInstall')}
              </button>
            ) : updater.status.state === 'available' ? (
              <button type="button" className="btn" onClick={handleDownloadUpdate}>
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
                type="text"
                className="field-sensitive-input"
                value={sauceNaoApiKey.value}
                onChange={(e) => sauceNaoApiKey.onChange(e.target.value)}
                autoComplete="off"
              />
            </label>
            <span className="field-sensitive-hint">{t('settings.sensitiveFieldHint')}</span>
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

          <DanbooruSection />

          <ExtensionBridgeSection />

          <section className="card">
            <SettingsRow
              titleAs="h2"
              icon={<Bug size={16} aria-hidden="true" />}
              title={t('settings.loggingTitle')}
              description={t('settings.loggingHint')}
            >
              <input
                type="checkbox"
                aria-label={t('settings.loggingEnable')}
                checked={logging.enabled}
                onChange={logging.toggle}
              />
            </SettingsRow>
            <button type="button" className="btn" onClick={logging.openFolder}>
              {t('settings.loggingOpenFolder')}
            </button>
          </section>

          <LocalTaggingSection />

          <section className="card">
            <SettingsRow
              titleAs="h2"
              icon={<Scale size={16} aria-hidden="true" />}
              title={t('settings.licensesTitle')}
              description={t('settings.licensesHint')}
            >
              <button type="button" className="btn" onClick={() => void openLicenses()}>
                {t('settings.licensesOpen')}
              </button>
            </SettingsRow>
            {licensesError && <p role="alert">{licensesError}</p>}
          </section>
        </TabPanel>
      </Tabs>
    </div>
  )
}

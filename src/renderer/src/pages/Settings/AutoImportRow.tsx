import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WatcherSettings } from '@shared/models'
import { SettingsRow } from '../../components/SettingsRow/SettingsRow'

/**
 * Auto-import switch, next to the source folder it watches. Only files saved
 * after it's turned on are imported - the backlog already there never is.
 */
export function AutoImportRow(): JSX.Element {
  const { t } = useTranslation()
  const [settings, setSettings] = useState<WatcherSettings | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.autoImport.getSettings().then((result) => {
      if (result.success) setSettings(result.data)
      else setError(result.error.message)
    })
  }, [])

  async function handleToggle(enabled: boolean): Promise<void> {
    setPending(true)
    const result = await window.api.autoImport.setEnabled(enabled)
    if (result.success) {
      setSettings(result.data)
      setError(null)
    } else {
      setError(result.error.message)
    }
    setPending(false)
  }

  return (
    <>
      <SettingsRow title={t('settings.autoImportTitle')} description={t('settings.autoImportHint')}>
        <input
          type="checkbox"
          aria-label={t('settings.autoImportTitle')}
          checked={settings?.autoImport ?? false}
          disabled={!settings || pending}
          onChange={(e) => void handleToggle(e.target.checked)}
        />
      </SettingsRow>
      {error && <p role="alert">{error}</p>}
    </>
  )
}

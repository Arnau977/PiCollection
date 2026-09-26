import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Power } from 'lucide-react'
import type { AutoStartStatus } from '@shared/models'
import { SettingsRow } from '../../components/SettingsRow/SettingsRow'

/** "Start with Windows" - launches hidden in the tray at sign-in (see src/main/window/autoStart.ts). */
export function AutoStartRow(): JSX.Element {
  const { t } = useTranslation()
  const [status, setStatus] = useState<AutoStartStatus | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.system.getAutoStart().then((result) => {
      if (result.success) setStatus(result.data)
      else setError(result.error.message)
    })
  }, [])

  async function handleToggle(): Promise<void> {
    if (!status) return
    setPending(true)
    const result = await window.api.system.setAutoStart(!status.enabled)
    if (result.success) {
      setStatus(result.data)
      setError(null)
    } else {
      setError(result.error.message)
    }
    setPending(false)
  }

  const unsupported = status !== null && !status.supported

  return (
    <>
      <SettingsRow
        icon={<Power size={16} aria-hidden="true" />}
        title={t('settings.autoStart')}
        description={unsupported ? t('settings.autoStartUnsupported') : t('settings.autoStartHint')}
      >
        <input
          type="checkbox"
          aria-label={t('settings.autoStart')}
          checked={status?.enabled ?? false}
          disabled={!status || unsupported || pending}
          onChange={handleToggle}
        />
      </SettingsRow>
      {error && <p role="alert">{error}</p>}
    </>
  )
}

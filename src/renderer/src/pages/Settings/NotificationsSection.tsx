import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { APP_ALERT_KINDS, type AppAlertKind } from '@shared/models'
import { SettingsRow } from '../../components/SettingsRow/SettingsRow'

/**
 * One switch per alert (every bell item plus the auto-import toast). A
 * switched-off alert is still computed in main, so turning it back on shows
 * it right away if it still applies.
 */
export function NotificationsSection(): JSX.Element {
  const { t } = useTranslation()
  const [disabled, setDisabled] = useState<AppAlertKind[] | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.notifications.getDisabled().then((result) => {
      if (result.success) setDisabled(result.data)
      else setError(result.error.message)
    })
  }, [])

  async function toggle(kind: AppAlertKind, enabled: boolean): Promise<void> {
    setPending(true)
    const result = await window.api.notifications.setEnabled(kind, enabled)
    if (result.success) {
      setDisabled(result.data)
      setError(null)
    } else {
      setError(result.error.message)
    }
    setPending(false)
  }

  return (
    <section className="card">
      <h2>
        <Bell size={16} aria-hidden="true" />
        {t('notifications.settingsTitle')}
      </h2>
      <p className="settings-version">{t('notifications.settingsHint')}</p>
      {APP_ALERT_KINDS.map((kind) => {
        const label = t(`notifications.alert_${kind}`)
        return (
          <SettingsRow key={kind} title={label}>
            <input
              type="checkbox"
              aria-label={label}
              checked={disabled !== null && !disabled.includes(kind)}
              disabled={disabled === null || pending}
              onChange={(e) => void toggle(kind, e.target.checked)}
            />
          </SettingsRow>
        )
      })}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { APP_ALERT_KINDS, type AppAlertKind } from '@shared/models'
import { SettingsRow } from '../../components/SettingsRow/SettingsRow'

/**
 * One switch per alert (every bell item but updates, which always show, plus
 * the auto-import toast), starting from ALERT_DEFAULTS. A
 * switched-off alert is still computed in main, so turning it back on shows
 * it right away if it still applies.
 */
export function NotificationsSection(): JSX.Element {
  const { t } = useTranslation()
  const [alerts, setAlerts] = useState<Record<AppAlertKind, boolean> | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.notifications.getAlerts().then((result) => {
      if (result.success) setAlerts(result.data)
      else setError(result.error.message)
    })
  }, [])

  async function toggle(kind: AppAlertKind, enabled: boolean): Promise<void> {
    setPending(true)
    const result = await window.api.notifications.setEnabled(kind, enabled)
    if (result.success) {
      setAlerts(result.data)
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
              checked={alerts?.[kind] ?? false}
              disabled={alerts === null || pending}
              onChange={(e) => void toggle(kind, e.target.checked)}
            />
          </SettingsRow>
        )
      })}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}

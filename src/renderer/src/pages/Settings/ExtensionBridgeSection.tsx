import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Radio } from 'lucide-react'
import type { ExtensionBridgeStatus } from '@shared/models'

export function ExtensionBridgeSection(): JSX.Element | null {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ExtensionBridgeStatus | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    window.api.extensionBridge.getStatus().then((result) => {
      if (result.success) setStatus(result.data)
    })
  }, [])

  async function handleToggleEnabled(): Promise<void> {
    if (!status) return
    const result = await window.api.extensionBridge.setEnabled(!status.enabled)
    if (result.success) setStatus(result.data)
  }

  async function handleToggleBackgroundMode(): Promise<void> {
    if (!status) return
    const result = await window.api.extensionBridge.setBackgroundMode(!status.backgroundModeEnabled)
    if (result.success) setStatus(result.data)
  }

  async function handleRegenerateToken(): Promise<void> {
    const result = await window.api.extensionBridge.regenerateToken()
    if (result.success) setStatus(result.data)
  }

  function handleCopyToken(): void {
    if (!status?.token) return
    navigator.clipboard?.writeText(status.token)
    setCopied(true)
  }

  if (!status) return null

  return (
    <section className="card">
      <h2>
        <Radio size={16} aria-hidden="true" />
        {t('settings.extensionBridgeTitle')}
      </h2>
      <p className="settings-version">{t('settings.extensionBridgeHint')}</p>

      <label className="checkbox-row">
        <input type="checkbox" checked={status.enabled} onChange={handleToggleEnabled} />
        {t('settings.extensionBridgeEnable')}
      </label>

      {status.enabled && status.token && (
        <>
          <label className="field">
            <span>{t('settings.extensionBridgeToken')}</span>
            <input type="text" value={status.token} readOnly />
          </label>
          <p className="settings-version">{t('settings.extensionBridgePort', { port: status.port })}
          </p>
          <div className="settings-field-actions">
            <button type="button" className="btn" onClick={handleCopyToken}>
              {t('settings.extensionBridgeCopyToken')}
            </button>
            <button type="button" className="btn" onClick={handleRegenerateToken}>
              {t('settings.extensionBridgeRegenerateToken')}
            </button>
            {copied && <span className="settings-version">{t('settings.extensionBridgeCopied')}</span>}
          </div>
        </>
      )}

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={status.backgroundModeEnabled}
          onChange={handleToggleBackgroundMode}
        />
        {t('settings.extensionBridgeBackgroundMode')}
      </label>
    </section>
  )
}

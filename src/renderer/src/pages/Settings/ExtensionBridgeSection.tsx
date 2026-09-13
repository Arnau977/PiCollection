import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Radio } from 'lucide-react'
import type { ExtensionBridgeStatus } from '@shared/models'

export function ExtensionBridgeSection(): JSX.Element {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ExtensionBridgeStatus | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    window.api.extensionBridge.getStatus().then((result) => {
      if (result.success) {
        setStatus(result.data)
      } else {
        setError(result.error.message)
        setLoadFailed(true)
      }
    })
  }, [])

  async function handleToggleEnabled(): Promise<void> {
    if (!status) return
    setPending(true)
    const result = await window.api.extensionBridge.setEnabled(!status.enabled)
    if (result.success) {
      setStatus(result.data)
      setError(null)
    } else {
      setError(result.error.message)
    }
    setPending(false)
  }

  async function handleToggleBackgroundMode(): Promise<void> {
    if (!status) return
    setPending(true)
    const result = await window.api.extensionBridge.setBackgroundMode(!status.backgroundModeEnabled)
    if (result.success) {
      setStatus(result.data)
      setError(null)
    } else {
      setError(result.error.message)
    }
    setPending(false)
  }

  async function handleRegenerateToken(): Promise<void> {
    setPending(true)
    const result = await window.api.extensionBridge.regenerateToken()
    if (result.success) {
      setStatus(result.data)
      setError(null)
    } else {
      setError(result.error.message)
    }
    setPending(false)
  }

  function handleCopyToken(): void {
    if (!status?.token) return
    navigator.clipboard?.writeText(status.token)
    setCopied(true)
  }

  if (!status) {
    return (
      <section className="card">
        <h2>
          <Radio size={16} aria-hidden="true" />
          {t('settings.extensionBridgeTitle')}
        </h2>
        <p className="settings-version">
          {loadFailed ? error : t('settings.extensionBridgeLoading')}
        </p>
      </section>
    )
  }

  return (
    <section className="card">
      <h2>
        <Radio size={16} aria-hidden="true" />
        {t('settings.extensionBridgeTitle')}
      </h2>
      <p className="settings-version">{t('settings.extensionBridgeHint')}</p>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={status.enabled}
          onChange={handleToggleEnabled}
          disabled={pending}
        />
        {t('settings.extensionBridgeEnable')}
      </label>

      {status.enabled && (
        <p className="settings-version">
          {status.running
            ? t('settings.extensionBridgeRunning', { port: status.port })
            : t('settings.extensionBridgeNotRunning')}
        </p>
      )}

      {status.enabled && status.token && (
        <>
          <label className="field">
            <span>{t('settings.extensionBridgeToken')}</span>
            <input type="text" value={status.token} readOnly />
          </label>
          <div className="settings-field-actions">
            <button type="button" className="btn" onClick={handleCopyToken} disabled={pending}>
              {t('settings.extensionBridgeCopyToken')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleRegenerateToken}
              disabled={pending}
            >
              {t('settings.extensionBridgeRegenerateToken')}
            </button>
            {copied && (
              <span className="settings-version">{t('settings.extensionBridgeCopied')}</span>
            )}
          </div>
        </>
      )}

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={status.backgroundModeEnabled}
          onChange={handleToggleBackgroundMode}
          disabled={pending}
        />
        {t('settings.extensionBridgeBackgroundMode')}
      </label>

      {error && <p role="alert">{error}</p>}
    </section>
  )
}

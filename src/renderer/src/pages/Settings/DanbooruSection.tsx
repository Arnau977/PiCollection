import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound } from 'lucide-react'

type Status = { kind: 'idle' } | { kind: 'error'; message: string } | { kind: 'saved' }

export function DanbooruSection(): JSX.Element {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  useEffect(() => {
    window.api.danbooru.getCredentials().then((result) => {
      if (result.success && result.data) {
        setUsername(result.data.username)
        setApiKey(result.data.apiKey)
      }
    })
  }, [])

  function onChange(field: 'username' | 'apiKey', value: string): void {
    if (field === 'username') setUsername(value)
    else setApiKey(value)
    setStatus({ kind: 'idle' })
  }

  async function save(): Promise<void> {
    const result = await window.api.danbooru.setCredentials({
      username: username.trim(),
      apiKey: apiKey.trim()
    })
    setStatus(result.success ? { kind: 'saved' } : { kind: 'error', message: result.error.message })
  }

  async function clear(): Promise<void> {
    setUsername('')
    setApiKey('')
    await window.api.danbooru.setCredentials(undefined)
    setStatus({ kind: 'saved' })
  }

  return (
    <section className="card">
      <h2>
        <KeyRound size={16} aria-hidden="true" />
        {t('settings.danbooruCredentials')}
      </h2>
      <p className="settings-version">
        {t('settings.danbooruCredentialsHint')}{' '}
        <a href="https://danbooru.donmai.us/profile" target="_blank" rel="noreferrer">
          {t('settings.danbooruCredentialsGetKey')}
        </a>
      </p>
      <label className="field">
        <span>{t('settings.danbooruCredentialsUsername')}</span>
        <input
          type="text"
          value={username}
          onChange={(e) => onChange('username', e.target.value)}
          autoComplete="off"
        />
      </label>
      <label className="field">
        <span>{t('settings.danbooruCredentialsApiKey')}</span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => onChange('apiKey', e.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="settings-field-actions">
        <button type="button" className="btn btn-primary" onClick={save}>
          {t('settings.danbooruCredentialsSave')}
        </button>
        <button type="button" className="btn" onClick={clear}>
          {t('settings.danbooruCredentialsClear')}
        </button>
        {status.kind === 'saved' && (
          <span className="settings-version">{t('settings.danbooruCredentialsSaved')}</span>
        )}
      </div>
      {status.kind === 'error' && <p role="alert">{status.message}</p>}
    </section>
  )
}

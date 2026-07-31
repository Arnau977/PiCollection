import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderSearch } from 'lucide-react'

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'clean'; totalCount: number }
  | { kind: 'missing'; totalCount: number; missingCount: number; oldRoot: string; newRoot: string }
  | { kind: 'relinked'; updatedCount: number; stillMissingCount: number }
  | { kind: 'error'; message: string }

export function MissingFilesSection(): JSX.Element {
  const { t } = useTranslation()
  const [state, setState] = useState<CheckState>({ kind: 'idle' })

  async function handleCheck(): Promise<void> {
    setState({ kind: 'checking' })
    const result = await window.api.maintenance.checkMissingFiles()
    if (!result.success) {
      setState({ kind: 'error', message: result.error.message })
      return
    }
    if (result.data.missingCount === 0) {
      setState({ kind: 'clean', totalCount: result.data.totalCount })
      return
    }
    setState({
      kind: 'missing',
      totalCount: result.data.totalCount,
      missingCount: result.data.missingCount,
      oldRoot: result.data.suggestedOldRoot ?? '',
      newRoot: ''
    })
  }

  async function handlePickNewRoot(): Promise<void> {
    if (state.kind !== 'missing') return
    const result = await window.api.maintenance.pickFolder()
    if (!result.success || result.data.cancelled || !result.data.path) return
    setState({ ...state, newRoot: result.data.path })
  }

  async function handleRelink(): Promise<void> {
    if (state.kind !== 'missing' || !state.oldRoot || !state.newRoot) return
    const result = await window.api.maintenance.relinkMissingFiles(state.oldRoot, state.newRoot)
    if (!result.success) {
      setState({ kind: 'error', message: result.error.message })
      return
    }
    setState({
      kind: 'relinked',
      updatedCount: result.data.updatedCount,
      stillMissingCount: result.data.stillMissingCount
    })
  }

  return (
    <section className="card">
      <h2>
        <FolderSearch size={16} aria-hidden="true" />
        {t('settings.missingFilesTitle')}
      </h2>
      <p className="settings-version">{t('settings.missingFilesHint')}</p>

      <button type="button" className="btn" onClick={handleCheck} disabled={state.kind === 'checking'}>
        {state.kind === 'checking' ? t('settings.missingFilesChecking') : t('settings.missingFilesCheck')}
      </button>

      {state.kind === 'clean' && (
        <p className="settings-version">{t('settings.missingFilesClean', { count: state.totalCount })}</p>
      )}

      {state.kind === 'error' && <p role="alert">{state.message}</p>}

      {state.kind === 'missing' && (
        <div className="settings-field-actions">
          <p role="alert">
            {t('settings.missingFilesFound', { missing: state.missingCount, total: state.totalCount })}
          </p>
          <label className="field">
            <span>{t('settings.missingFilesOldRoot')}</span>
            <input
              type="text"
              value={state.oldRoot}
              onChange={(e) => setState({ ...state, oldRoot: e.target.value })}
            />
          </label>
          <button type="button" className="btn" onClick={handlePickNewRoot}>
            {state.newRoot
              ? t('settings.missingFilesNewRootChosen', { path: state.newRoot })
              : t('settings.missingFilesChooseNewRoot')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRelink}
            disabled={!state.oldRoot || !state.newRoot}
          >
            {t('settings.missingFilesRelink')}
          </button>
        </div>
      )}

      {state.kind === 'relinked' && (
        <p className="settings-version">
          {t('settings.missingFilesRelinked', {
            updated: state.updatedCount,
            stillMissing: state.stillMissingCount
          })}
        </p>
      )}
    </section>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderSearch } from 'lucide-react'
import type { MissingFileItem } from '@shared/models'
import { MediaThumb } from '../../components/MediaThumb/MediaThumb'

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'clean'; totalCount: number }
  | {
      kind: 'missing'
      totalCount: number
      missingCount: number
      items: MissingFileItem[]
      oldRoot: string
      newRoot: string
      lastRelinkMessage?: string
    }
  | { kind: 'error'; message: string }

export function MissingFilesSection(): JSX.Element {
  const { t } = useTranslation()
  const [state, setState] = useState<CheckState>({ kind: 'idle' })
  const [relinkingIds, setRelinkingIds] = useState<Set<string>>(new Set())

  async function refresh(message?: string): Promise<void> {
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
      items: result.data.missingItems,
      oldRoot: result.data.suggestedOldRoot ?? '',
      newRoot: '',
      lastRelinkMessage: message
    })
  }

  async function handleCheck(): Promise<void> {
    setState({ kind: 'checking' })
    await refresh()
  }

  async function handlePickNewRoot(): Promise<void> {
    if (state.kind !== 'missing') return
    const result = await window.api.maintenance.pickFolder()
    if (!result.success || result.data.cancelled || !result.data.path) return
    setState({ ...state, newRoot: result.data.path })
  }

  async function handleRelink(): Promise<void> {
    if (state.kind !== 'missing' || !state.oldRoot || !state.newRoot) return
    if (!window.confirm(t('settings.missingFilesRelinkConfirm'))) return

    const result = await window.api.maintenance.relinkMissingFiles(state.oldRoot, state.newRoot)
    if (!result.success) {
      setState({ kind: 'error', message: result.error.message })
      return
    }
    await refresh(
      t('settings.missingFilesRelinked', {
        updated: result.data.updatedCount,
        stillMissing: result.data.stillMissingCount
      })
    )
  }

  async function handleRelinkOne(item: MissingFileItem): Promise<void> {
    const picked = await window.api.maintenance.pickFile()
    if (!picked.success || picked.data.cancelled || !picked.data.path) return

    setRelinkingIds((prev) => new Set(prev).add(item.id))
    const result = await window.api.maintenance.relinkOne(item.id, picked.data.path)
    setRelinkingIds((prev) => {
      const next = new Set(prev)
      next.delete(item.id)
      return next
    })

    if (!result.success) {
      setState({ kind: 'error', message: result.error.message })
      return
    }
    await refresh()
  }

  return (
    <section className="card">
      <h2>
        <FolderSearch size={16} aria-hidden="true" />
        {t('settings.missingFilesTitle')}
      </h2>
      <p className="settings-version">{t('settings.missingFilesHint')}</p>

      <button
        type="button"
        className="btn"
        onClick={handleCheck}
        disabled={state.kind === 'checking'}
      >
        {state.kind === 'checking'
          ? t('settings.missingFilesChecking')
          : t('settings.missingFilesCheck')}
      </button>

      {state.kind === 'clean' && (
        <p className="settings-version">
          {t('settings.missingFilesClean', { count: state.totalCount })}
        </p>
      )}

      {state.kind === 'error' && <p role="alert">{state.message}</p>}

      {state.kind === 'missing' && (
        <div className="settings-relink-form">
          <p role="alert">
            {t('settings.missingFilesFound', {
              missing: state.missingCount,
              total: state.totalCount
            })}
          </p>
          {state.lastRelinkMessage && (
            <p className="settings-version">{state.lastRelinkMessage}</p>
          )}
          <label className="field">
            <span>{t('settings.missingFilesOldRoot')}</span>
            <input
              type="text"
              value={state.oldRoot}
              onChange={(e) => setState({ ...state, oldRoot: e.target.value })}
            />
          </label>
          <div className="settings-field-actions">
            <button type="button" className="btn" onClick={handlePickNewRoot}>
              {t('settings.missingFilesChooseNewRoot')}
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
          {state.newRoot && (
            <p className="settings-version settings-relink-path">
              {t('settings.missingFilesNewRootValue', { path: state.newRoot })}
            </p>
          )}

          <ul className="settings-relink-list">
            {state.items.map((item) => (
              <li key={item.id} className="settings-relink-item">
                <span className="settings-relink-item-thumb">
                  <MediaThumb type={item.type} route={item.route} alt={item.name} />
                </span>
                <span className="settings-relink-item-info">
                  <span className="settings-relink-item-name">{item.name}</span>
                  <span className="settings-relink-item-route">{item.route}</span>
                </span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleRelinkOne(item)}
                  disabled={relinkingIds.has(item.id)}
                >
                  {t('settings.missingFilesPickFile')}
                </button>
              </li>
            ))}
          </ul>
          {state.missingCount > state.items.length && (
            <p className="settings-version">
              {t('settings.missingFilesMoreHidden', {
                count: state.missingCount - state.items.length
              })}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

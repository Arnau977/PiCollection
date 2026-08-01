import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen } from 'lucide-react'
import type { SourceFolderMigrationPlan } from '@shared/models'

type State =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'plan'; target: string | null; plan: SourceFolderMigrationPlan }
  | { kind: 'applying'; target: string | null; plan: SourceFolderMigrationPlan }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string }

export function SourceFolderSection(): JSX.Element {
  const { t } = useTranslation()
  const [current, setCurrent] = useState<string | null>(null)
  const [state, setState] = useState<State>({ kind: 'idle' })

  useEffect(() => {
    window.api.sourceFolder.get().then((result) => {
      if (result.success) setCurrent(result.data)
    })
  }, [])

  async function startScan(target: string | null): Promise<void> {
    setState({ kind: 'scanning' })
    const result = await window.api.sourceFolder.scanMigration(target)
    if (!result.success) {
      setState({ kind: 'error', message: result.error.message })
      return
    }
    setState({ kind: 'plan', target, plan: result.data })
  }

  async function handleChoose(): Promise<void> {
    const picked = await window.api.maintenance.pickFolder()
    if (!picked.success || picked.data.cancelled || !picked.data.path) return
    await startScan(picked.data.path)
  }

  async function handleClear(): Promise<void> {
    await startScan(null)
  }

  async function handleApply(): Promise<void> {
    if (state.kind !== 'plan') return
    if (!window.confirm(t('settings.sourceFolderApplyConfirm'))) return

    const { target, plan } = state
    setState({ kind: 'applying', target, plan })
    const result = await window.api.sourceFolder.applyMigration(target)
    if (!result.success) {
      setState({ kind: 'error', message: result.error.message })
      return
    }
    setCurrent(target)
    setState({
      kind: 'done',
      message: t('settings.sourceFolderApplied', {
        relocated: result.data.relocatedCount,
        warned: result.data.warnedCount
      })
    })
  }

  function handleCancel(): void {
    setState({ kind: 'idle' })
  }

  return (
    <section className="card">
      <h2>
        <FolderOpen size={16} aria-hidden="true" />
        {t('settings.sourceFolderTitle')}
      </h2>
      <p className="settings-version">{t('settings.sourceFolderHint')}</p>
      <p className="settings-version">
        {current
          ? t('settings.sourceFolderCurrentValue', { path: current })
          : t('settings.sourceFolderNone')}
      </p>

      {(state.kind === 'idle' || state.kind === 'done' || state.kind === 'error') && (
        <div className="settings-field-actions">
          <button type="button" className="btn" onClick={handleChoose}>
            {t('settings.sourceFolderChoose')}
          </button>
          {current && (
            <button type="button" className="btn" onClick={handleClear}>
              {t('settings.sourceFolderClear')}
            </button>
          )}
        </div>
      )}

      {state.kind === 'scanning' && (
        <p className="settings-version">{t('settings.sourceFolderScanning')}</p>
      )}
      {state.kind === 'done' && <p className="settings-version">{state.message}</p>}
      {state.kind === 'error' && <p role="alert">{state.message}</p>}

      {(state.kind === 'plan' || state.kind === 'applying') && (
        <div className="settings-relink-form">
          <p role="alert">
            {t('settings.sourceFolderPlanSummary', {
              relocated: state.plan.relocatedCount,
              warned: state.plan.warnedCount
            })}
          </p>

          {state.plan.warnItems.length > 0 && (
            <ul className="settings-relink-list">
              {state.plan.warnItems.map((item) => (
                <li key={item.id} className="settings-relink-item">
                  <span className="settings-relink-item-info">
                    <span className="settings-relink-item-name">{item.name}</span>
                    <span className="settings-relink-item-route">{item.plannedRoute}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {state.plan.warnedCount > state.plan.warnItems.length && (
            <p className="settings-version">
              {t('settings.sourceFolderPlanMoreHidden', {
                count: state.plan.warnedCount - state.plan.warnItems.length
              })}
            </p>
          )}

          <div className="settings-field-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApply}
              disabled={state.kind === 'applying'}
            >
              {state.kind === 'applying'
                ? t('settings.sourceFolderApplying')
                : t('settings.sourceFolderApply')}
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleCancel}
              disabled={state.kind === 'applying'}
            >
              {t('settings.sourceFolderCancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

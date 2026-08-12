import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Upload } from 'lucide-react'
import { useConfirm } from '../../components/ConfirmDialog/ConfirmDialogContext'
import { Toast } from '../../components/Toast/Toast'
import { loadGalleryDefaults, saveGalleryDefaults } from '../../utils/gallerySettings'

type Status =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'exported' }
  | { kind: 'importedNeedsRestart' }

export function BackupSection(): JSX.Element {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [exportedFilePath, setExportedFilePath] = useState<string | null>(null)

  async function handleExport(): Promise<void> {
    const result = await window.api.backup.export(loadGalleryDefaults())
    if (!result.success) {
      setStatus({ kind: 'error', message: result.error.message })
      return
    }
    if (!result.data.cancelled) {
      setStatus({ kind: 'exported' })
      setExportedFilePath(result.data.filePath ?? null)
    }
  }

  function handleOpenExportedFolder(): void {
    if (exportedFilePath) window.api.system.showPathInFolder(exportedFilePath)
  }

  async function handleImport(): Promise<void> {
    if (!(await confirm(t('settings.backupImportConfirm')))) return

    const result = await window.api.backup.import()
    if (!result.success) {
      setStatus({ kind: 'error', message: result.error.message })
      return
    }
    if (result.data.cancelled) return

    if (result.data.gallerySettings) {
      saveGalleryDefaults({
        ...loadGalleryDefaults(),
        ...(result.data.gallerySettings as object)
      })
    }
    setStatus({ kind: 'importedNeedsRestart' })
  }

  async function handleRestart(): Promise<void> {
    await window.api.system.restartApp()
  }

  return (
    <section className="card">
      <h2>
        <Download size={16} aria-hidden="true" />
        {t('settings.backupTitle')}
      </h2>
      <p className="settings-version">{t('settings.backupHint')}</p>

      <div className="settings-field-actions">
        <button type="button" className="btn" onClick={handleExport}>
          <Download size={16} />
          {t('settings.backupExport')}
        </button>
        <button type="button" className="btn" onClick={handleImport}>
          <Upload size={16} />
          {t('settings.backupImport')}
        </button>
      </div>

      {status.kind === 'error' && <p role="alert">{status.message}</p>}
      {status.kind === 'importedNeedsRestart' && (
        <div className="settings-field-actions">
          <p role="alert">{t('settings.backupImportedNeedsRestart')}</p>
          <button type="button" className="btn btn-primary" onClick={handleRestart}>
            {t('settings.backupRestartNow')}
          </button>
        </div>
      )}

      {status.kind === 'exported' && (
        <Toast
          message={t('settings.backupExported')}
          actionLabel={exportedFilePath ? t('settings.backupOpenFolder') : undefined}
          onAction={exportedFilePath ? handleOpenExportedFolder : undefined}
          onDismiss={() => setStatus({ kind: 'idle' })}
        />
      )}
    </section>
  )
}

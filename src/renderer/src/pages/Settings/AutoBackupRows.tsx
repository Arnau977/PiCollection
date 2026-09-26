import { useTranslation } from 'react-i18next'
import { CalendarClock, FolderOpen, History, Layers, RefreshCw, TimerReset } from 'lucide-react'
import { AUTO_BACKUP_KEEP_COUNT_OPTIONS, type AutoBackupFrequency } from '@shared/models'
import { SettingsRow } from '../../components/SettingsRow/SettingsRow'
import type { UseAutoBackup } from '../../hooks/useAutoBackup'
import { formatRelativeTime } from '../../utils/formatDate'

const FREQUENCIES: AutoBackupFrequency[] = ['daily', 'weekly', 'monthly']

interface AutoBackupRowsProps {
  autoBackup: UseAutoBackup
}

/**
 * The automatic half of the Backup card. The detail rows only appear once
 * the toggle is on, and the card shows state (last/next run, last failure)
 * rather than only configuration - a backup that silently stopped working
 * is the failure mode that matters here.
 */
export function AutoBackupRows({ autoBackup }: AutoBackupRowsProps): JSX.Element {
  const { t, i18n } = useTranslation()
  const { status, pending, error } = autoBackup
  const busy = !status || pending || status.running
  const now = Date.now()

  return (
    <div className="auto-backup-rows">
      <SettingsRow
        icon={<TimerReset size={16} aria-hidden="true" />}
        title={t('settings.autoBackup')}
        description={t('settings.autoBackupHint')}
      >
        <input
          type="checkbox"
          aria-label={t('settings.autoBackup')}
          checked={status?.enabled ?? false}
          disabled={busy}
          onChange={() => status && autoBackup.update({ enabled: !status.enabled })}
        />
      </SettingsRow>

      {status?.enabled && (
        <>
          <SettingsRow
            icon={<CalendarClock size={16} aria-hidden="true" />}
            title={t('settings.autoBackupFrequency')}
          >
            <select
              aria-label={t('settings.autoBackupFrequency')}
              value={status.frequency}
              disabled={busy}
              onChange={(e) =>
                autoBackup.update({ frequency: e.target.value as AutoBackupFrequency })
              }
            >
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {t(`settings.autoBackupFrequency_${frequency}`)}
                </option>
              ))}
            </select>
          </SettingsRow>

          <SettingsRow
            icon={<Layers size={16} aria-hidden="true" />}
            title={t('settings.autoBackupKeep')}
            description={t('settings.autoBackupKeepHint')}
          >
            <select
              aria-label={t('settings.autoBackupKeep')}
              value={status.keepCount}
              disabled={busy}
              onChange={(e) => autoBackup.update({ keepCount: Number(e.target.value) })}
            >
              {AUTO_BACKUP_KEEP_COUNT_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {t('settings.autoBackupKeepOption', { count })}
                </option>
              ))}
            </select>
          </SettingsRow>

          <SettingsRow
            icon={<FolderOpen size={16} aria-hidden="true" />}
            title={t('settings.autoBackupFolder')}
            description={
              status.folder
                ? status.resolvedFolder
                : t('settings.autoBackupFolderDefault', { path: status.resolvedFolder })
            }
          >
            <button type="button" className="btn" disabled={busy} onClick={autoBackup.pickFolder}>
              {t('settings.autoBackupFolderChange')}
            </button>
            <button type="button" className="btn" onClick={autoBackup.openFolder}>
              {t('settings.backupOpenFolder')}
            </button>
          </SettingsRow>

          <SettingsRow
            icon={<History size={16} aria-hidden="true" />}
            title={t('settings.autoBackupStatus')}
            description={[
              status.lastSuccessAt
                ? t('settings.autoBackupLast', {
                    when: formatRelativeTime(status.lastSuccessAt, now, i18n.language)
                  })
                : t('settings.autoBackupNone'),
              status.nextDueAt && status.nextDueAt > now
                ? t('settings.autoBackupNext', {
                    when: formatRelativeTime(status.nextDueAt, now, i18n.language)
                  })
                : t('settings.autoBackupNextSoon')
            ].join(' · ')}
          >
            <button type="button" className="btn" disabled={busy} onClick={autoBackup.runNow}>
              <RefreshCw size={16} aria-hidden="true" />
              {status.running ? t('settings.autoBackupRunning') : t('settings.autoBackupRunNow')}
            </button>
          </SettingsRow>

          {status.lastError && (
            <p role="alert" className="auto-backup-error">
              {t('settings.autoBackupFailed', { message: status.lastError })}
            </p>
          )}
        </>
      )}

      {error && <p role="alert">{error}</p>}
    </div>
  )
}

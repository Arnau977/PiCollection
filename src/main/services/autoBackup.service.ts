import { promises as fs } from 'fs'
import { join } from 'path'
import type { AutoBackupConfig, AutoBackupFrequency, AutoBackupStatus } from '@shared/models'
import { isDbOpen } from '../database/connection'
import { resolveBackupsDir, resolveElectronDbPath } from '../database/electronDbPath'
import { notifyAutoBackupChanged } from '../events/autoBackupEvents'
import { logError, logInfo } from '../logging/logger'
import {
  readAutoBackupSettings,
  updateAutoBackupSettings,
  type AutoBackupSettings
} from './autoBackupSettings'
import { createBackupZip, getBackupBuildKind } from './backupService'

const DAY_MS = 24 * 60 * 60 * 1000
const FREQUENCY_MS: Record<AutoBackupFrequency, number> = {
  daily: DAY_MS,
  weekly: 7 * DAY_MS,
  monthly: 30 * DAY_MS
}

/** Gives the window a moment to load before the first check does any disk work. */
const STARTUP_DELAY_MS = 60 * 1000
/** Scheduling is by time elapsed since the last success, so an hourly check is plenty. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000

const PARTIAL_SUFFIX = '.partial'

let running = false
let startupTimer: NodeJS.Timeout | undefined
let intervalTimer: NodeJS.Timeout | undefined

function resolveFolder(settings: AutoBackupSettings): string {
  return settings.folder ?? resolveBackupsDir()
}

/**
 * Includes the build kind so a dev run and an installed build sharing one
 * folder never prune each other's backups - retention only ever touches
 * files carrying this exact prefix.
 */
function filePrefix(): string {
  return `picollection-auto-${getBackupBuildKind()}-`
}

export function isAutoBackupDue(settings: AutoBackupSettings, now: number): boolean {
  if (!settings.enabled) return false
  if (settings.lastSuccessAt === null) return true
  return now - settings.lastSuccessAt >= FREQUENCY_MS[settings.frequency]
}

export function getAutoBackupStatus(): AutoBackupStatus {
  const settings = readAutoBackupSettings()
  return {
    enabled: settings.enabled,
    frequency: settings.frequency,
    keepCount: settings.keepCount,
    folder: settings.folder,
    resolvedFolder: resolveFolder(settings),
    lastSuccessAt: settings.lastSuccessAt,
    lastError: settings.lastError,
    nextDueAt: settings.enabled
      ? (settings.lastSuccessAt ?? 0) + FREQUENCY_MS[settings.frequency]
      : null,
    running
  }
}

/** Oldest first - ISO timestamps in the name sort lexically in chronological order. */
async function listAutoBackups(folder: string): Promise<string[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(folder)
  } catch {
    return []
  }
  const prefix = filePrefix()
  return entries.filter((name) => name.startsWith(prefix) && name.endsWith('.zip')).sort()
}

export async function pruneAutoBackups(folder: string, keepCount: number): Promise<void> {
  const backups = await listAutoBackups(folder)
  const toDelete = backups.slice(0, Math.max(0, backups.length - keepCount))
  await Promise.all(toDelete.map((name) => fs.unlink(join(folder, name))))
}

/** True when the newest existing backup is at least as recent as the database's last write. */
async function isNewestBackupCurrent(folder: string, backups: string[]): Promise<boolean> {
  const newest = backups.at(-1)
  if (!newest) return false
  try {
    const [backupStat, dbStat] = await Promise.all([
      fs.stat(join(folder, newest)),
      fs.stat(resolveElectronDbPath())
    ])
    return backupStat.mtimeMs >= dbStat.mtimeMs
  } catch {
    return false
  }
}

/**
 * Writes a backup when one is due (or always, with `force` - "Back up now").
 * An unforced run that finds the database unchanged since the newest backup
 * writes nothing but still counts as a success, so retention isn't filled
 * with identical copies. Never overlaps itself, and does nothing while the
 * database is closed (a restore in progress).
 */
export async function runAutoBackup(options: { force?: boolean } = {}): Promise<AutoBackupStatus> {
  const settings = readAutoBackupSettings()
  if (running || !isDbOpen()) return getAutoBackupStatus()
  if (!options.force && !isAutoBackupDue(settings, Date.now())) return getAutoBackupStatus()

  running = true
  notifyAutoBackupChanged(getAutoBackupStatus())
  const folder = resolveFolder(settings)
  let partialPath: string | null = null
  try {
    await fs.mkdir(folder, { recursive: true })
    const existing = await listAutoBackups(folder)
    if (options.force || !(await isNewestBackupCurrent(folder, existing))) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const finalPath = join(folder, `${filePrefix()}${timestamp}.zip`)
      // Written under a name retention ignores, then renamed: a crash
      // mid-write never leaves a truncated zip that looks like a backup.
      partialPath = finalPath + PARTIAL_SUFFIX
      await createBackupZip(partialPath, undefined)
      await fs.rename(partialPath, finalPath)
      partialPath = null
      await pruneAutoBackups(folder, settings.keepCount)
      logInfo('backup', 'Automatic backup written', { path: finalPath })
    }
    updateAutoBackupSettings({ lastSuccessAt: Date.now(), lastError: null })
  } catch (err) {
    logError('backup', 'Automatic backup failed', err)
    updateAutoBackupSettings({ lastError: err instanceof Error ? err.message : String(err) })
    if (partialPath) await fs.rm(partialPath, { force: true }).catch(() => undefined)
  } finally {
    running = false
  }

  const status = getAutoBackupStatus()
  notifyAutoBackupChanged(status)
  return status
}

/**
 * Applies a settings change from the Settings page. Turning backups on runs
 * one right away if due; pointing them at a new folder writes a fresh copy
 * there, so the chosen location is never empty; lowering the keep count
 * prunes immediately instead of waiting for the next backup.
 */
export async function updateAutoBackupConfig(
  patch: Partial<AutoBackupConfig>
): Promise<AutoBackupStatus> {
  const previous = readAutoBackupSettings()
  const next = updateAutoBackupSettings(patch)

  if (next.keepCount < previous.keepCount) {
    await pruneAutoBackups(resolveFolder(next), next.keepCount).catch((err) =>
      logError('backup', 'Pruning automatic backups failed', err)
    )
  }

  const folderChanged = resolveFolder(next) !== resolveFolder(previous)
  if (next.enabled && (folderChanged || !previous.enabled)) {
    void runAutoBackup({ force: folderChanged })
  }

  const status = getAutoBackupStatus()
  notifyAutoBackupChanged(status)
  return status
}

export function startAutoBackupScheduler(): void {
  const check = (): void => {
    runAutoBackup().catch((err) => logError('backup', 'Automatic backup check failed', err))
  }
  startupTimer = setTimeout(check, STARTUP_DELAY_MS)
  intervalTimer = setInterval(check, CHECK_INTERVAL_MS)
  startupTimer.unref()
  intervalTimer.unref()
}

export function stopAutoBackupScheduler(): void {
  if (startupTimer) clearTimeout(startupTimer)
  if (intervalTimer) clearInterval(intervalTimer)
}

import {
  AUTO_BACKUP_KEEP_COUNT_OPTIONS,
  type AutoBackupConfig,
  type AutoBackupFrequency
} from '@shared/models'
import { createJsonSettingsFile } from './jsonSettingsFile'

const SETTINGS_FILE = 'auto-backup-settings.json'
const FREQUENCIES: readonly AutoBackupFrequency[] = ['daily', 'weekly', 'monthly']

export interface AutoBackupSettings extends AutoBackupConfig {
  lastSuccessAt: number | null
  lastError: string | null
}

export const DEFAULT_AUTO_BACKUP_SETTINGS: AutoBackupSettings = {
  enabled: false,
  frequency: 'daily',
  keepCount: 10,
  folder: null,
  lastSuccessAt: null,
  lastError: null
}

function parse(raw: unknown): AutoBackupSettings {
  const saved = raw as Partial<AutoBackupSettings>
  const defaults = DEFAULT_AUTO_BACKUP_SETTINGS
  return {
    enabled: saved.enabled === true,
    frequency: FREQUENCIES.includes(saved.frequency as AutoBackupFrequency)
      ? (saved.frequency as AutoBackupFrequency)
      : defaults.frequency,
    keepCount: (AUTO_BACKUP_KEEP_COUNT_OPTIONS as readonly number[]).includes(
      saved.keepCount as number
    )
      ? (saved.keepCount as number)
      : defaults.keepCount,
    folder: typeof saved.folder === 'string' && saved.folder ? saved.folder : null,
    lastSuccessAt: typeof saved.lastSuccessAt === 'number' ? saved.lastSuccessAt : null,
    lastError: typeof saved.lastError === 'string' ? saved.lastError : null
  }
}

const settingsFile = createJsonSettingsFile<AutoBackupSettings>(
  SETTINGS_FILE,
  parse,
  DEFAULT_AUTO_BACKUP_SETTINGS
)

export function readAutoBackupSettings(): AutoBackupSettings {
  return settingsFile.read()
}

export function updateAutoBackupSettings(patch: Partial<AutoBackupSettings>): AutoBackupSettings {
  const next = { ...settingsFile.read(), ...patch }
  settingsFile.write(next)
  return next
}

/** Test-only. */
export function resetAutoBackupSettingsCache(): void {
  settingsFile.invalidate()
}

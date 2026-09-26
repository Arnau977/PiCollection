export interface BackupExportResult {
  cancelled: boolean
  filePath?: string
}

export interface BackupImportResult {
  cancelled: boolean
  gallerySettings?: unknown
}

export interface MissingFileItem {
  id: string
  name: string
  route: string
  type: 'image' | 'video' | 'gif'
}

export interface MissingFilesCheck {
  totalCount: number
  missingCount: number
  suggestedOldRoot: string | null
  missingItems: MissingFileItem[]
}

export interface PickFolderResult {
  cancelled: boolean
  path?: string
}

export interface RelinkResult {
  updatedCount: number
  stillMissingCount: number
}

export interface RelinkOneResult {
  updated: boolean
}

export type AutoBackupFrequency = 'daily' | 'weekly' | 'monthly'

export const AUTO_BACKUP_KEEP_COUNT_OPTIONS = [5, 10, 20, 30] as const

export interface AutoBackupConfig {
  enabled: boolean
  frequency: AutoBackupFrequency
  keepCount: number
  /** null means the default folder (userData/backups). */
  folder: string | null
}

export interface AutoBackupStatus extends AutoBackupConfig {
  /** The folder backups are actually written to - `folder`, or the default one. */
  resolvedFolder: string
  lastSuccessAt: number | null
  /** Message of the last attempt's failure; cleared by the next success. */
  lastError: string | null
  /** When the next scheduled backup is due; null when automatic backups are off. */
  nextDueAt: number | null
  running: boolean
}

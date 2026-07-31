export interface BackupExportResult {
  cancelled: boolean
}

export interface BackupImportResult {
  cancelled: boolean
  gallerySettings?: unknown
}

export interface MissingFilesCheck {
  totalCount: number
  missingCount: number
  suggestedOldRoot: string | null
}

export interface PickFolderResult {
  cancelled: boolean
  path?: string
}

export interface RelinkResult {
  updatedCount: number
  stillMissingCount: number
}

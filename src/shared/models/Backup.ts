export interface BackupExportResult {
  cancelled: boolean
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

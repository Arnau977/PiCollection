export interface SourceFolderMigrationItem {
  id: string
  name: string
  route: string
  plannedRoute: string
  wasRelative: boolean
}

export interface SourceFolderMigrationPlan {
  relocatedCount: number
  /** Capped at 50, same shape/reasoning as MissingFilesCheck.missingItems. */
  warnItems: SourceFolderMigrationItem[]
  warnedCount: number
}

export interface SourceFolderApplyResult {
  relocatedCount: number
  warnedCount: number
}

export interface SourceFolderBrowseEntry {
  name: string
  relativePath: string
}

export interface SourceFolderBrowseFile extends SourceFolderBrowseEntry {
  type: 'image' | 'video' | 'gif'
  cataloged: boolean
}

export interface SourceFolderBrowseResult {
  folders: SourceFolderBrowseEntry[]
  files: SourceFolderBrowseFile[]
}

/** One file resolved and ready to import - `route` is always an absolute filesystem path. */
export interface ExpandedMediaFile {
  route: string
  fileName: string
  type: 'image' | 'video' | 'gif'
}

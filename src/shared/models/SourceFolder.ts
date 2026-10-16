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

export interface SourceFolderBrowseFolder extends SourceFolderBrowseEntry {
  /** Recursive count of media files anywhere under this folder still left to
   * import (neither cataloged nor discarded), computed at request time (never
   * persisted) - see sourceFolderBrowser.service.ts. */
  fileCount: number
}

export interface SourceFolderBrowseFile extends SourceFolderBrowseEntry {
  type: 'image' | 'video' | 'gif'
  cataloged: boolean
  /** Deleted from the library before (Metadata > Discarded) - a batch import skips it. */
  discarded: boolean
}

export interface SourceFolderBrowseResult {
  folders: SourceFolderBrowseFolder[]
  files: SourceFolderBrowseFile[]
}

/** One file resolved and ready to import - `route` is always an absolute filesystem path. */
export interface ExpandedMediaFile {
  route: string
  fileName: string
  type: 'image' | 'video' | 'gif'
}

/** A batch import's files, minus those already cataloged or discarded earlier. */
export interface ExpandedSelection {
  files: ExpandedMediaFile[]
  /** Left out because they're in the Discarded list. */
  skippedDiscarded: number
}

export interface WatcherSettings {
  /** Add files saved into the source folder to Pending on their own. Off by default. */
  autoImport: boolean
  /**
   * When auto-import was last turned on: only files created at or after it
   * are imported, so the backlog already in the folder is never touched.
   */
  autoImportEnabledAt: number | null
}

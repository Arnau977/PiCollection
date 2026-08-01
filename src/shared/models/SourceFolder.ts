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

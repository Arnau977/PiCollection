/** Bytes and file count of a slice of the library. */
export interface StorageTotal {
  bytes: number
  count: number
}

/** One folder's share: every file under it, subfolders included. */
export interface StorageFolder extends StorageTotal {
  /** Relative to the source folder ('' = the source folder itself), or a full path outside it. */
  path: string
}

/** One series/character/artist: its media, through the hierarchy for series and characters. */
export interface StorageEntity extends StorageTotal {
  id: string
  name: string
}

/**
 * The disk-space overview (Storage page). Library figures leave Pending out,
 * like the gallery; Pending and discarded files still on disk are their own
 * totals. Sizes come from media.file_size, read in the background.
 */
export interface StorageOverview {
  library: StorageTotal & {
    /** Files whose size hasn't been read yet (counted in `count`, not in `bytes`). */
    unmeasured: number
  }
  pending: StorageTotal
  /** Deleted media whose files are still on disk (Metadata > Discarded). */
  discarded: StorageTotal
  folders: StorageFolder[]
  series: StorageEntity[]
  characters: StorageEntity[]
  artists: StorageEntity[]
}

import { z } from 'zod'

export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } }

export const MediaFiltersSchema = z.object({
  query: z.string().optional(),
  artistId: z.string().optional(),
  sfw: z.boolean().optional(),
  type: z.enum(['image', 'video', 'gif']).optional(),
  tagGroups: z.array(z.array(z.string())).optional(),
  characterGroups: z.array(z.array(z.string())).optional(),
  noCharacter: z.boolean().optional(),
  seriesGroups: z.array(z.array(z.string())).optional(),
  noSeries: z.boolean().optional(),
  isAiGenerated: z.boolean().optional(),
  pendingTagging: z.boolean().optional(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional()
})

export const SortingSchema = z.object({
  prop: z.enum(['name', 'createdAt']).optional(),
  desc: z.boolean().optional()
})

export const MediaInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['image', 'video', 'gif']),
  route: z.string().min(1),
  alias: z.string().optional(),
  sfw: z.boolean(),
  isAiGenerated: z.boolean(),
  artistId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
  characterIds: z.array(z.string()).optional(),
  seriesIds: z.array(z.string()).optional(),
  pendingTagging: z.boolean().optional()
})

export const MediaBatchUpdateAssociationsSchema = z
  .object({
    mediaIds: z.array(z.string().min(1)).min(1),
    addTagIds: z.array(z.string().min(1)).default([]),
    removeTagIds: z.array(z.string().min(1)).default([]),
    addCharacterIds: z.array(z.string().min(1)).default([]),
    removeCharacterIds: z.array(z.string().min(1)).default([]),
    addSeriesIds: z.array(z.string().min(1)).default([]),
    removeSeriesIds: z.array(z.string().min(1)).default([]),
    sfw: z.boolean().optional()
  })
  .refine(
    (data) =>
      [
        data.addTagIds,
        data.removeTagIds,
        data.addCharacterIds,
        data.removeCharacterIds,
        data.addSeriesIds,
        data.removeSeriesIds
      ].some((list) => list.length > 0) || data.sfw !== undefined,
    { message: 'At least one add, remove, or SFW/NSFW selection is required.' }
  )

export const IdSchema = z.string().min(1)

export const RouteSchema = z.object({ route: z.string().min(1) })

export const DanbooruCredentialsInputSchema = z.object({
  username: z.string().min(1),
  apiKey: z.string().min(1)
})

export const CacheThumbnailSchema = z.object({
  route: z.string().min(1),
  // Structured-clone-transferred from the renderer, so it survives the IPC
  // boundary as a real Uint8Array rather than JSON.
  png: z.custom<Uint8Array>((value) => value instanceof Uint8Array)
})

export const ArtistInputSchema = z.object({
  name: z.string().min(1)
})

export const SocialLinkInputSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  icon: z.string().optional()
})

export const AddSocialLinkSchema = z.object({
  artistId: z.string().min(1),
  socialLink: SocialLinkInputSchema
})

export const RemoveSocialLinkSchema = z.object({
  artistId: z.string().min(1),
  socialLinkId: z.string().min(1)
})

export const TagInputSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).optional()
})

export const SeriesInputSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  parentId: z.string().nullable().optional()
})

export const CharacterInputSchema = z.object({
  name: z.string().min(1),
  seriesIds: z.array(z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  parentId: z.string().nullable().optional()
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- letting zod infer the precise object shape from T
export const UpdateByIdSchema = <T extends z.ZodTypeAny>(inputSchema: T) =>
  z.object({ id: z.string().min(1), input: inputSchema })

export const MediaGetFilteredSchema = z.object({
  filters: MediaFiltersSchema,
  sorting: SortingSchema.optional()
})

export const MediaGetEntityThumbnailsSchema = z.object({
  kind: z.enum(['artist', 'tag', 'character', 'series']),
  ids: z.array(z.string().min(1))
})

export const BackupExportSchema = z.object({ gallerySettings: z.unknown() })
export const RelinkMissingFilesSchema = z.object({
  oldRoot: z.string().min(1),
  newRoot: z.string().min(1)
})

export const RelinkOneFileSchema = z.object({
  mediaId: z.string().min(1),
  newRoute: z.string().min(1)
})

export const SourceFolderPathSchema = z.object({
  path: z.string().min(1).nullable()
})

export const SourceFolderBrowsePathSchema = z.object({
  relativePath: z.string()
})

export const SourceFolderExpandSelectionSchema = z.object({
  files: z.array(z.string()),
  folders: z.array(z.string())
})

export const MediaUpdateSchema = UpdateByIdSchema(MediaInputSchema)
export const ArtistUpdateSchema = UpdateByIdSchema(ArtistInputSchema)
export const CharacterUpdateSchema = UpdateByIdSchema(CharacterInputSchema)
export const TagUpdateSchema = UpdateByIdSchema(TagInputSchema)
export const SeriesUpdateSchema = UpdateByIdSchema(SeriesInputSchema)

export const IPC = {
  media: {
    getFiltered: 'db:media:get-filtered',
    getOrderedIds: 'db:media:get-ordered-ids',
    getEntityThumbnails: 'db:media:get-entity-thumbnails',
    getById: 'db:media:get-by-id',
    create: 'db:media:create',
    update: 'db:media:update',
    batchUpdateAssociations: 'db:media:batch-update-associations',
    clearPendingTagging: 'db:media:clear-pending-tagging',
    delete: 'db:media:delete',
    cacheThumbnail: 'db:media:cache-thumbnail',
    checkDuplicate: 'db:media:check-duplicate',
    findSimilar: 'db:media:find-similar'
  },
  artist: {
    getAll: 'db:artist:get-all',
    create: 'db:artist:create',
    update: 'db:artist:update',
    delete: 'db:artist:delete',
    addSocialLink: 'db:artist:add-social-link',
    removeSocialLink: 'db:artist:remove-social-link'
  },
  tag: {
    getAll: 'db:tag:get-all',
    create: 'db:tag:create',
    update: 'db:tag:update',
    delete: 'db:tag:delete'
  },
  character: {
    getAll: 'db:character:get-all',
    create: 'db:character:create',
    update: 'db:character:update',
    delete: 'db:character:delete'
  },
  series: {
    getAll: 'db:series:get-all',
    create: 'db:series:create',
    update: 'db:series:update',
    delete: 'db:series:delete'
  },
  stats: {
    getSummary: 'db:stats:get-summary'
  },
  system: {
    showInFolder: 'system:show-in-folder',
    showPathInFolder: 'system:show-path-in-folder',
    copyImageToClipboard: 'system:copy-image-to-clipboard',
    copyLocationToClipboard: 'system:copy-location-to-clipboard',
    getAppVersion: 'system:get-app-version',
    restartApp: 'system:restart-app'
  },
  backup: {
    export: 'backup:export',
    import: 'backup:import'
  },
  maintenance: {
    checkMissingFiles: 'maintenance:check-missing-files',
    pickFolder: 'maintenance:pick-folder',
    pickFile: 'maintenance:pick-file',
    relinkMissingFiles: 'maintenance:relink-missing-files',
    relinkOne: 'maintenance:relink-one'
  },
  sourceFolder: {
    get: 'source-folder:get',
    scanMigration: 'source-folder:scan',
    applyMigration: 'source-folder:apply',
    browse: 'source-folder:browse',
    expandSelection: 'source-folder:expand-selection'
  },
  sauceNao: {
    lookup: 'sauce-nao:lookup',
    getApiKey: 'sauce-nao:get-api-key',
    setApiKey: 'sauce-nao:set-api-key'
  },
  danbooru: {
    autocompleteTags: 'danbooru:autocomplete-tags',
    getCredentials: 'danbooru:get-credentials',
    setCredentials: 'danbooru:set-credentials'
  },
  tagWiki: {
    lookup: 'tag-wiki:lookup'
  },
  wd14Runtime: {
    getStatus: 'wd14-runtime:get-status',
    install: 'wd14-runtime:install',
    remove: 'wd14-runtime:remove',
    /** Main -> renderer push channel; not invoked directly, see `onEvent` in preload. */
    event: 'wd14-runtime:event'
  },
  wd14Tagger: {
    suggestTags: 'wd14-tagger:suggest-tags'
  },
  logging: {
    getEnabled: 'logging:get-enabled',
    setEnabled: 'logging:set-enabled',
    openFolder: 'logging:open-folder',
    reportRendererError: 'logging:report-renderer-error'
  },
  updater: {
    checkForUpdates: 'updater:check-for-updates',
    downloadUpdate: 'updater:download-update',
    quitAndInstall: 'updater:quit-and-install',
    getChannel: 'updater:get-channel',
    setChannel: 'updater:set-channel',
    /** Last event the main process broadcast (or null before any check has run) - lets a component that mounts after that broadcast (e.g. navigating to Settings later) learn the current state without forcing a fresh check. */
    getStatus: 'updater:get-status',
    /** Main -> renderer push channel; not invoked directly, see `onEvent` in preload. */
    event: 'updater:event'
  },
  entities: {
    /** Main -> renderer push channel; not invoked directly, see `onChanged` in preload. */
    changed: 'entities:changed'
  }
} as const

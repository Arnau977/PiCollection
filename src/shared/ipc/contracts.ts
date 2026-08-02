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
  seriesIds: z.array(z.string()).optional(),
  seriesOperator: z.enum(['AND', 'OR']).optional(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional()
})

export const SortingSchema = z.object({
  prop: z.enum(['name', 'createdAt', 'sfw']).optional(),
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
  seriesIds: z.array(z.string()).optional()
})

export const IdSchema = z.string().min(1)

export const RouteSchema = z.object({ route: z.string().min(1) })

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
  name: z.string().min(1)
})

export const SeriesInputSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).optional()
})

export const CharacterInputSchema = z.object({
  name: z.string().min(1),
  seriesIds: z.array(z.string()).optional(),
  aliases: z.array(z.string()).optional()
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- letting zod infer the precise object shape from T
export const UpdateByIdSchema = <T extends z.ZodTypeAny>(inputSchema: T) =>
  z.object({ id: z.string().min(1), input: inputSchema })

export const MediaGetFilteredSchema = z.object({
  filters: MediaFiltersSchema,
  sorting: SortingSchema.optional()
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

export const MediaUpdateSchema = UpdateByIdSchema(MediaInputSchema)
export const ArtistUpdateSchema = UpdateByIdSchema(ArtistInputSchema)
export const CharacterUpdateSchema = UpdateByIdSchema(CharacterInputSchema)
export const TagUpdateSchema = UpdateByIdSchema(TagInputSchema)
export const SeriesUpdateSchema = UpdateByIdSchema(SeriesInputSchema)

export const IPC = {
  media: {
    getAll: 'db:media:get-all',
    getFiltered: 'db:media:get-filtered',
    getById: 'db:media:get-by-id',
    create: 'db:media:create',
    update: 'db:media:update',
    delete: 'db:media:delete',
    cacheThumbnail: 'db:media:cache-thumbnail',
    checkDuplicate: 'db:media:check-duplicate'
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
    applyMigration: 'source-folder:apply'
  },
  sauceNao: {
    lookup: 'sauce-nao:lookup',
    getApiKey: 'sauce-nao:get-api-key',
    setApiKey: 'sauce-nao:set-api-key'
  },
  updater: {
    checkForUpdates: 'updater:check-for-updates',
    downloadUpdate: 'updater:download-update',
    quitAndInstall: 'updater:quit-and-install',
    getChannel: 'updater:get-channel',
    setChannel: 'updater:set-channel',
    /** Main -> renderer push channel; not invoked directly, see `onEvent` in preload. */
    event: 'updater:event'
  }
} as const

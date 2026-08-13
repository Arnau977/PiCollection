import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  ArtistInput,
  ArtistModel,
  BackupExportResult,
  BackupImportResult,
  CharacterInput,
  CharacterModel,
  DanbooruTagSuggestion,
  EntitiesChangedEvent,
  ExpandedMediaFile,
  MediaBatchUpdateAssociationsInput,
  MediaDuplicateCheck,
  MediaDuplicateMatch,
  MediaFilteredResult,
  MediaFilters,
  MediaInput,
  MediaModel,
  MissingFilesCheck,
  PickFolderResult,
  RelinkOneResult,
  RelinkResult,
  SauceNaoLookup,
  SeriesInput,
  SeriesModel,
  SocialLinkInput,
  Sorting,
  SourceFolderApplyResult,
  SourceFolderBrowseResult,
  SourceFolderMigrationPlan,
  StatsSummary,
  TagInput,
  TagModel,
  UpdateChannel,
  UpdaterEvent
} from '@shared/models'
import { IPC, type IpcResult } from '@shared/ipc/contracts'

export const api = {
  media: {
    getFiltered: (
      filters: MediaFilters,
      sorting?: Sorting
    ): Promise<IpcResult<MediaFilteredResult>> =>
      ipcRenderer.invoke(IPC.media.getFiltered, { filters, sorting }),
    getOrderedIds: (filters: MediaFilters, sorting?: Sorting): Promise<IpcResult<string[]>> =>
      ipcRenderer.invoke(IPC.media.getOrderedIds, { filters, sorting }),
    getEntityThumbnails: (
      kind: 'artist' | 'tag' | 'character' | 'series',
      ids: string[]
    ): Promise<IpcResult<{ entityId: string; route: string; type: string }[]>> =>
      ipcRenderer.invoke(IPC.media.getEntityThumbnails, { kind, ids }),
    getById: (id: string): Promise<IpcResult<MediaModel | null>> =>
      ipcRenderer.invoke(IPC.media.getById, id),
    create: (input: MediaInput): Promise<IpcResult<MediaModel>> =>
      ipcRenderer.invoke(IPC.media.create, input),
    update: (id: string, input: MediaInput): Promise<IpcResult<MediaModel>> =>
      ipcRenderer.invoke(IPC.media.update, { id, input }),
    batchUpdateAssociations: (input: MediaBatchUpdateAssociationsInput): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.media.batchUpdateAssociations, input),
    clearPendingTagging: (id: string): Promise<IpcResult<MediaModel>> =>
      ipcRenderer.invoke(IPC.media.clearPendingTagging, id),
    delete: (id: string): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC.media.delete, id),
    cacheThumbnail: (route: string, png: Uint8Array): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.media.cacheThumbnail, { route, png }),
    checkDuplicate: (route: string): Promise<IpcResult<MediaDuplicateCheck>> =>
      ipcRenderer.invoke(IPC.media.checkDuplicate, { route }),
    findSimilar: (mediaId: string): Promise<IpcResult<MediaDuplicateMatch[]>> =>
      ipcRenderer.invoke(IPC.media.findSimilar, mediaId)
  },
  artist: {
    getAll: (): Promise<IpcResult<ArtistModel[]>> => ipcRenderer.invoke(IPC.artist.getAll),
    create: (input: ArtistInput): Promise<IpcResult<ArtistModel>> =>
      ipcRenderer.invoke(IPC.artist.create, input),
    update: (id: string, input: ArtistInput): Promise<IpcResult<ArtistModel>> =>
      ipcRenderer.invoke(IPC.artist.update, { id, input }),
    delete: (id: string): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC.artist.delete, id),
    addSocialLink: (
      artistId: string,
      socialLink: SocialLinkInput
    ): Promise<IpcResult<ArtistModel>> =>
      ipcRenderer.invoke(IPC.artist.addSocialLink, { artistId, socialLink }),
    removeSocialLink: (artistId: string, socialLinkId: string): Promise<IpcResult<ArtistModel>> =>
      ipcRenderer.invoke(IPC.artist.removeSocialLink, { artistId, socialLinkId })
  },
  tag: {
    getAll: (): Promise<IpcResult<TagModel[]>> => ipcRenderer.invoke(IPC.tag.getAll),
    create: (input: TagInput): Promise<IpcResult<TagModel>> =>
      ipcRenderer.invoke(IPC.tag.create, input),
    update: (id: string, input: TagInput): Promise<IpcResult<TagModel>> =>
      ipcRenderer.invoke(IPC.tag.update, { id, input }),
    delete: (id: string): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC.tag.delete, id)
  },
  character: {
    getAll: (): Promise<IpcResult<CharacterModel[]>> => ipcRenderer.invoke(IPC.character.getAll),
    create: (input: CharacterInput): Promise<IpcResult<CharacterModel>> =>
      ipcRenderer.invoke(IPC.character.create, input),
    update: (id: string, input: CharacterInput): Promise<IpcResult<CharacterModel>> =>
      ipcRenderer.invoke(IPC.character.update, { id, input }),
    delete: (id: string): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC.character.delete, id)
  },
  series: {
    getAll: (): Promise<IpcResult<SeriesModel[]>> => ipcRenderer.invoke(IPC.series.getAll),
    create: (input: SeriesInput): Promise<IpcResult<SeriesModel>> =>
      ipcRenderer.invoke(IPC.series.create, input),
    update: (id: string, input: SeriesInput): Promise<IpcResult<SeriesModel>> =>
      ipcRenderer.invoke(IPC.series.update, { id, input }),
    delete: (id: string): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC.series.delete, id)
  },
  stats: {
    getSummary: (): Promise<IpcResult<StatsSummary>> => ipcRenderer.invoke(IPC.stats.getSummary)
  },
  system: {
    showInFolder: (route: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.system.showInFolder, route),
    showPathInFolder: (path: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.system.showPathInFolder, path),
    copyImageToClipboard: (route: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.system.copyImageToClipboard, route),
    copyLocationToClipboard: (route: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.system.copyLocationToClipboard, route),
    getAppVersion: (): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.system.getAppVersion),
    restartApp: (): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC.system.restartApp)
  },
  backup: {
    export: (gallerySettings: unknown): Promise<IpcResult<BackupExportResult>> =>
      ipcRenderer.invoke(IPC.backup.export, { gallerySettings }),
    import: (): Promise<IpcResult<BackupImportResult>> => ipcRenderer.invoke(IPC.backup.import)
  },
  maintenance: {
    checkMissingFiles: (): Promise<IpcResult<MissingFilesCheck>> =>
      ipcRenderer.invoke(IPC.maintenance.checkMissingFiles),
    pickFolder: (): Promise<IpcResult<PickFolderResult>> =>
      ipcRenderer.invoke(IPC.maintenance.pickFolder),
    pickFile: (): Promise<IpcResult<PickFolderResult>> =>
      ipcRenderer.invoke(IPC.maintenance.pickFile),
    relinkMissingFiles: (oldRoot: string, newRoot: string): Promise<IpcResult<RelinkResult>> =>
      ipcRenderer.invoke(IPC.maintenance.relinkMissingFiles, { oldRoot, newRoot }),
    relinkOne: (mediaId: string, newRoute: string): Promise<IpcResult<RelinkOneResult>> =>
      ipcRenderer.invoke(IPC.maintenance.relinkOne, { mediaId, newRoute })
  },
  sourceFolder: {
    get: (): Promise<IpcResult<string | null>> => ipcRenderer.invoke(IPC.sourceFolder.get),
    scanMigration: (path: string | null): Promise<IpcResult<SourceFolderMigrationPlan>> =>
      ipcRenderer.invoke(IPC.sourceFolder.scanMigration, { path }),
    applyMigration: (path: string | null): Promise<IpcResult<SourceFolderApplyResult>> =>
      ipcRenderer.invoke(IPC.sourceFolder.applyMigration, { path }),
    browse: (relativePath: string): Promise<IpcResult<SourceFolderBrowseResult>> =>
      ipcRenderer.invoke(IPC.sourceFolder.browse, { relativePath }),
    expandSelection: (selection: {
      files: string[]
      folders: string[]
    }): Promise<IpcResult<ExpandedMediaFile[]>> =>
      ipcRenderer.invoke(IPC.sourceFolder.expandSelection, selection)
  },
  sauceNao: {
    lookup: (route: string): Promise<IpcResult<SauceNaoLookup>> =>
      ipcRenderer.invoke(IPC.sauceNao.lookup, route),
    getApiKey: (): Promise<IpcResult<string | undefined>> =>
      ipcRenderer.invoke(IPC.sauceNao.getApiKey),
    setApiKey: (apiKey: string | undefined): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.sauceNao.setApiKey, apiKey)
  },
  danbooru: {
    autocompleteTags: (query: string): Promise<IpcResult<DanbooruTagSuggestion[]>> =>
      ipcRenderer.invoke(IPC.danbooru.autocompleteTags, query)
  },
  logging: {
    getEnabled: (): Promise<IpcResult<boolean>> => ipcRenderer.invoke(IPC.logging.getEnabled),
    setEnabled: (enabled: boolean): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.logging.setEnabled, enabled),
    openFolder: (): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC.logging.openFolder),
    reportRendererError: (message: string, stack?: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.logging.reportRendererError, { message, stack })
  },
  updater: {
    checkForUpdates: (): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.updater.checkForUpdates),
    downloadUpdate: (): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC.updater.downloadUpdate),
    quitAndInstall: (): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC.updater.quitAndInstall),
    getChannel: (): Promise<IpcResult<UpdateChannel>> => ipcRenderer.invoke(IPC.updater.getChannel),
    setChannel: (channel: UpdateChannel): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.updater.setChannel, channel),
    /** Subscribes to update-check/download progress; returns an unsubscribe function. */
    onEvent: (listener: (event: UpdaterEvent) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, payload: UpdaterEvent): void => listener(payload)
      ipcRenderer.on(IPC.updater.event, handler)
      return () => ipcRenderer.removeListener(IPC.updater.event, handler)
    }
  },
  entities: {
    /** Subscribes to entity-kind change notifications (tag/character/series/artist mediaCount changed); returns an unsubscribe function. */
    onChanged: (listener: (event: EntitiesChangedEvent) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, payload: EntitiesChangedEvent): void =>
        listener(payload)
      ipcRenderer.on(IPC.entities.changed, handler)
      return () => ipcRenderer.removeListener(IPC.entities.changed, handler)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

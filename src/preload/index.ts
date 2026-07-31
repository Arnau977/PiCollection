import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  ArtistInput,
  ArtistModel,
  CharacterInput,
  CharacterModel,
  MediaDuplicateCheck,
  MediaFilteredResult,
  MediaFilters,
  MediaInput,
  MediaModel,
  SauceNaoLookup,
  SeriesInput,
  SeriesModel,
  SocialLinkInput,
  Sorting,
  StatsSummary,
  TagInput,
  TagModel,
  UpdateChannel,
  UpdaterEvent
} from '@shared/models'
import { IPC, type IpcResult } from '@shared/ipc/contracts'

export const api = {
  media: {
    getAll: (): Promise<IpcResult<MediaModel[]>> => ipcRenderer.invoke(IPC.media.getAll),
    getFiltered: (
      filters: MediaFilters,
      sorting?: Sorting
    ): Promise<IpcResult<MediaFilteredResult>> =>
      ipcRenderer.invoke(IPC.media.getFiltered, { filters, sorting }),
    getById: (id: string): Promise<IpcResult<MediaModel | null>> =>
      ipcRenderer.invoke(IPC.media.getById, id),
    create: (input: MediaInput): Promise<IpcResult<MediaModel>> =>
      ipcRenderer.invoke(IPC.media.create, input),
    update: (id: string, input: MediaInput): Promise<IpcResult<MediaModel>> =>
      ipcRenderer.invoke(IPC.media.update, { id, input }),
    delete: (id: string): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC.media.delete, id),
    cacheThumbnail: (route: string, png: Uint8Array): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.media.cacheThumbnail, { route, png }),
    checkDuplicate: (route: string): Promise<IpcResult<MediaDuplicateCheck>> =>
      ipcRenderer.invoke(IPC.media.checkDuplicate, { route })
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
    copyImageToClipboard: (route: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.system.copyImageToClipboard, route),
    getAppVersion: (): Promise<IpcResult<string>> => ipcRenderer.invoke(IPC.system.getAppVersion)
  },
  sauceNao: {
    lookup: (route: string): Promise<IpcResult<SauceNaoLookup>> =>
      ipcRenderer.invoke(IPC.sauceNao.lookup, route),
    getApiKey: (): Promise<IpcResult<string | undefined>> =>
      ipcRenderer.invoke(IPC.sauceNao.getApiKey),
    setApiKey: (apiKey: string | undefined): Promise<IpcResult<void>> =>
      ipcRenderer.invoke(IPC.sauceNao.setApiKey, apiKey)
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

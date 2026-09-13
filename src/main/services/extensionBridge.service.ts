import { mkdir, unlink, writeFile } from 'fs/promises'
import { extname, join } from 'path'
import { z } from 'zod'
import { AppError } from '../errors'
import { artistService } from './artist.service'
import { characterService } from './character.service'
import { mediaService } from './media.service'
import { readSourceFolder } from './sourceFolder'
import { seriesService } from './series.service'
import { tagService } from './tag.service'

export type ExtensionBridgeLookupType = 'artist' | 'tag' | 'series' | 'character'

/**
 * Validates every incoming /capture request body - this is the sole
 * validation of external input reaching this HTTP API (see extensionBridge
 * .server.ts), matching the "validate at system boundaries" rule applied to
 * the IPC boundary elsewhere in this app.
 */
export const ExtensionBridgeCaptureInputSchema = z.object({
  fileDataBase64: z.string().min(1),
  fileName: z.string().min(1),
  mediaType: z.enum(['image', 'gif', 'video']),
  sourceUrl: z.string().min(1),
  sourceSite: z.string().min(1),
  artistName: z.string().optional(),
  tagNames: z.array(z.string()).optional(),
  characterNames: z.array(z.string()).optional(),
  seriesNames: z.array(z.string()).optional(),
  sfw: z.boolean().optional(),
  isAiGenerated: z.boolean().optional(),
  pendingTagging: z.boolean().optional()
})

export type ExtensionBridgeCaptureInput = z.infer<typeof ExtensionBridgeCaptureInputSchema>

export type ExtensionBridgeCaptureResult =
  | { status: 'created'; mediaId: string }
  | { status: 'duplicate'; mediaId: string }

const FALLBACK_EXTENSION: Record<ExtensionBridgeCaptureInput['mediaType'], string> = {
  image: '.jpg',
  gif: '.gif',
  video: '.mp4'
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}

async function findOrCreateByName<T extends { id: string; name: string }>(
  name: string,
  getAll: () => Promise<T[]>,
  create: (name: string) => Promise<T>
): Promise<string> {
  const normalized = name.trim().toLowerCase()
  const existing = (await getAll()).find((item) => item.name.trim().toLowerCase() === normalized)
  if (existing) return existing.id
  const created = await create(name.trim())
  return created.id
}

/**
 * Resolves a list of names to ids via findOrCreateByName, one at a time and
 * deduplicated. Deliberately sequential (not Promise.all): findOrCreateByName
 * is check-then-act, so running it concurrently over a list containing two
 * case-identical/duplicate names lets both calls see "no existing match"
 * before either create() commits - the second create() then either throws a
 * raw UNIQUE-constraint error (tag/artist/series) or silently creates a
 * duplicate row (character, which has no unique constraint). Same class of
 * bug already fixed in media.service.ts's addMediaMany. The result is also
 * deduplicated: two input names resolving to the same id (e.g. exact repeats
 * or case-variants of one name) would otherwise produce a duplicate id in
 * the array, which trips the media_tag/media_character/media_series
 * composite primary key when addMedia links them.
 */
async function resolveNamesSequentially<T extends { id: string; name: string }>(
  names: string[],
  getAll: () => Promise<T[]>,
  create: (name: string) => Promise<T>
): Promise<string[]> {
  const ids: string[] = []
  for (const name of names) {
    const id = await findOrCreateByName(name, getAll, create)
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

export const extensionBridgeService = {
  async lookup(
    type: ExtensionBridgeLookupType,
    query: string
  ): Promise<{ id: string; name: string }[]> {
    const all: { id: string; name: string }[] =
      type === 'artist'
        ? await artistService.getAllArtists()
        : type === 'tag'
          ? await tagService.getAllTags()
          : type === 'series'
            ? await seriesService.getAllSeries()
            : await characterService.getAllCharacters()

    const normalized = query.trim().toLowerCase()
    const matches = normalized
      ? all.filter((item) => item.name.toLowerCase().includes(normalized))
      : all
    return matches.slice(0, 20).map((item) => ({ id: item.id, name: item.name }))
  },

  async capture(input: ExtensionBridgeCaptureInput): Promise<ExtensionBridgeCaptureResult> {
    const sourceFolder = readSourceFolder()
    if (!sourceFolder) {
      throw new AppError('NO_SOURCE_FOLDER', 'Configure a source folder in PiCollection first.')
    }

    const siteDir = join(sourceFolder, 'Web Imports', input.sourceSite || 'unknown')
    await mkdir(siteDir, { recursive: true })

    const extension = extname(input.fileName) || FALLBACK_EXTENSION[input.mediaType]
    const baseName = sanitizeFileName(
      input.fileName.slice(0, input.fileName.length - extname(input.fileName).length)
    )
    const absolutePath = join(siteDir, `${Date.now()}-${baseName}${extension}`)
    await writeFile(absolutePath, Buffer.from(input.fileDataBase64, 'base64'))

    const duplicateCheck = await mediaService.checkDuplicate(absolutePath)
    if (duplicateCheck.exactMatch) {
      await unlink(absolutePath)
      return { status: 'duplicate', mediaId: duplicateCheck.exactMatch.id }
    }

    const artistId = input.artistName
      ? await findOrCreateByName(
          input.artistName,
          () => artistService.getAllArtists(),
          (name) => artistService.createArtist({ name })
        )
      : undefined

    const tagIds = input.tagNames
      ? await resolveNamesSequentially(
          input.tagNames,
          () => tagService.getAllTags(),
          (n) => tagService.createTag({ name: n })
        )
      : []

    const characterIds = input.characterNames
      ? await resolveNamesSequentially(
          input.characterNames,
          () => characterService.getAllCharacters(),
          (n) => characterService.createCharacter({ name: n })
        )
      : []

    const seriesIds = input.seriesNames
      ? await resolveNamesSequentially(
          input.seriesNames,
          () => seriesService.getAllSeries(),
          (n) => seriesService.createSeries({ name: n })
        )
      : []

    const created = await mediaService.addMedia({
      name: input.fileName,
      type: input.mediaType,
      route: absolutePath,
      sfw: input.sfw ?? true,
      isAiGenerated: input.isAiGenerated ?? false,
      artistId,
      tagIds,
      characterIds,
      seriesIds,
      pendingTagging: input.pendingTagging ?? true,
      sourceUrl: input.sourceUrl
    })

    return { status: 'created', mediaId: created.id }
  }
}

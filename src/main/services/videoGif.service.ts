import { access, unlink, writeFile } from 'fs/promises'
import { basename, dirname, extname, join } from 'path'
import type { MediaModel } from '@shared/models'
import { AppError } from '../errors'
import { mediaService } from './media.service'
import { readSourceFolder, resolveRoute } from './sourceFolder'

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  )
}

/** "clip.mp4" -> "clip (GIF).gif", then "clip (GIF 2).gif"... - never overwrites a file. */
async function freeGifPath(videoPath: string): Promise<string> {
  const dir = dirname(videoPath)
  const base = basename(videoPath, extname(videoPath))
  for (let n = 1; ; n++) {
    const candidate = join(dir, `${base} (GIF${n > 1 ? ` ${n}` : ''}).gif`)
    if (!(await exists(candidate))) return candidate
  }
}

export const videoGifService = {
  /**
   * Saves a GIF the renderer encoded from a video clip next to that video,
   * and adds it to the library with the video's metadata (artist, tags,
   * characters, series, rating, AI flag, source URL) - it's the same
   * artwork, so it should show up under the same filters.
   */
  async createFromVideo(sourceMediaId: string, bytes: Uint8Array): Promise<MediaModel> {
    const source = await mediaService.getMediaById(sourceMediaId)
    if (!source || source.type !== 'video') {
      throw new AppError('NOT_FOUND', 'The video to convert no longer exists.')
    }

    const path = await freeGifPath(resolveRoute(source.route, readSourceFolder()))
    await writeFile(path, bytes)
    try {
      return await mediaService.addMedia(
        {
          name: `${source.name} (GIF)`,
          type: 'gif',
          route: path,
          sfw: source.sfw,
          isAiGenerated: source.isAiGenerated,
          sourceUrl: source.sourceUrl,
          artistId: source.artist?.id,
          tagIds: source.tags?.map((tag) => tag.id) ?? [],
          characterIds: source.characters?.map((character) => character.id) ?? [],
          seriesIds: source.series?.map((series) => series.id) ?? [],
          pendingTagging: false
        },
        { derivedFromId: source.id }
      )
    } catch (err) {
      // Don't leave an orphan GIF in the source folder if it couldn't be added.
      await unlink(path).catch(() => {})
      throw err
    }
  }
}

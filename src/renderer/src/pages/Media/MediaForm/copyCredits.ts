import type { MediaInput, MediaModel } from '@shared/models'

/** Whether a similar match has anything to copy at all (an artist, characters or series). */
export function hasCredits(media: MediaModel): boolean {
  return Boolean(media.artist) || !!media.characters?.length || !!media.series?.length
}

/**
 * "Copy artist, characters & series" from a similar match - usually a
 * variant of the same drawing. Only adds, like the suggestion chips: an
 * artist already picked stays. Returns null when the form already has
 * everything the match could add.
 */
export function copyCreditsFrom(media: MediaModel, input: MediaInput): MediaInput | null {
  const artistId = input.artistId ?? media.artist?.id
  const characterIds = union(input.characterIds, media.characters)
  const seriesIds = union(input.seriesIds, media.series)
  const changed =
    artistId !== input.artistId ||
    characterIds.length !== (input.characterIds?.length ?? 0) ||
    seriesIds.length !== (input.seriesIds?.length ?? 0)
  return changed ? { ...input, artistId, characterIds, seriesIds } : null
}

function union(ids: string[] | undefined, entities: { id: string }[] | undefined): string[] {
  return Array.from(new Set([...(ids ?? []), ...(entities ?? []).map(({ id }) => id)]))
}

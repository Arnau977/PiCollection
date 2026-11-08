import type { MediaModel } from '@shared/models'
import { toMediaUrl } from '@shared/utils/mediaUrl'
import type { ComparedMedia } from './MediaCompare'
import { taxonomyOf } from './taxonomyDiff'

export type ComparableMedia = Pick<
  MediaModel,
  'id' | 'route' | 'name' | 'type' | 'pendingTagging' | 'characters' | 'series' | 'tags'
>

/** A saved media as one side of `MediaCompare`. */
export const toCompared = (media: ComparableMedia): ComparedMedia => ({
  src: toMediaUrl(media.route),
  route: media.route,
  name: media.name,
  status: media.pendingTagging ? 'pending' : 'library',
  taxonomy: taxonomyOf(media)
})

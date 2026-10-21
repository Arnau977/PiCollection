import { sql, type Kysely, type SqlBool } from 'kysely'
import { DANBOORU_SIZES, ORIENTATION_TOLERANCE } from '@shared/models/AutoTag'
import type { AutoTagRuleTable, DB, MediaTable } from '../schema'

const { lowresMaxSide, highres, absurdres, incrediblyAbsurdresSide, extremeMinSide, extremeRatio } =
  DANBOORU_SIZES
const LOWRES = sql.lit(lowresMaxSide)
const HIGH_W = sql.lit(highres.width)
const HIGH_H = sql.lit(highres.height)
const ABSURD_W = sql.lit(absurdres.width)
const ABSURD_H = sql.lit(absurdres.height)
const INCREDIBLE = sql.lit(incrediblyAbsurdresSide)
const EXTREME_SIDE = sql.lit(extremeMinSide)
const EXTREME_RATIO = sql.lit(extremeRatio)
const TOLERANCE = sql.lit(ORIENTATION_TOLERANCE)

/**
 * Whether a media row has the property its joined rule names. Width/height
 * are null until analyzed (and stay null for videos), which makes every
 * comparison null, so an unanalyzed row never matches; 0 marks a file that
 * couldn't be decoded and is kept out explicitly. Reads `media` and
 * `auto_tag_rule` from the surrounding query.
 */
export const MEDIA_MATCHES_RULE = sql<SqlBool>`CASE auto_tag_rule.property
  WHEN 'transparent' THEN media.has_alpha = 1
  WHEN 'lowres' THEN media.width > 0 AND media.width <= ${LOWRES} AND media.height <= ${LOWRES}
  WHEN 'highres' THEN media.width >= ${HIGH_W} OR media.height >= ${HIGH_H}
  WHEN 'absurdres' THEN media.width >= ${ABSURD_W} OR media.height >= ${ABSURD_H}
  WHEN 'incredibly_absurdres' THEN max(media.width, media.height) >= ${INCREDIBLE}
  WHEN 'tall_image' THEN media.height >= ${EXTREME_SIDE}
    AND media.height >= media.width * ${EXTREME_RATIO}
  WHEN 'wide_image' THEN media.width >= ${EXTREME_SIDE}
    AND media.width >= media.height * ${EXTREME_RATIO}
  WHEN 'portrait' THEN media.width > 0 AND media.height > media.width * ${TOLERANCE}
  WHEN 'landscape' THEN media.height > 0 AND media.width > media.height * ${TOLERANCE}
  WHEN 'square' THEN media.width > 0
    AND media.height <= media.width * ${TOLERANCE}
    AND media.width <= media.height * ${TOLERANCE}
  ELSE 0 END`

/** (media, tag) pairs that apply only through a rule - computed, never stored. */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- inferred Kysely SelectQueryBuilder generic is impractical to spell out
export function autoMediaTags(db: Kysely<DB>) {
  return db
    .selectFrom('media')
    .innerJoin('auto_tag_rule', (join) => join.on(MEDIA_MATCHES_RULE))
    .select(['media.id as media_id', 'auto_tag_rule.tag_id as tag_id'])
}

/**
 * Every (media, tag) pair: the media's own tags plus those its rules add,
 * a pair present both ways listed once. Read it wherever `media_tag` is
 * read, aliased as `media_tag`; writes still go to `media_tag` itself.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- see above
export function effectiveMediaTags(db: Kysely<DB>) {
  return db.selectFrom('media_tag').select(['media_id', 'tag_id']).union(autoMediaTags(db))
}

export function listRules(db: Kysely<DB>): Promise<AutoTagRuleTable[]> {
  return db.selectFrom('auto_tag_rule').selectAll().execute()
}

export async function setRule(db: Kysely<DB>, property: string, tagId: string): Promise<void> {
  await db
    .insertInto('auto_tag_rule')
    .values({ property, tag_id: tagId })
    .onConflict((oc) => oc.column('property').doUpdateSet({ tag_id: tagId }))
    .execute()
}

export async function deleteRule(db: Kysely<DB>, property: string): Promise<void> {
  await db.deleteFrom('auto_tag_rule').where('property', '=', property).execute()
}

/** Pictures (not videos) whose size and transparency haven't been read yet. */
export function listUnanalyzedMedia(
  db: Kysely<DB>,
  limit: number
): Promise<Pick<MediaTable, 'id' | 'route'>[]> {
  return db
    .selectFrom('media')
    .select(['id', 'route'])
    .where('width', 'is', null)
    .where('type', '!=', 'video')
    .limit(limit)
    .execute()
}

export async function countUnanalyzedMedia(db: Kysely<DB>): Promise<number> {
  const row = await db
    .selectFrom('media')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('width', 'is', null)
    .where('type', '!=', 'video')
    .executeTakeFirstOrThrow()
  return Number(row.count)
}

/** Width 0 marks a file that couldn't be decoded, so it isn't retried. */
export async function setFileProperties(
  db: Kysely<DB>,
  id: string,
  properties: { width: number; height: number; hasAlpha: boolean }
): Promise<void> {
  await db
    .updateTable('media')
    .set({
      width: properties.width,
      height: properties.height,
      has_alpha: properties.hasAlpha ? 1 : 0
    })
    .where('id', '=', id)
    .execute()
}

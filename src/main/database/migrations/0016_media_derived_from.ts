import { Kysely } from 'kysely'

/**
 * Links a media made from another one (a GIF from a video clip) to its
 * source, so each shows the other under "Similar media" even when their
 * perceptual hashes can't be compared (videos have none).
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('media')
    .addColumn('derived_from_id', 'text', (col) => col.references('media.id').onDelete('set null'))
    .execute()
  await db.schema
    .createIndex('idx_media_derived_from')
    .on('media')
    .column('derived_from_id')
    .execute()

  // GIFs made before this column existed follow the converter's naming:
  // "clip.mp4" -> "clip (GIF).gif" / "clip (GIF 2).gif" in the same folder.
  const rows: { id: string; type: string; route: string }[] = await db
    .selectFrom('media')
    .select(['id', 'type', 'route'])
    .where('type', 'in', ['video', 'gif'])
    .execute()
  const videoByStem = new Map(
    rows
      .filter((row) => row.type === 'video')
      .map((row) => [row.route.replace(/\.[^./\\]+$/, ''), row.id])
  )
  for (const gif of rows.filter((row) => row.type === 'gif')) {
    const stem = /^(.*) \(GIF(?: \d+)?\)\.gif$/i.exec(gif.route)?.[1]
    const videoId = stem !== undefined ? videoByStem.get(stem) : undefined
    if (videoId) {
      await db
        .updateTable('media')
        .set({ derived_from_id: videoId })
        .where('id', '=', gif.id)
        .execute()
    }
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_media_derived_from').execute()
  await db.schema.alterTable('media').dropColumn('derived_from_id').execute()
}

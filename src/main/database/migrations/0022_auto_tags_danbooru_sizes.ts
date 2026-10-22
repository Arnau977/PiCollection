import { Kysely, sql } from 'kysely'

/**
 * Automatic tags' size properties now follow Danbooru's own definitions.
 * The two from 0020 carry over to their closest one: "high resolution"
 * (longest side >= 3840) to absurdres, "low resolution" (< 800) to lowres.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`UPDATE auto_tag_rule SET property = 'absurdres' WHERE property = 'high_res'`.execute(db)
  await sql`UPDATE auto_tag_rule SET property = 'lowres' WHERE property = 'low_res'`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`UPDATE auto_tag_rule SET property = 'high_res' WHERE property = 'absurdres'`.execute(db)
  await sql`UPDATE auto_tag_rule SET property = 'low_res' WHERE property = 'lowres'`.execute(db)
}

import { randomUUID } from 'crypto'
import {
  AUTO_TAG_PROPERTIES,
  DANBOORU_DEFAULT_TAGS,
  type AutoTagRuleInput,
  type AutoTagStatus,
  type AutoTagProperty
} from '@shared/models'
import { getDb } from '../database/connection'
import * as autoTagRepo from '../database/repositories/autoTag.repository'
import * as tagRepo from '../database/repositories/tag.repository'
import { AppError } from '../errors'
import { notifyEntitiesChanged } from '../events/entityEvents'
import { logError } from '../logging/logger'
import { readImageProperties } from './mediaHash'
import { readSourceFolder, resolveRoute } from './sourceFolder'

const BATCH_SIZE = 20

let running: Promise<void> | null = null
let runAgain = false

/**
 * Reads size and transparency for every picture that hasn't had them read
 * yet - the whole library the first time, then each new file. Batches yield
 * to the event loop like the hash backfill. Calls while a pass runs just ask
 * for one more pass afterwards, so a file added mid-pass isn't missed.
 */
export function analyzeNewFiles(): Promise<void> {
  if (running) {
    runAgain = true
    return running
  }
  running = (async (): Promise<void> => {
    do {
      runAgain = false
      await analyzePass()
    } while (runAgain)
  })()
    .catch((err) => logError('autoTags', 'File analysis failed', err))
    .finally(() => {
      running = null
    })
  return running
}

async function analyzePass(): Promise<void> {
  const db = getDb()
  const sourceFolder = readSourceFolder()
  let analyzed = false
  for (;;) {
    const rows = await autoTagRepo.listUnanalyzedMedia(db, BATCH_SIZE)
    if (rows.length === 0) break
    for (const row of rows) {
      const properties = await readImageProperties(resolveRoute(row.route, sourceFolder))
      await autoTagRepo.setFileProperties(
        db,
        row.id,
        properties ?? { width: 0, height: 0, hasAlpha: false }
      )
    }
    analyzed = true
    await new Promise((resolve) => setImmediate(resolve))
  }
  // Counts and filters by a rule's tag just changed.
  if (analyzed) notifyEntitiesChanged(['tag'])
}

export async function getAutoTagStatus(): Promise<AutoTagStatus> {
  const db = getDb()
  const [rules, unanalyzed] = await Promise.all([
    autoTagRepo.listRules(db),
    autoTagRepo.countUnanalyzedMedia(db)
  ])
  return {
    rules: rules.map((rule) => ({
      property: rule.property as AutoTagProperty,
      tagId: rule.tag_id
    })),
    unanalyzed
  }
}

export async function setAutoTagRule({ property, tagId }: AutoTagRuleInput): Promise<void> {
  const db = getDb()
  if (tagId === null) {
    await autoTagRepo.deleteRule(db, property)
  } else {
    if (!(await tagRepo.findTagsByIds(db, [tagId])).length) {
      throw new AppError('MISSING_TAG', 'That tag no longer exists.')
    }
    await autoTagRepo.setRule(db, property, tagId)
  }
  notifyEntitiesChanged(['tag'])
}

/** Same comparison the renderer's matchEntityNames uses: case, underscores and spacing don't count. */
function normalizeName(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim()
}

/** "transparent background" -> "Transparent Background", as tags created from suggestions read. */
function titleCase(value: string): string {
  return value.replace(
    /(^|\s)([a-z])/g,
    (_match, boundary: string, letter: string) => boundary + letter.toUpperCase()
  )
}

/**
 * Fills every rule still off that has a Danbooru tag (DANBOORU_DEFAULT_TAGS)
 * with it: the library's tag of that name or alias, else a new one. Rules
 * already set are left alone. One transaction, one change notice.
 */
export async function applyDanbooruDefaults(): Promise<void> {
  const db = getDb()
  await db.transaction().execute(async (trx) => {
    const ruled = new Set((await autoTagRepo.listRules(trx)).map((rule) => rule.property))
    const tags = await tagRepo.findAllTags(trx)
    for (const property of AUTO_TAG_PROPERTIES) {
      const name = DANBOORU_DEFAULT_TAGS[property]
      if (!name || ruled.has(property)) continue
      const wanted = normalizeName(name)
      let tag = tags.find((candidate) =>
        [candidate.name, ...(JSON.parse(candidate.aliases_json) as string[])].some(
          (value) => normalizeName(value) === wanted
        )
      )
      if (!tag) {
        tag = await tagRepo.insertTag(trx, {
          id: randomUUID(),
          name: titleCase(name),
          aliases_json: '[]',
          created_at: Date.now()
        })
        tags.push(tag)
      }
      await autoTagRepo.setRule(trx, property, tag.id)
    }
  })
  notifyEntitiesChanged(['tag'])
}

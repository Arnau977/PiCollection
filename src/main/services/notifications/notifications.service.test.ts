import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let userDataDir = ''
let updaterStatus: unknown = null
const pushed = vi.fn()

vi.mock('electron', () => ({ app: { getPath: () => userDataDir, isPackaged: false } }))
vi.mock('../../events/notificationEvents', () => ({ notifyNotificationsChanged: pushed }))
vi.mock('../../events/autoBackupEvents', () => ({ notifyAutoBackupChanged: vi.fn() }))
vi.mock('../../updater/autoUpdater', () => ({ getStatus: () => updaterStatus }))

const { initTestDbSingleton } = await import('../../database/testHelpers')
const { getDb } = await import('../../database/connection')
const { refreshNotifications, snoozeNotification, SNOOZE_MS, __resetNotificationsForTests } =
  await import('./notifications.service')
const { resetNotificationSettingsCache, readSnoozes } = await import('./notificationSettings')
const { resetAutoBackupSettingsCache, updateAutoBackupSettings } = await import(
  '../autoBackupSettings'
)

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000
let cleanupDb: () => Promise<void>

async function addPending(id: string, createdAt: number): Promise<void> {
  await getDb()
    .insertInto('media')
    .values({
      id,
      name: id,
      sfw: 1,
      is_ai_generated: 0,
      type: 'image',
      route: `${id}.png`,
      alias: null,
      artist_id: null,
      created_at: createdAt,
      hash: null,
      phash: null,
      pending_tagging: 1
    })
    .execute()
}

beforeEach(async () => {
  userDataDir = await fs.mkdtemp(join(tmpdir(), 'notifications-test-'))
  resetNotificationSettingsCache()
  resetAutoBackupSettingsCache()
  __resetNotificationsForTests()
  updaterStatus = null
  pushed.mockReset()
  ;({ cleanup: cleanupDb } = await initTestDbSingleton())
})

afterEach(async () => {
  await cleanupDb()
  await fs.rm(userDataDir, { recursive: true, force: true })
})

describe('notifications', () => {
  it('lists Pending only once its oldest item is 7 days old', async () => {
    await addPending('a', NOW - 6 * DAY_MS)
    expect(await refreshNotifications(NOW)).toEqual([])

    await addPending('b', NOW - 7 * DAY_MS)
    expect(await refreshNotifications(NOW)).toEqual([
      {
        kind: 'pending-stale',
        severity: 'info',
        snoozable: true,
        count: 2,
        since: NOW - 7 * DAY_MS
      }
    ])
  })

  it('lists a failed backup only while automatic backups are on, and never snoozes it', async () => {
    updateAutoBackupSettings({ enabled: false, lastError: 'disk full' })
    expect(await refreshNotifications(NOW)).toEqual([])

    updateAutoBackupSettings({ enabled: true })
    expect(await refreshNotifications(NOW)).toEqual([
      { kind: 'backup-failed', severity: 'attention', snoozable: false }
    ])
    expect(await snoozeNotification('backup-failed', NOW)).toHaveLength(1)
  })

  it('snoozes for 7 days, resurfaces early when the count grows, and forgets the snooze once resolved', async () => {
    await addPending('a', NOW - 8 * DAY_MS)
    expect(await snoozeNotification('pending-stale', NOW)).toEqual([])
    expect(await refreshNotifications(NOW + SNOOZE_MS - 1)).toEqual([])
    expect(await refreshNotifications(NOW + SNOOZE_MS)).toHaveLength(1)

    await snoozeNotification('pending-stale', NOW)
    await addPending('b', NOW - 8 * DAY_MS)
    expect(await refreshNotifications(NOW + DAY_MS)).toHaveLength(1)

    await getDb().deleteFrom('media').execute()
    await refreshNotifications(NOW + DAY_MS)
    expect(readSnoozes()['pending-stale']).toBeUndefined()
  })

  it('ignores a snooze for a kind that is not listed', async () => {
    await snoozeNotification('pending-stale', NOW)
    expect(readSnoozes()['pending-stale']).toBeUndefined()
  })

  it('treats Pending as unknown while the DB is closed: no throw, snooze kept', async () => {
    await addPending('a', NOW - 8 * DAY_MS)
    await snoozeNotification('pending-stale', NOW)
    await cleanupDb() // closes the DB, as a restore does
    await expect(refreshNotifications(NOW)).resolves.toEqual([])
    expect(readSnoozes()['pending-stale']).toBeDefined()
    ;({ cleanup: cleanupDb } = await initTestDbSingleton())
  })

  it('lists an available update and pushes only when the list changes', async () => {
    updaterStatus = { type: 'available', version: '2.0.0', highlights: null, isDowngrade: false }
    await refreshNotifications(NOW)
    await refreshNotifications(NOW)
    expect(pushed).toHaveBeenCalledTimes(1)
    expect(pushed).toHaveBeenCalledWith([
      { kind: 'update-available', severity: 'info', snoozable: true, version: '2.0.0' }
    ])
  })

  it('serializes overlapping refreshes so pushes stay in order', async () => {
    await addPending('a', NOW - 8 * DAY_MS)
    await Promise.all([
      refreshNotifications(NOW),
      refreshNotifications(NOW),
      refreshNotifications(NOW)
    ])
    expect(pushed).toHaveBeenCalledTimes(1)
  })
})

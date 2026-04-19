import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createVideoRepository } from '../../../src/main/repositories/videoRepository'

describe('migration 002: import from electron-store', () => {
  let db

  beforeEach(() => {
    db = openDatabase(':memory:')
  })
  afterEach(() => closeDatabase(db))

  it('imports videos from legacy scheduleCache shape', () => {
    const legacyCache = {
      data: {
        live: [
          {
            id: 'LV1',
            status: 'live',
            title: 'Live Now',
            channelTitle: 'Ch',
            channelId: 'UC1',
            description: '',
            thumbnail: 'x',
            scheduledStartTime: '2026-04-18T10:00:00Z',
            actualStartTime: '2026-04-18T10:05:00Z',
            concurrentViewers: null,
            url: 'https://www.youtube.com/watch?v=LV1',
            channelUrl: 'https://www.youtube.com/channel/UC1'
          }
        ],
        upcoming: [
          {
            id: 'UP1',
            status: 'upcoming',
            title: 'Upcoming',
            channelTitle: 'Ch',
            channelId: 'UC1',
            description: '',
            thumbnail: 'x',
            scheduledStartTime: '2026-04-20T10:00:00Z',
            actualStartTime: null,
            concurrentViewers: null,
            url: 'https://www.youtube.com/watch?v=UP1',
            channelUrl: 'https://www.youtube.com/channel/UC1'
          }
        ]
      },
      timestamp: 1_700_000_000_000
    }
    const legacyReader = { read: () => legacyCache, clear: () => {} }
    runMigrations(db, { legacyStoreReader: legacyReader })

    const repo = createVideoRepository(db)
    expect(repo.getById('LV1')).not.toBeNull()
    expect(repo.getById('UP1')).not.toBeNull()
  })

  it('clears legacy store after successful import', () => {
    let cleared = false
    const legacyReader = {
      read: () => ({ data: { live: [], upcoming: [] }, timestamp: 1 }),
      clear: () => {
        cleared = true
      }
    }
    runMigrations(db, { legacyStoreReader: legacyReader })
    expect(cleared).toBe(true)
  })

  it('is safe when legacy store is empty', () => {
    const legacyReader = { read: () => null, clear: () => {} }
    expect(() => runMigrations(db, { legacyStoreReader: legacyReader })).not.toThrow()
  })

  it('is idempotent: second run does not re-import or fail', () => {
    let readCount = 0
    const legacyReader = {
      read: () => {
        readCount += 1
        return { data: { live: [], upcoming: [] }, timestamp: 1 }
      },
      clear: () => {}
    }
    runMigrations(db, { legacyStoreReader: legacyReader })
    runMigrations(db, { legacyStoreReader: legacyReader })
    expect(readCount).toBe(1)
  })
})

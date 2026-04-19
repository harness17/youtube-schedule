import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createVideoRepository } from '../../../src/main/repositories/videoRepository'

function sampleVideo(overrides = {}) {
  return {
    id: 'abc123',
    channelId: 'UCxxx',
    channelTitle: 'Test Channel',
    title: 'Test Video',
    description: 'desc',
    thumbnail: 'https://example.com/t.jpg',
    status: 'upcoming',
    scheduledStartTime: Date.now() + 60 * 60 * 1000,
    actualStartTime: null,
    concurrentViewers: null,
    url: 'https://www.youtube.com/watch?v=abc123',
    firstSeenAt: Date.now(),
    lastCheckedAt: Date.now(),
    ...overrides
  }
}

describe('VideoRepository', () => {
  let db, repo

  beforeEach(() => {
    db = openDatabase(':memory:')
    runMigrations(db)
    repo = createVideoRepository(db)
  })
  afterEach(() => closeDatabase(db))

  it('upserts and retrieves a video by id', () => {
    repo.upsert(sampleVideo({ id: 'v1' }))
    const got = repo.getById('v1')
    expect(got).not.toBeNull()
    expect(got.title).toBe('Test Video')
  })

  it('returns null for a missing id', () => {
    expect(repo.getById('missing')).toBeNull()
  })

  it('does not duplicate on repeated upsert', () => {
    repo.upsert(sampleVideo({ id: 'v1' }))
    repo.upsert(sampleVideo({ id: 'v1', title: 'Updated' }))
    expect(repo.count()).toBe(1)
    expect(repo.getById('v1').title).toBe('Updated')
  })

  it('listVisible returns future upcoming and recent live', () => {
    const now = Date.now()
    repo.upsert(sampleVideo({ id: 'up1', status: 'upcoming', scheduledStartTime: now + 3600e3 }))
    repo.upsert(
      sampleVideo({ id: 'up2', status: 'upcoming', scheduledStartTime: now - 3 * 3600e3 })
    )
    repo.upsert(sampleVideo({ id: 'lv1', status: 'live', actualStartTime: now - 3600e3 }))
    repo.upsert(
      sampleVideo({ id: 'lv2', status: 'live', actualStartTime: now - 25 * 3600e3 })
    )
    repo.upsert(sampleVideo({ id: 'en1', status: 'ended' }))

    const visible = repo.listVisible(now)
    const ids = visible.map((v) => v.id)
    expect(ids).toContain('up1')
    expect(ids).toContain('lv1')
    expect(ids).not.toContain('up2')
    expect(ids).not.toContain('lv2')
    expect(ids).not.toContain('en1')
  })

  it('boundary: upcoming exactly 2h in the past is excluded', () => {
    const now = 1_700_000_000_000
    repo.upsert(
      sampleVideo({
        id: 'b1',
        status: 'upcoming',
        scheduledStartTime: now - 2 * 3600e3
      })
    )
    expect(repo.listVisible(now).map((v) => v.id)).not.toContain('b1')
  })

  it('boundary: live exactly 24h old is excluded', () => {
    const now = 1_700_000_000_000
    repo.upsert(
      sampleVideo({
        id: 'b2',
        status: 'live',
        actualStartTime: now - 24 * 3600e3
      })
    )
    expect(repo.listVisible(now).map((v) => v.id)).not.toContain('b2')
  })

  it('getByIds returns matching records only', () => {
    repo.upsert(sampleVideo({ id: 'a' }))
    repo.upsert(sampleVideo({ id: 'b' }))
    const got = repo.getByIds(['a', 'z'])
    expect(got.map((v) => v.id)).toEqual(['a'])
  })

  it('deleteExpiredEnded removes ended videos older than threshold', () => {
    const now = 1_700_000_000_000
    repo.upsert(
      sampleVideo({ id: 'old', status: 'ended', lastCheckedAt: now - 31 * 24 * 3600e3 })
    )
    repo.upsert(
      sampleVideo({ id: 'fresh', status: 'ended', lastCheckedAt: now - 10 * 24 * 3600e3 })
    )
    const removed = repo.deleteExpiredEnded(now - 30 * 24 * 3600e3)
    expect(removed).toBe(1)
    expect(repo.getById('old')).toBeNull()
    expect(repo.getById('fresh')).not.toBeNull()
  })
})

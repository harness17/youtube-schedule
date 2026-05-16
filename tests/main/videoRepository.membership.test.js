import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { migrations } from '../../src/main/db/schema.js'
import { createVideoRepository } from '../../src/main/repositories/videoRepository.js'

function makeDb() {
  const db = new Database(':memory:')
  for (const m of migrations) m.up(db)
  return db
}

function videoRecord(overrides) {
  return {
    id: 'v1',
    channelId: 'c1',
    channelTitle: 'Channel One',
    title: 'Title',
    description: '',
    thumbnail: '',
    status: 'upcoming',
    scheduledStartTime: 5000,
    actualStartTime: null,
    concurrentViewers: null,
    url: 'https://example.com',
    firstSeenAt: 1000,
    lastCheckedAt: 1000,
    duration: null,
    publishedAt: null,
    source: 'api',
    ...overrides
  }
}

describe('videoRepository is_membership_only', () => {
  let db, repo
  beforeEach(() => {
    db = makeDb()
    repo = createVideoRepository(db)
  })

  it('defaults isMembershipOnly to false when not provided', () => {
    repo.upsert(videoRecord({ id: 'v1' }))
    expect(repo.getById('v1').isMembershipOnly).toBe(false)
  })

  it('stores and returns isMembershipOnly true', () => {
    repo.upsert(videoRecord({ id: 'v1', isMembershipOnly: true, source: 'manual' }))
    const video = repo.getById('v1')
    expect(video.isMembershipOnly).toBe(true)
    expect(video.source).toBe('manual')
  })

  it('keeps isMembershipOnly true after a later upsert that omits the flag', () => {
    repo.upsert(videoRecord({ id: 'v1', isMembershipOnly: true, source: 'manual' }))
    // スケジューラの再フェッチ相当（フラグ無し・status 更新）
    repo.upsert(videoRecord({ id: 'v1', status: 'live', actualStartTime: 6000 }))
    expect(repo.getById('v1').isMembershipOnly).toBe(true)
  })
})

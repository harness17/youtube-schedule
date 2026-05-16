import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { migrations } from '../../src/main/db/schema.js'
import { createVideoRepository } from '../../src/main/repositories/videoRepository.js'

function makeDb() {
  const db = new Database(':memory:')
  for (const m of migrations) m.up(db)
  return db
}

function insertEndedVideo(repo, overrides) {
  repo.upsert({
    id: 'v1',
    channelId: 'c1',
    channelTitle: 'Channel One',
    title: 'Title',
    description: '',
    thumbnail: '',
    status: 'ended',
    scheduledStartTime: null,
    actualStartTime: null,
    concurrentViewers: null,
    url: 'https://example.com',
    firstSeenAt: 1000,
    lastCheckedAt: 1000,
    duration: null,
    source: 'api',
    ...overrides
  })
}

describe('listArchive filters and sort', () => {
  let db, repo
  beforeEach(() => {
    db = makeDb()
    repo = createVideoRepository(db)
  })

  it('filters by multiple channels', () => {
    insertEndedVideo(repo, { id: 'a', channelId: 'c1' })
    insertEndedVideo(repo, { id: 'b', channelId: 'c2' })
    insertEndedVideo(repo, { id: 'c', channelId: 'c3' })
    const rows = repo.listArchive({ channelIds: ['c1', 'c3'] })
    expect(rows.map((r) => r.id).sort()).toEqual(['a', 'c'])
  })

  it('always excludes cancelled scheduled streams but keeps aired streams and normal uploads', () => {
    // 配信されたライブ（actual あり）→ 残す
    insertEndedVideo(repo, { id: 'aired', actualStartTime: 5000, scheduledStartTime: 4000 })
    // 流れた配信（予約枠あり・未配信）→ 除外
    insertEndedVideo(repo, { id: 'cancelled', actualStartTime: null, scheduledStartTime: 5000 })
    // 通常アップロード（actual も scheduled も無し）→ 残す
    insertEndedVideo(repo, { id: 'upload', actualStartTime: null, scheduledStartTime: null })
    const rows = repo.listArchive({})
    expect(rows.map((r) => r.id).sort()).toEqual(['aired', 'upload'])
  })

  it('filters by period (ended_at within range)', () => {
    insertEndedVideo(repo, { id: 'old', lastCheckedAt: 1000 })
    insertEndedVideo(repo, { id: 'recent', lastCheckedAt: 9000 })
    const rows = repo.listArchive({ periodStart: 5000 })
    expect(rows.map((r) => r.id)).toEqual(['recent'])
  })

  it('sorts uploads by published_at when actual/scheduled times are absent', () => {
    // 通常アップロード（actual/scheduled 無し）。published_at で並ぶことを確認。
    // lastCheckedAt の順とは逆にしておき、published_at が効いていることを検証する。
    insertEndedVideo(repo, { id: 'newpub', lastCheckedAt: 1000, publishedAt: 9000 })
    insertEndedVideo(repo, { id: 'oldpub', lastCheckedAt: 2000, publishedAt: 3000 })
    const rows = repo.listArchive({ sort: 'newest' })
    expect(rows.map((r) => r.id)).toEqual(['newpub', 'oldpub'])
  })

  it('sorts by duration descending with NULL last', () => {
    insertEndedVideo(repo, { id: 'short', lastCheckedAt: 1000, duration: 60 })
    insertEndedVideo(repo, { id: 'long', lastCheckedAt: 2000, duration: 600 })
    insertEndedVideo(repo, { id: 'unknown', lastCheckedAt: 3000, duration: null })
    const rows = repo.listArchive({ sort: 'duration' })
    expect(rows.map((r) => r.id)).toEqual(['long', 'short', 'unknown'])
  })

  it('sorts by oldest first', () => {
    insertEndedVideo(repo, { id: 'old', lastCheckedAt: 1000 })
    insertEndedVideo(repo, { id: 'new', lastCheckedAt: 9000 })
    const rows = repo.listArchive({ sort: 'oldest' })
    expect(rows.map((r) => r.id)).toEqual(['old', 'new'])
  })

  it('defaults to newest first when no sort given', () => {
    insertEndedVideo(repo, { id: 'old', lastCheckedAt: 1000 })
    insertEndedVideo(repo, { id: 'new', lastCheckedAt: 9000 })
    const rows = repo.listArchive({})
    expect(rows.map((r) => r.id)).toEqual(['new', 'old'])
  })

  it('keeps text query working alongside filters', () => {
    insertEndedVideo(repo, { id: 'match', channelId: 'c1', title: 'special keyword' })
    insertEndedVideo(repo, { id: 'nomatch', channelId: 'c1', title: 'other' })
    const rows = repo.listArchive({ query: 'keyword', channelIds: ['c1'] })
    expect(rows.map((r) => r.id)).toEqual(['match'])
  })
})

describe('archive backfill', () => {
  let db, repo
  beforeEach(() => {
    db = makeDb()
    repo = createVideoRepository(db)
  })

  it('listBackfillTargetIds returns ended videos missing duration or published_at', () => {
    insertEndedVideo(repo, { id: 'needs', duration: null, publishedAt: null })
    insertEndedVideo(repo, { id: 'has-duration-only', duration: 100, publishedAt: null })
    insertEndedVideo(repo, { id: 'complete', duration: 100, publishedAt: 5000 })
    const ids = repo.listBackfillTargetIds().sort()
    expect(ids).toEqual(['has-duration-only', 'needs'])
  })

  it('backfillMeta updates duration and published_at without touching other fields', () => {
    insertEndedVideo(repo, { id: 'v1', title: 'Original', duration: null, publishedAt: null })
    repo.backfillMeta('v1', { duration: 360, publishedAt: 7000 })
    const video = repo.getById('v1')
    expect(video.duration).toBe(360)
    expect(video.publishedAt).toBe(7000)
    expect(video.title).toBe('Original')
    expect(video.status).toBe('ended')
  })

  it('backfillMeta keeps existing values when passed null (COALESCE)', () => {
    insertEndedVideo(repo, { id: 'v1', duration: 120, publishedAt: 3000 })
    repo.backfillMeta('v1', { duration: null, publishedAt: null })
    const video = repo.getById('v1')
    expect(video.duration).toBe(120)
    expect(video.publishedAt).toBe(3000)
  })
})

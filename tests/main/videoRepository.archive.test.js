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

  it('filters by video type live-done (actual_start_time present)', () => {
    insertEndedVideo(repo, { id: 'aired', actualStartTime: 5000 })
    insertEndedVideo(repo, { id: 'notaired', actualStartTime: null, scheduledStartTime: 5000 })
    const rows = repo.listArchive({ videoType: 'live-done' })
    expect(rows.map((r) => r.id)).toEqual(['aired'])
  })

  it('filters by video type didnt-air', () => {
    insertEndedVideo(repo, { id: 'aired', actualStartTime: 5000 })
    insertEndedVideo(repo, { id: 'notaired', actualStartTime: null, scheduledStartTime: 5000 })
    const rows = repo.listArchive({ videoType: 'didnt-air' })
    expect(rows.map((r) => r.id)).toEqual(['notaired'])
  })

  it('filters by period (ended_at within range)', () => {
    insertEndedVideo(repo, { id: 'old', lastCheckedAt: 1000 })
    insertEndedVideo(repo, { id: 'recent', lastCheckedAt: 9000 })
    const rows = repo.listArchive({ periodStart: 5000 })
    expect(rows.map((r) => r.id)).toEqual(['recent'])
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

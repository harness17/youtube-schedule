import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createVideoQueries } from '../../../src/main/repositories/videoQueries'
import { createVideoRepository } from '../../../src/main/repositories/videoRepository'

const NOW = 1_700_000_000_000

function sampleVideo(overrides = {}) {
  const id = overrides.id ?? 'v1'
  return {
    id,
    channelId: overrides.channelId ?? 'UC1',
    channelTitle: overrides.channelTitle ?? 'Channel 1',
    title: overrides.title ?? `Video ${id}`,
    description: overrides.description ?? '',
    thumbnail: overrides.thumbnail ?? 'https://example.com/thumb.jpg',
    status: overrides.status ?? 'ended',
    scheduledStartTime: overrides.scheduledStartTime ?? null,
    actualStartTime: overrides.actualStartTime ?? NOW - 1000,
    concurrentViewers: overrides.concurrentViewers ?? null,
    url: overrides.url ?? `https://www.youtube.com/watch?v=${id}`,
    firstSeenAt: overrides.firstSeenAt ?? NOW - 2000,
    lastCheckedAt: overrides.lastCheckedAt ?? NOW - 1000,
    duration: overrides.duration ?? null,
    publishedAt: overrides.publishedAt ?? null,
    ...overrides
  }
}

describe('VideoQueries', () => {
  let db, queries, videos

  beforeEach(() => {
    db = openDatabase(':memory:')
    runMigrations(db)
    queries = createVideoQueries(db)
    videos = createVideoRepository(db)
  })

  afterEach(() => closeDatabase(db))

  it('listVisible returns recent live and future upcoming videos', () => {
    videos.upsert(
      sampleVideo({ id: 'live', status: 'live', actualStartTime: NOW - 60 * 60 * 1000 })
    )
    videos.upsert(
      sampleVideo({
        id: 'upcoming',
        status: 'upcoming',
        scheduledStartTime: NOW + 60 * 60 * 1000,
        actualStartTime: null
      })
    )
    videos.upsert(
      sampleVideo({ id: 'old-live', status: 'live', actualStartTime: NOW - 25 * 60 * 60 * 1000 })
    )
    videos.upsert(sampleVideo({ id: 'ended', status: 'ended' }))

    expect(queries.listVisible(NOW).map((video) => video.id)).toEqual(['live', 'upcoming'])
  })

  it('listArchive combines channel, period, and text filters', () => {
    videos.upsert(
      sampleVideo({
        id: 'match',
        channelId: 'UC_TARGET',
        title: 'special keyword',
        actualStartTime: NOW - 1000
      })
    )
    videos.upsert(
      sampleVideo({
        id: 'other-channel',
        channelId: 'UC_OTHER',
        title: 'special keyword',
        actualStartTime: NOW - 1000
      })
    )
    videos.upsert(
      sampleVideo({
        id: 'old',
        channelId: 'UC_TARGET',
        title: 'special keyword',
        actualStartTime: NOW - 10_000
      })
    )

    const rows = queries.listArchive({
      query: 'keyword',
      channelIds: ['UC_TARGET'],
      periodStart: NOW - 5000
    })

    expect(rows.map((row) => row.id)).toEqual(['match'])
  })

  it('searchByText escapes LIKE wildcard characters', () => {
    videos.upsert(sampleVideo({ id: 'literal-percent', title: '100% endurance' }))
    videos.upsert(sampleVideo({ id: 'plain', title: '100 percent endurance' }))

    expect(queries.searchByText('%').map((video) => video.id)).toEqual(['literal-percent'])
    expect(queries.searchByText('_').map((video) => video.id)).toEqual([])
  })
})

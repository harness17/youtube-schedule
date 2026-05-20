import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createChannelRepository } from '../../../src/main/repositories/channelRepository'
import { createVideoRepository } from '../../../src/main/repositories/videoRepository'
import { createStatsRepository } from '../../../src/main/repositories/statsRepository'

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-05-20T00:00:00Z')

function sampleVideo(overrides = {}) {
  const id = overrides.id ?? 'v1'
  return {
    id,
    channelId: overrides.channelId ?? 'UC1',
    channelTitle: overrides.channelTitle ?? 'Channel 1',
    title: overrides.title ?? `Video ${id}`,
    description: '',
    thumbnail: 'https://example.com/thumb.jpg',
    status: overrides.status ?? 'ended',
    scheduledStartTime: null,
    actualStartTime: overrides.actualStartTime ?? NOW - DAY_MS,
    concurrentViewers: null,
    url: `https://www.youtube.com/watch?v=${id}`,
    firstSeenAt: NOW - DAY_MS,
    lastCheckedAt: NOW,
    publishedAt: overrides.publishedAt ?? null,
    ...overrides
  }
}

describe('StatsRepository', () => {
  let db, channels, videos, stats

  beforeEach(() => {
    db = openDatabase(':memory:')
    runMigrations(db)
    channels = createChannelRepository(db)
    videos = createVideoRepository(db)
    stats = createStatsRepository(db)
  })

  afterEach(() => closeDatabase(db))

  it('unwatched pinned includes 29 and 30 day activity but excludes 31 day activity', () => {
    channels.syncSubscriptions([{ id: 'UC_PIN', title: 'Pinned', uploadsPlaylistId: 'UU_PIN' }], 1)
    channels.togglePin('UC_PIN')

    videos.upsert(
      sampleVideo({ id: 'd29', channelId: 'UC_PIN', actualStartTime: NOW - 29 * DAY_MS })
    )
    videos.upsert(
      sampleVideo({ id: 'd30', channelId: 'UC_PIN', actualStartTime: NOW - 30 * DAY_MS })
    )
    videos.upsert(
      sampleVideo({ id: 'd31', channelId: 'UC_PIN', actualStartTime: NOW - 31 * DAY_MS })
    )
    videos.markViewed('d29', NOW)

    const ids = stats.getChannelActivity(NOW).unwatchedPinned.map((video) => video.id)
    expect(ids).toEqual(['d30'])
  })

  it('silent channels exclude 59 days and include 60 and 61 days', () => {
    channels.syncSubscriptions(
      [
        { id: 'UC_59', title: 'Active', uploadsPlaylistId: 'UU_59' },
        { id: 'UC_60', title: 'Boundary', uploadsPlaylistId: 'UU_60' },
        { id: 'UC_61', title: 'Silent', uploadsPlaylistId: 'UU_61' }
      ],
      1
    )

    videos.upsert(
      sampleVideo({ id: 'v59', channelId: 'UC_59', actualStartTime: NOW - 59 * DAY_MS })
    )
    videos.upsert(
      sampleVideo({ id: 'v60', channelId: 'UC_60', actualStartTime: NOW - 60 * DAY_MS })
    )
    videos.upsert(
      sampleVideo({ id: 'v61', channelId: 'UC_61', actualStartTime: NOW - 61 * DAY_MS })
    )

    const ids = stats
      .getChannelActivity(NOW)
      .silentChannels.map((channel) => channel.id)
      .sort()
    expect(ids).toEqual(['UC_60', 'UC_61'])
  })

  it('frequency ranking includes 89 and 90 day activity but excludes 91 day activity', () => {
    videos.upsert(sampleVideo({ id: 'd89', channelId: 'UC_A', actualStartTime: NOW - 89 * DAY_MS }))
    videos.upsert(sampleVideo({ id: 'd90', channelId: 'UC_A', actualStartTime: NOW - 90 * DAY_MS }))
    videos.upsert(sampleVideo({ id: 'd91', channelId: 'UC_A', actualStartTime: NOW - 91 * DAY_MS }))

    const ranking = stats.getChannelActivity(NOW).frequencyRanking
    expect(ranking).toHaveLength(1)
    expect(ranking[0]).toMatchObject({ channelId: 'UC_A', count: 2 })
  })

  it('classifies silent channels as pinned, manual, and other', () => {
    channels.syncSubscriptions(
      [
        { id: 'UC_PIN', title: 'Pinned', uploadsPlaylistId: 'UU_PIN' },
        { id: 'UC_OTHER', title: 'Other', uploadsPlaylistId: 'UU_OTHER' }
      ],
      1
    )
    channels.togglePin('UC_PIN')
    channels.addManual({ id: 'UC_MANUAL', title: 'Manual', uploadsPlaylistId: 'UU_MANUAL' })

    videos.upsert(sampleVideo({ id: 'p', channelId: 'UC_PIN', actualStartTime: NOW - 61 * DAY_MS }))
    videos.upsert(
      sampleVideo({ id: 'm', channelId: 'UC_MANUAL', actualStartTime: NOW - 61 * DAY_MS })
    )
    videos.upsert(
      sampleVideo({ id: 'o', channelId: 'UC_OTHER', actualStartTime: NOW - 61 * DAY_MS })
    )

    const byId = Object.fromEntries(
      stats.getChannelActivity(NOW).silentChannels.map((channel) => [channel.id, channel.category])
    )
    expect(byId).toMatchObject({
      UC_PIN: 'pinned',
      UC_MANUAL: 'manual',
      UC_OTHER: 'other'
    })
  })

  it('uses the later value of actual_start_time and published_at as activity time', () => {
    channels.syncSubscriptions([{ id: 'UC1', title: 'Channel', uploadsPlaylistId: 'UU1' }], 1)

    videos.upsert(
      sampleVideo({
        id: 'published-newer',
        channelId: 'UC1',
        actualStartTime: NOW - 61 * DAY_MS,
        publishedAt: NOW - 10 * DAY_MS
      })
    )

    expect(stats.getChannelActivity(NOW).silentChannels.map((channel) => channel.id)).toEqual([])
  })
})

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

  it('viewed rates include ended pinned streams at 29 and 30 days but exclude 31 days', () => {
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
    videos.markViewed('d31', NOW)

    expect(stats.getChannelActivity(NOW).viewedRates).toEqual([
      expect.objectContaining({
        channelId: 'UC_PIN',
        totalCount: 2,
        viewedCount: 1,
        unviewedCount: 1,
        viewedRate: 50
      })
    ])
  })

  it('viewed rates exclude unpinned, upcoming, and regular video records', () => {
    channels.syncSubscriptions(
      [
        { id: 'UC_PIN', title: 'Pinned', uploadsPlaylistId: 'UU_PIN' },
        { id: 'UC_OTHER', title: 'Other', uploadsPlaylistId: 'UU_OTHER' }
      ],
      1
    )
    channels.togglePin('UC_PIN')

    videos.upsert(sampleVideo({ id: 'ended', channelId: 'UC_PIN' }))
    videos.upsert(sampleVideo({ id: 'other', channelId: 'UC_OTHER' }))
    videos.upsert(
      sampleVideo({
        id: 'upcoming',
        channelId: 'UC_PIN',
        status: 'upcoming',
        actualStartTime: null,
        scheduledStartTime: NOW + DAY_MS
      })
    )
    videos.upsert(
      sampleVideo({
        id: 'upload',
        channelId: 'UC_PIN',
        actualStartTime: null,
        scheduledStartTime: null,
        publishedAt: NOW - DAY_MS
      })
    )

    expect(stats.getChannelActivity(NOW).viewedRates).toEqual([
      expect.objectContaining({ channelId: 'UC_PIN', totalCount: 1 })
    ])
  })

  it('viewed rates sort by lowest rate, then highest stream count', () => {
    channels.syncSubscriptions(
      [
        { id: 'UC_ZERO_MANY', title: 'Zero Many', uploadsPlaylistId: 'UU_1' },
        { id: 'UC_ZERO_ONE', title: 'Zero One', uploadsPlaylistId: 'UU_2' },
        { id: 'UC_HALF', title: 'Half', uploadsPlaylistId: 'UU_3' }
      ],
      1
    )
    for (const id of ['UC_ZERO_MANY', 'UC_ZERO_ONE', 'UC_HALF']) channels.togglePin(id)

    videos.upsert(sampleVideo({ id: 'zm1', channelId: 'UC_ZERO_MANY' }))
    videos.upsert(sampleVideo({ id: 'zm2', channelId: 'UC_ZERO_MANY' }))
    videos.upsert(sampleVideo({ id: 'zo1', channelId: 'UC_ZERO_ONE' }))
    videos.upsert(sampleVideo({ id: 'h1', channelId: 'UC_HALF' }))
    videos.upsert(sampleVideo({ id: 'h2', channelId: 'UC_HALF' }))
    videos.markViewed('h1', NOW)

    expect(
      stats
        .getChannelActivity(NOW)
        .viewedRates.map((row) => [row.channelId, row.viewedRate, row.totalCount])
    ).toEqual([
      ['UC_ZERO_MANY', 0, 2],
      ['UC_ZERO_ONE', 0, 1],
      ['UC_HALF', 50, 2]
    ])
  })

  it('unviewed backlog counts recent ended streams and excludes invalid records', () => {
    channels.syncSubscriptions(
      [
        { id: 'UC_BACKLOG', title: 'Backlog', uploadsPlaylistId: 'UU_BACKLOG' },
        { id: 'UC_DELETED', title: 'Deleted', uploadsPlaylistId: 'UU_DELETED' }
      ],
      1
    )
    channels.togglePin('UC_BACKLOG')

    videos.upsert(
      sampleVideo({ id: 'b29', channelId: 'UC_BACKLOG', actualStartTime: NOW - 29 * DAY_MS })
    )
    videos.upsert(
      sampleVideo({ id: 'b30', channelId: 'UC_BACKLOG', actualStartTime: NOW - 30 * DAY_MS })
    )
    videos.toggleNotify('b30')
    videos.upsert(
      sampleVideo({ id: 'b31', channelId: 'UC_BACKLOG', actualStartTime: NOW - 31 * DAY_MS })
    )
    videos.upsert(sampleVideo({ id: 'viewed', channelId: 'UC_BACKLOG' }))
    videos.markViewed('viewed', NOW)
    videos.upsert(
      sampleVideo({
        id: 'upcoming-backlog',
        channelId: 'UC_BACKLOG',
        status: 'upcoming',
        actualStartTime: null,
        scheduledStartTime: NOW + DAY_MS
      })
    )
    videos.upsert(
      sampleVideo({
        id: 'upload-backlog',
        channelId: 'UC_BACKLOG',
        actualStartTime: null,
        scheduledStartTime: null,
        publishedAt: NOW - DAY_MS
      })
    )
    videos.upsert(sampleVideo({ id: 'deleted-video', channelId: 'UC_DELETED' }))
    channels.delete('UC_DELETED')

    expect(stats.getChannelActivity(NOW).unviewedBacklog).toEqual([
      expect.objectContaining({
        channelId: 'UC_BACKLOG',
        unviewedCount: 2,
        notifyCount: 1,
        oldestActivityAt: NOW - 30 * DAY_MS,
        isPinned: true
      })
    ])
  })

  it('unviewed backlog sorts by highest count then oldest activity', () => {
    channels.syncSubscriptions(
      [
        { id: 'UC_MANY', title: 'Many', uploadsPlaylistId: 'UU_MANY' },
        { id: 'UC_OLD', title: 'Old', uploadsPlaylistId: 'UU_OLD' },
        { id: 'UC_NEW', title: 'New', uploadsPlaylistId: 'UU_NEW' }
      ],
      1
    )

    videos.upsert(
      sampleVideo({ id: 'many-1', channelId: 'UC_MANY', actualStartTime: NOW - DAY_MS })
    )
    videos.upsert(
      sampleVideo({ id: 'many-2', channelId: 'UC_MANY', actualStartTime: NOW - 2 * DAY_MS })
    )
    videos.upsert(
      sampleVideo({ id: 'old-1', channelId: 'UC_OLD', actualStartTime: NOW - 20 * DAY_MS })
    )
    videos.upsert(
      sampleVideo({ id: 'new-1', channelId: 'UC_NEW', actualStartTime: NOW - 5 * DAY_MS })
    )

    const backlogOrder = stats
      .getChannelActivity(NOW)
      .unviewedBacklog.map((row) => [row.channelId, row.unviewedCount])
    expect(backlogOrder).toEqual([
      ['UC_MANY', 2],
      ['UC_OLD', 1],
      ['UC_NEW', 1]
    ])
  })

  it('favorite channels count saved videos and sort by favorite then viewed count', () => {
    channels.syncSubscriptions(
      [
        { id: 'UC_FAV_A', title: 'Favorite A', uploadsPlaylistId: 'UU_A' },
        { id: 'UC_FAV_B', title: 'Favorite B', uploadsPlaylistId: 'UU_B' }
      ],
      1
    )
    channels.togglePin('UC_FAV_A')

    videos.upsert(sampleVideo({ id: 'fa1', channelId: 'UC_FAV_A' }))
    videos.upsert(sampleVideo({ id: 'fa2', channelId: 'UC_FAV_A' }))
    videos.upsert(sampleVideo({ id: 'not-favorite', channelId: 'UC_FAV_A' }))
    videos.upsert(sampleVideo({ id: 'fb1', channelId: 'UC_FAV_B' }))
    videos.toggleFavorite('fa1')
    videos.toggleFavorite('fa2')
    videos.toggleFavorite('fb1')
    videos.markViewed('fa1', NOW)
    videos.markViewed('fb1', NOW)

    expect(stats.getChannelActivity(NOW).favoriteChannels).toEqual([
      expect.objectContaining({
        channelId: 'UC_FAV_A',
        favoriteCount: 2,
        viewedCount: 1,
        isPinned: true
      }),
      expect.objectContaining({
        channelId: 'UC_FAV_B',
        favoriteCount: 1,
        viewedCount: 1,
        isPinned: false
      })
    ])
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

  it('uses scheduled_start_time when actual_start_time is missing (upcoming streams)', () => {
    channels.syncSubscriptions([{ id: 'UC_UP', title: 'Upcoming', uploadsPlaylistId: 'UU_UP' }], 1)

    // 未開始の配信予約だけがあるチャンネル: actual_start_time は NULL、scheduled_start_time のみ
    videos.upsert(
      sampleVideo({
        id: 'sched',
        channelId: 'UC_UP',
        status: 'upcoming',
        actualStartTime: null,
        scheduledStartTime: NOW - 10 * DAY_MS
      })
    )

    // scheduled が直近なので沈黙チャンネルには出ない
    expect(stats.getChannelActivity(NOW).silentChannels.map((channel) => channel.id)).toEqual([])
  })

  it('excludes regular video uploads (no actual_start_time and no scheduled_start_time)', () => {
    channels.syncSubscriptions(
      [
        { id: 'UC_UPLOAD', title: 'UploadOnly', uploadsPlaylistId: 'UU_UP' },
        { id: 'UC_LIVE', title: 'LiveChannel', uploadsPlaylistId: 'UU_LV' }
      ],
      1
    )
    channels.togglePin('UC_UPLOAD')
    channels.togglePin('UC_LIVE')

    // 通常動画投稿: actual も scheduled も null、published_at のみ
    videos.upsert(
      sampleVideo({
        id: 'upload-only',
        channelId: 'UC_UPLOAD',
        status: 'ended',
        actualStartTime: null,
        scheduledStartTime: null,
        publishedAt: NOW - 5 * DAY_MS
      })
    )
    // 配信: actual_start_time あり
    videos.upsert(
      sampleVideo({
        id: 'live-one',
        channelId: 'UC_LIVE',
        status: 'ended',
        actualStartTime: NOW - 5 * DAY_MS
      })
    )

    const activity = stats.getChannelActivity(NOW)

    // 推し見落としには配信のみが出る
    expect(activity.unwatchedPinned.map((video) => video.id)).toEqual(['live-one'])
    // ランキングも配信のみ
    expect(activity.frequencyRanking.map((row) => row.channelId)).toEqual(['UC_LIVE'])
    // 沈黙チャンネル: UploadOnly は配信実績ゼロなので「沈黙」の対象外、UC_LIVE は直近5日で対象外
    expect(activity.silentChannels.map((channel) => channel.id)).not.toContain('UC_UPLOAD')
    expect(activity.silentChannels.map((channel) => channel.id)).not.toContain('UC_LIVE')
  })

  it('includes channels with any old activity (upload or livestream) in silent list', () => {
    channels.syncSubscriptions(
      [
        { id: 'UC_OLD_UPLOAD', title: 'OldUploadOnly', uploadsPlaylistId: 'UU_OLD' },
        { id: 'UC_OLD_LIVE', title: 'OldLive', uploadsPlaylistId: 'UU_OLDL' },
        { id: 'UC_NO_DATA', title: 'NoRecords', uploadsPlaylistId: 'UU_NONE' }
      ],
      1
    )

    // 古い動画投稿のみのチャンネル（actual/scheduled 共に null、published_at のみ）→ 沈黙対象
    videos.upsert(
      sampleVideo({
        id: 'old-upload',
        channelId: 'UC_OLD_UPLOAD',
        status: 'ended',
        actualStartTime: null,
        scheduledStartTime: null,
        publishedAt: NOW - 200 * DAY_MS
      })
    )
    // 古い配信実績があるチャンネル → 沈黙対象
    videos.upsert(
      sampleVideo({
        id: 'old-live',
        channelId: 'UC_OLD_LIVE',
        status: 'ended',
        actualStartTime: NOW - 200 * DAY_MS
      })
    )
    // UC_NO_DATA: 動画レコードなし → 投稿実績ゼロ、沈黙対象外

    const silentIds = stats.getChannelActivity(NOW).silentChannels.map((channel) => channel.id)
    expect(silentIds).toContain('UC_OLD_LIVE')
    expect(silentIds).toContain('UC_OLD_UPLOAD')
    expect(silentIds).not.toContain('UC_NO_DATA')
  })
})

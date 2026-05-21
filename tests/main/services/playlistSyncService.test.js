import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createChannelRepository } from '../../../src/main/repositories/channelRepository'
import { createPlaylistRepository } from '../../../src/main/repositories/playlistRepository'
import { createVideoRepository } from '../../../src/main/repositories/videoRepository'
import { createPlaylistSyncService } from '../../../src/main/services/playlistSyncService'

const NOW = 1_700_000_000_000

function playlistItem(videoId, overrides = {}) {
  return {
    videoId,
    snippet: {
      title: `Title ${videoId}`,
      description: `Description ${videoId}`,
      publishedAt: '2026-05-01T00:00:00Z',
      videoOwnerChannelId: overrides.channelId ?? 'UC_NEW',
      videoOwnerChannelTitle: overrides.channelTitle ?? 'New Channel',
      thumbnails: { high: { url: `https://example.com/${videoId}.jpg` } },
      ...(overrides.snippet ?? {})
    },
    contentDetails: { videoId }
  }
}

function videoRecord(id, overrides = {}) {
  return {
    id,
    channelId: overrides.channelId ?? 'UC_EXISTING',
    channelTitle: overrides.channelTitle ?? 'Existing Channel',
    title: overrides.title ?? `Existing ${id}`,
    description: '',
    thumbnail: '',
    status: 'ended',
    scheduledStartTime: null,
    actualStartTime: null,
    concurrentViewers: null,
    url: `https://www.youtube.com/watch?v=${id}`,
    firstSeenAt: NOW - 1000,
    lastCheckedAt: NOW - 1000,
    duration: null,
    publishedAt: null,
    source: 'api'
  }
}

function videoDetail(id, overrides = {}) {
  return {
    id,
    snippet: {
      title: `Detail ${id}`,
      description: '',
      channelId: overrides.channelId ?? 'UC_NEW',
      channelTitle: overrides.channelTitle ?? 'New Channel',
      publishedAt: '2026-05-01T00:00:00Z',
      liveBroadcastContent: overrides.liveBroadcastContent ?? 'none'
    },
    liveStreamingDetails: overrides.liveStreamingDetails,
    contentDetails: { duration: 'PT10M' }
  }
}

describe('PlaylistSyncService', () => {
  let db, playlistRepo, videoRepo, channelRepo, fetcher

  beforeEach(() => {
    db = openDatabase(':memory:')
    runMigrations(db)
    playlistRepo = createPlaylistRepository(db)
    videoRepo = createVideoRepository(db)
    channelRepo = createChannelRepository(db)
    fetcher = { fetchPlaylistItems: vi.fn() }
  })

  afterEach(() => closeDatabase(db))

  function service(authClient = {}) {
    return createPlaylistSyncService({
      playlistRepo,
      videoRepo,
      channelRepo,
      playlistFetcher: fetcher,
      authClient,
      now: () => NOW
    })
  }

  it('skips refresh when playlist sync is not configured or disabled', async () => {
    await expect(service().refresh()).resolves.toMatchObject({
      skipped: true,
      reason: 'not-configured'
    })
    playlistRepo.setConfig({ playlistId: 'PL1', enabled: false })
    await expect(service().refresh()).resolves.toMatchObject({
      skipped: true,
      reason: 'not-configured'
    })
    expect(fetcher.fetchPlaylistItems).not.toHaveBeenCalled()
  })

  it('skips refresh when there is no OAuth client', async () => {
    playlistRepo.setConfig({ playlistId: 'PL1', enabled: true })
    await expect(service(null).refresh()).resolves.toMatchObject({
      skipped: true,
      reason: 'not-authenticated'
    })
  })

  it('imports playlist items by upserting real videos before applying the diff', async () => {
    playlistRepo.setConfig({ playlistId: 'PL1', playlistTitle: 'Playlist', enabled: true })
    fetcher.fetchPlaylistItems.mockResolvedValue([playlistItem('V1')])

    const upsert = vi.spyOn(videoRepo, 'upsert')
    const applyDiff = vi.spyOn(playlistRepo, 'applyDiff')
    const result = await service().refresh()

    expect(result).toEqual({ added: 1, removed: 0, restored: 0 })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'V1',
        channelId: 'UC_NEW',
        title: 'Title V1',
        url: 'https://www.youtube.com/watch?v=V1'
      })
    )
    expect(upsert.mock.invocationCallOrder[0]).toBeLessThan(applyDiff.mock.invocationCallOrder[0])
    expect(playlistRepo.getPlaylistVideoIds()).toEqual(new Set(['V1']))
    expect(playlistRepo.getConfig().lastSyncedAt).toBe(NOW)
  })

  it('corrects imported playlist video status from videos.list details', async () => {
    playlistRepo.setConfig({ playlistId: 'PL1', enabled: true })
    fetcher.fetchPlaylistItems.mockResolvedValue([playlistItem('UPCOMING'), playlistItem('LIVE')])
    const videoDetailsFetcher = {
      fetch: vi.fn().mockResolvedValue([
        videoDetail('UPCOMING', {
          liveBroadcastContent: 'upcoming',
          liveStreamingDetails: { scheduledStartTime: '2026-05-21T10:00:00Z' }
        }),
        videoDetail('LIVE', {
          liveBroadcastContent: 'live',
          liveStreamingDetails: {
            actualStartTime: new Date(NOW - 60_000).toISOString(),
            concurrentViewers: '123'
          }
        })
      ])
    }

    const result = await createPlaylistSyncService({
      playlistRepo,
      videoRepo,
      channelRepo,
      playlistFetcher: fetcher,
      videoDetailsFetcher,
      authClient: {},
      ytFactory: (auth) => ({ auth }),
      now: () => NOW
    }).refresh()

    expect(result).toEqual({ added: 2, removed: 0, restored: 0 })
    expect(videoDetailsFetcher.fetch).toHaveBeenCalledWith({ auth: {} }, ['UPCOMING', 'LIVE'])
    expect(videoRepo.getById('UPCOMING')).toMatchObject({
      status: 'upcoming',
      scheduledStartTime: Date.parse('2026-05-21T10:00:00Z')
    })
    expect(videoRepo.getById('LIVE')).toMatchObject({
      status: 'live',
      actualStartTime: NOW - 60_000,
      concurrentViewers: 123
    })
  })

  it('creates a minimal channel row for unknown playlist item channels', async () => {
    playlistRepo.setConfig({ playlistId: 'PL1', enabled: true })
    fetcher.fetchPlaylistItems.mockResolvedValue([
      playlistItem('V1', { channelId: 'UC_UNKNOWN', channelTitle: 'Unknown Channel' })
    ])
    await service().refresh()
    const channel = channelRepo.listAll().find((c) => c.id === 'UC_UNKNOWN')
    expect(channel).toMatchObject({
      id: 'UC_UNKNOWN',
      title: 'Unknown Channel',
      uploadsPlaylistId: ''
    })
  })

  it('detects added, removed, and restored playlist videos', async () => {
    playlistRepo.setConfig({ playlistId: 'PL1', enabled: true })
    videoRepo.upsert(videoRecord('KEEP'))
    videoRepo.upsert(videoRecord('REMOVE'))
    videoRepo.upsert(videoRecord('RESTORE'))
    playlistRepo.applyDiff({ added: ['KEEP', 'REMOVE', 'RESTORE'] }, NOW - 2000)
    playlistRepo.applyDiff({ removed: ['RESTORE'] }, NOW - 1000)

    fetcher.fetchPlaylistItems.mockResolvedValue([
      playlistItem('KEEP'),
      playlistItem('RESTORE'),
      playlistItem('ADD')
    ])
    const result = await service().refresh()

    expect(result).toEqual({ added: 1, removed: 1, restored: 1 })
    expect(playlistRepo.getPlaylistVideoIds()).toEqual(new Set(['KEEP', 'RESTORE', 'ADD']))
    expect(playlistRepo.getRemovedPlaylistVideoIds()).toEqual(new Set(['REMOVE']))
  })

  it('skips automatic refresh while last sync is fresh', async () => {
    playlistRepo.setConfig({ playlistId: 'PL1', enabled: true })
    playlistRepo.updateLastSyncedAt(NOW - 60_000)
    const result = await service().refreshIfDue()
    expect(result).toMatchObject({ skipped: true, reason: 'fresh' })
    expect(fetcher.fetchPlaylistItems).not.toHaveBeenCalled()
  })
})

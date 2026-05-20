import { describe, it, expect, vi } from 'vitest'
import { createSchedulerService } from '../../../src/main/services/schedulerService'

function videoDetail(id, overrides = {}) {
  return {
    id,
    snippet: {
      title: `t-${id}`,
      channelTitle: 'C',
      channelId: 'UC1',
      description: '',
      thumbnails: { high: { url: 'u' } },
      liveBroadcastContent: 'upcoming',
      ...(overrides.snippet || {})
    },
    liveStreamingDetails: {
      scheduledStartTime: new Date(Date.now() + 3600_000).toISOString(),
      ...(overrides.liveStreamingDetails || {})
    }
  }
}

function createMocks() {
  const videoRepo = {
    upsert: vi.fn(),
    getByIds: vi.fn().mockReturnValue([]),
    listVisible: vi.fn().mockReturnValue([]),
    listManualTrackingIds: vi.fn().mockReturnValue([]),
    markEnded: vi.fn(),
    deleteExpiredEnded: vi.fn()
  }
  const channelRepo = {
    getLastSyncTime: vi.fn().mockReturnValue(0),
    listAll: vi.fn().mockReturnValue([]),
    syncSubscriptions: vi.fn(),
    upsertSeen: vi.fn()
  }
  const rssLogRepo = { record: vi.fn() }
  const metaRepo = { get: vi.fn(), set: vi.fn() }
  const subsFetcher = {
    fetch: vi.fn().mockResolvedValue([{ id: 'UC1', title: 'C', uploadsPlaylistId: 'UU1' }])
  }
  const rssFetcher = {
    fetch: vi.fn().mockResolvedValue({ success: true, videoIds: ['V1'], httpStatus: 200 })
  }
  const playlistFetcher = { fetch: vi.fn().mockResolvedValue([]) }
  const videoFetcher = { fetch: vi.fn().mockResolvedValue([videoDetail('V1')]) }

  return {
    videoRepo,
    channelRepo,
    rssLogRepo,
    metaRepo,
    subsFetcher,
    rssFetcher,
    playlistFetcher,
    videoFetcher
  }
}

function createService(mocks, overrides = {}) {
  return createSchedulerService({
    videoRepo: mocks.videoRepo,
    channelRepo: mocks.channelRepo,
    rssLogRepo: mocks.rssLogRepo,
    metaRepo: mocks.metaRepo,
    subsFetcher: mocks.subsFetcher,
    rssFetcher: mocks.rssFetcher,
    playlistFetcher: mocks.playlistFetcher,
    videoFetcher: mocks.videoFetcher,
    authClient: {},
    ytFactory: () => ({}),
    ...overrides
  })
}

describe('SchedulerService.refresh', () => {
  it('fetches subscriptions when cache is stale', async () => {
    const mocks = createMocks()
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.subsFetcher.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.channelRepo.syncSubscriptions).toHaveBeenCalledTimes(1)
  })

  it('skips subscriptions fetch when cache is fresh (< 24h)', async () => {
    const mocks = createMocks()
    mocks.channelRepo.getLastSyncTime.mockReturnValue(Date.now() - 60_000)
    mocks.channelRepo.listAll.mockReturnValue([{ id: 'UC1', title: 'C', uploadsPlaylistId: 'UU1' }])
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.subsFetcher.fetch).not.toHaveBeenCalled()
  })

  it('uses RSS first; falls back to playlist on RSS failure', async () => {
    const mocks = createMocks()
    mocks.channelRepo.getLastSyncTime.mockReturnValue(Date.now() - 60_000)
    mocks.channelRepo.listAll.mockReturnValue([
      { id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' },
      { id: 'UC2', title: 'B', uploadsPlaylistId: 'UU2' }
    ])
    mocks.rssFetcher.fetch = vi
      .fn()
      .mockResolvedValueOnce({ success: true, videoIds: ['V1'], httpStatus: 200 })
      .mockResolvedValueOnce({ success: false, reason: 'http_404', httpStatus: 404 })
    mocks.playlistFetcher.fetch = vi.fn().mockResolvedValue(['V2'])

    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.rssFetcher.fetch).toHaveBeenCalledTimes(2)
    expect(mocks.playlistFetcher.fetch).toHaveBeenCalledTimes(1)
  })

  it('skips playlist fallback while a channel is in RSS fallback cooldown', async () => {
    const mocks = createMocks()
    const now = Date.now()
    mocks.channelRepo.getLastSyncTime.mockReturnValue(now - 60_000)
    mocks.channelRepo.listAll.mockReturnValue([{ id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' }])
    mocks.rssFetcher.fetch = vi
      .fn()
      .mockResolvedValue({ success: false, reason: 'http_404', httpStatus: 404 })
    mocks.metaRepo.get = vi.fn((key) => (key === 'rss_fallback_at:UC1' ? String(now) : null))

    const svc = createService(mocks)
    await svc.refresh()

    expect(mocks.playlistFetcher.fetch).not.toHaveBeenCalled()
  })

  it('limits playlist fallback attempts per refresh to protect daily quota', async () => {
    const mocks = createMocks()
    const channels = Array.from({ length: 25 }, (_, i) => ({
      id: `UC${String(i).padStart(2, '0')}`,
      title: `C${i}`,
      uploadsPlaylistId: `UU${i}`
    }))
    mocks.channelRepo.getLastSyncTime.mockReturnValue(Date.now() - 60_000)
    mocks.channelRepo.listAll.mockReturnValue(channels)
    mocks.rssFetcher.fetch = vi
      .fn()
      .mockResolvedValue({ success: false, reason: 'http_404', httpStatus: 404 })
    mocks.playlistFetcher.fetch = vi.fn().mockResolvedValue([])

    const svc = createService(mocks)
    await svc.refresh()

    expect(mocks.playlistFetcher.fetch).toHaveBeenCalledTimes(20)
  })

  it('records RSS outcomes to the log repository', async () => {
    const mocks = createMocks()
    mocks.channelRepo.getLastSyncTime.mockReturnValue(Date.now() - 60_000)
    mocks.channelRepo.listAll.mockReturnValue([{ id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' }])
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.rssLogRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: 'UC1', success: true })
    )
  })

  it('does not allow concurrent refresh (lock guard)', async () => {
    const mocks = createMocks()
    let resolveFetch
    mocks.subsFetcher.fetch = vi.fn().mockReturnValue(
      new Promise((r) => {
        resolveFetch = () => r([{ id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' }])
      })
    )
    const svc = createService(mocks)
    const p1 = svc.refresh()
    const p2 = svc.refresh()
    resolveFetch()
    await p1
    await p2
    expect(mocks.subsFetcher.fetch).toHaveBeenCalledTimes(1)
  })

  it('upserts fetched videos with derived status', async () => {
    const mocks = createMocks()
    mocks.channelRepo.getLastSyncTime.mockReturnValue(Date.now() - 60_000)
    mocks.channelRepo.listAll.mockReturnValue([{ id: 'UC1', title: 'C', uploadsPlaylistId: 'UU1' }])
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.videoRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'V1', status: 'upcoming' })
    )
  })

  it('runs cleanup when last_cleanup_at is older than 24h', async () => {
    const mocks = createMocks()
    mocks.metaRepo.get = vi.fn((key) =>
      key === 'last_cleanup_at' ? String(Date.now() - 25 * 3600_000) : null
    )
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.videoRepo.deleteExpiredEnded).toHaveBeenCalledTimes(1)
    expect(mocks.videoRepo.deleteExpiredEnded).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultThreshold: expect.any(Number),
        notifyThreshold: expect.any(Number)
      })
    )
    expect(mocks.metaRepo.set).toHaveBeenCalledWith(
      'last_cleanup_at',
      expect.any(String),
      expect.any(Number)
    )
  })

  it('skips cleanup when last_cleanup_at is within 24h', async () => {
    const mocks = createMocks()
    mocks.metaRepo.get = vi.fn((key) =>
      key === 'last_cleanup_at' ? String(Date.now() - 60_000) : null
    )
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.videoRepo.deleteExpiredEnded).not.toHaveBeenCalled()
  })

  it('runs cleanup on first run when no last_cleanup_at exists', async () => {
    const mocks = createMocks()
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.videoRepo.deleteExpiredEnded).toHaveBeenCalledTimes(1)
  })

  it('calls cleanup with 30d default and 90d notify thresholds', async () => {
    const mocks = createMocks()
    const svc = createService(mocks)
    await svc.refresh()
    const call = mocks.videoRepo.deleteExpiredEnded.mock.calls[0][0]
    expect(call.defaultThreshold - call.notifyThreshold).toBe(60 * 24 * 3600 * 1000)
  })

  it('marks orphaned live videos as ended when API returns nothing', async () => {
    // V1 は RSS に出る通常動画、ORPHAN は DB に live で残るがRSSに出ない動画
    const mocks = createMocks()
    mocks.rssFetcher.fetch.mockResolvedValue({ success: true, videoIds: ['V1'], httpStatus: 200 })
    mocks.videoRepo.getByIds.mockReturnValue([])
    // listVisible で ORPHAN が live のまま残っている
    mocks.videoRepo.listVisible.mockReturnValue([{ id: 'ORPHAN' }])
    // videoFetcher の1回目（V1用）と2回目（ORPHAN孤立チェック用）を区別
    mocks.videoFetcher.fetch
      .mockResolvedValueOnce([videoDetail('V1')]) // 通常fetch
      .mockResolvedValueOnce([]) // ORPHAN は API からも消えている
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.videoRepo.markEnded).toHaveBeenCalledWith('ORPHAN', expect.any(Number))
  })

  it('calls upsertSeen for each video processed', async () => {
    const mocks = createMocks()
    mocks.channelRepo.getLastSyncTime.mockReturnValue(Date.now() - 60_000)
    mocks.channelRepo.listAll.mockReturnValue([{ id: 'UC1', title: 'C', uploadsPlaylistId: 'UU1' }])
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.channelRepo.upsertSeen).toHaveBeenCalledWith('UC1', 'C')
  })

  it('does not recheck ended videos older than 24h', async () => {
    const mocks = createMocks()
    mocks.channelRepo.getLastSyncTime.mockReturnValue(Date.now() - 60_000)
    mocks.channelRepo.listAll.mockReturnValue([{ id: 'UC1', title: 'C', uploadsPlaylistId: 'UU1' }])
    mocks.rssFetcher.fetch.mockResolvedValue({ success: true, videoIds: ['V1'], httpStatus: 200 })
    mocks.videoRepo.getByIds.mockReturnValue([
      { id: 'V1', status: 'ended', lastCheckedAt: Date.now() - 25 * 3600_000 }
    ])
    mocks.videoFetcher.fetch.mockResolvedValue([])
    const svc = createService(mocks)
    await svc.refresh()
    const [, calledIds] = mocks.videoFetcher.fetch.mock.calls[0]
    expect(calledIds).toEqual([])
  })

  it('upserts orphaned live video if API still returns it (e.g. delayed RSS)', async () => {
    const mocks = createMocks()
    mocks.rssFetcher.fetch.mockResolvedValue({ success: true, videoIds: ['V1'], httpStatus: 200 })
    mocks.videoRepo.getByIds.mockReturnValue([])
    mocks.videoRepo.listVisible.mockReturnValue([{ id: 'ORPHAN' }])
    mocks.videoFetcher.fetch
      .mockResolvedValueOnce([videoDetail('V1')])
      .mockResolvedValueOnce([videoDetail('ORPHAN')]) // API にはまだある
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.videoRepo.markEnded).not.toHaveBeenCalled()
    expect(mocks.videoRepo.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'ORPHAN' }))
  })

  it('uses RSS-only mode without fetching subscriptions or video details when authClient is null', async () => {
    const mocks = createMocks()
    mocks.channelRepo.listAll.mockReturnValue([
      { id: 'UC1', title: 'Manual', uploadsPlaylistId: 'UU1' }
    ])
    mocks.rssFetcher.fetch.mockResolvedValue({
      success: true,
      videoIds: ['V1'],
      entries: [{ id: 'V1', title: 'RSS title', channelTitle: 'Manual' }],
      httpStatus: 200
    })
    const svc = createService(mocks, { authClient: null })
    await svc.refresh()
    expect(mocks.subsFetcher.fetch).not.toHaveBeenCalled()
    expect(mocks.videoFetcher.fetch).not.toHaveBeenCalled()
    expect(mocks.videoRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'V1',
        title: 'RSS title',
        status: 'upcoming',
        scheduledStartTime: null
      })
    )
  })

  it('uses RSS-only mode for stored channels even when uploadsPlaylistId is missing', async () => {
    const mocks = createMocks()
    mocks.channelRepo.listAll.mockReturnValue([{ id: 'UC_MANUAL_ONLY', title: 'Stored Channel' }])
    mocks.rssFetcher.fetch.mockResolvedValue({
      success: true,
      videoIds: ['V1'],
      entries: [{ id: 'V1', title: 'RSS title' }],
      httpStatus: 200
    })
    const svc = createService(mocks, { authClient: null })
    await svc.refresh()
    expect(mocks.rssFetcher.fetch).toHaveBeenCalledWith('UC_MANUAL_ONLY')
    expect(mocks.videoRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'V1',
        channelId: 'UC_MANUAL_ONLY',
        channelTitle: 'Stored Channel'
      })
    )
  })

  it('uses RSS published time as feed sort timestamp in RSS-only mode', async () => {
    const mocks = createMocks()
    mocks.channelRepo.listAll.mockReturnValue([{ id: 'UC1', title: 'C' }])
    mocks.rssFetcher.fetch.mockResolvedValue({
      success: true,
      videoIds: ['V1'],
      entries: [
        {
          id: 'V1',
          title: 'RSS title',
          published: '2026-05-05T10:00:00Z',
          updated: '2026-05-05T11:00:00Z'
        }
      ],
      httpStatus: 200
    })
    const svc = createService(mocks, { authClient: null })
    await svc.refresh()
    expect(mocks.videoRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'V1',
        firstSeenAt: new Date('2026-05-05T10:00:00Z').getTime()
      })
    )
  })

  it('no-auth モードで RSS entries をチャンネルあたり 10 件に絞る', async () => {
    const mocks = createMocks()
    // 15 件の entries を返すモック
    const entries = Array.from({ length: 15 }, (_, i) => ({
      id: `V${i + 1}`,
      title: `Title ${i + 1}`,
      description: '',
      url: `https://www.youtube.com/watch?v=V${i + 1}`,
      published: null,
      channelTitle: 'C'
    }))
    mocks.rssFetcher.fetch.mockResolvedValue({
      success: true,
      videoIds: entries.map((e) => e.id),
      entries,
      httpStatus: 200
    })
    mocks.channelRepo.listAll.mockReturnValue([{ id: 'UC1', title: 'C' }])
    const svc = createService(mocks, { authClient: null })
    await svc.refresh()
    // upsert の呼び出し回数が 10 件以下であること
    expect(mocks.videoRepo.upsert.mock.calls.length).toBeLessThanOrEqual(10)
  })
})

describe('SchedulerService quota handling', () => {
  it('クォータ 403 エラーを握り潰し、quota_exceeded_at を記録する', async () => {
    const mocks = createMocks()
    const quotaErr = Object.assign(new Error('you have exceeded your quota'), { code: 403 })
    mocks.subsFetcher.fetch = vi.fn().mockRejectedValue(quotaErr)
    const svc = createService(mocks)
    await expect(svc.refresh()).resolves.toBeUndefined()
    expect(mocks.metaRepo.set).toHaveBeenCalledWith(
      'quota_exceeded_at',
      expect.any(String),
      expect.any(Number)
    )
  })

  it('クォータ以外のエラーは投げ直す', async () => {
    const mocks = createMocks()
    mocks.subsFetcher.fetch = vi.fn().mockRejectedValue(new Error('boom'))
    const svc = createService(mocks)
    await expect(svc.refresh()).rejects.toThrow('boom')
  })

  it('取得成功時に記録済みの quota_exceeded_at をクリアする', async () => {
    const mocks = createMocks()
    mocks.metaRepo.get = vi.fn((key) => (key === 'quota_exceeded_at' ? String(Date.now()) : null))
    const svc = createService(mocks)
    await svc.refresh()
    expect(mocks.metaRepo.set).toHaveBeenCalledWith('quota_exceeded_at', '', expect.any(Number))
  })

  it('getQuotaStatus: 直近の超過はリセット前なら exceeded=true', () => {
    const mocks = createMocks()
    mocks.metaRepo.get = vi.fn((key) => (key === 'quota_exceeded_at' ? String(Date.now()) : null))
    const svc = createService(mocks)
    const status = svc.getQuotaStatus()
    expect(status.exceeded).toBe(true)
    expect(status.resetAt).toBeGreaterThan(Date.now())
  })

  it('getQuotaStatus: リセット時刻を過ぎていれば exceeded=false', () => {
    const mocks = createMocks()
    mocks.metaRepo.get = vi.fn((key) =>
      key === 'quota_exceeded_at' ? String(Date.now() - 2 * 24 * 3600_000) : null
    )
    const svc = createService(mocks)
    expect(svc.getQuotaStatus().exceeded).toBe(false)
  })

  it('getQuotaStatus: 記録が無ければ exceeded=false', () => {
    const mocks = createMocks()
    mocks.metaRepo.get = vi.fn().mockReturnValue(null)
    const svc = createService(mocks)
    expect(svc.getQuotaStatus()).toEqual({ exceeded: false, resetAt: null })
  })
})

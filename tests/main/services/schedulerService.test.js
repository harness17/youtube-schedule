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
    markEnded: vi.fn(),
    deleteExpiredEnded: vi.fn()
  }
  const channelRepo = {
    getLastSyncTime: vi.fn().mockReturnValue(0),
    listAll: vi.fn().mockReturnValue([]),
    replaceAll: vi.fn()
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
    expect(mocks.channelRepo.replaceAll).toHaveBeenCalledTimes(1)
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
})

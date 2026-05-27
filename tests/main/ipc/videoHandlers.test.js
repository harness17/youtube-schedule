import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, ipcMainHandle, normalizeManualChannelInput } = vi.hoisted(() => {
  const handlers = new Map()
  return {
    handlers,
    ipcMainHandle: vi.fn((channel, handler) => handlers.set(channel, handler)),
    normalizeManualChannelInput: vi.fn()
  }
})

vi.mock('electron', () => ({
  ipcMain: { handle: ipcMainHandle }
}))

vi.mock('../../../src/main/services/channelInput.js', () => ({
  normalizeManualChannelInput
}))

const { registerVideoHandlers } = await import('../../../src/main/ipc/videoHandlers')

function invoke(channel, ...args) {
  return handlers.get(channel)({}, ...args)
}

describe('videoHandlers', () => {
  let videoRepo
  let channelRepo
  let rssLogRepo
  let scheduler
  let mainWindow
  let isFullMode
  let dbBroken

  beforeEach(() => {
    handlers.clear()
    ipcMainHandle.mockClear()
    normalizeManualChannelInput.mockReset()
    videoRepo = {
      listVisible: vi.fn().mockReturnValue([
        { id: 'live-1', status: 'live' },
        { id: 'upcoming-1', status: 'upcoming' },
        { id: 'ended-1', status: 'ended' }
      ]),
      listFeed: vi.fn().mockReturnValue([{ id: 'feed-1' }]),
      listMissed: vi.fn().mockReturnValue([{ id: 'missed-1' }]),
      listArchive: vi.fn().mockReturnValue([{ id: 'archive-1' }]),
      listFavorites: vi.fn().mockReturnValue([{ id: 'favorite-1' }]),
      saveFavoriteOrder: vi.fn().mockReturnValue(true),
      searchByText: vi.fn().mockReturnValue([{ id: 'search-1' }]),
      markViewed: vi.fn().mockReturnValue(true),
      clearViewed: vi.fn().mockReturnValue(true),
      toggleFavorite: vi.fn().mockReturnValue({ id: 'video-1', isFavorite: true }),
      toggleNotify: vi.fn().mockReturnValue({ id: 'video-1', notify: true })
    }
    channelRepo = {
      togglePin: vi.fn().mockReturnValue({ id: 'UC1', isPinned: true }),
      listAll: vi.fn().mockReturnValue([{ id: 'UC1' }]),
      addManual: vi.fn().mockReturnValue({ id: 'UC2' }),
      delete: vi.fn().mockReturnValue(true)
    }
    rssLogRepo = { getFailureRateSince: vi.fn().mockReturnValue(0.25) }
    scheduler = {
      refresh: vi.fn().mockResolvedValue(undefined),
      getQuotaStatus: vi.fn().mockReturnValue({ exceeded: true, resetAt: 123 }),
      addManualVideo: vi.fn().mockResolvedValue({ ok: true, video: { id: 'manual-video' } })
    }
    mainWindow = { webContents: { send: vi.fn() } }
    isFullMode = false
    dbBroken = false
    registerVideoHandlers({
      getVideoRepo: () => videoRepo,
      getChannelRepo: () => channelRepo,
      getRssLogRepo: () => rssLogRepo,
      getScheduler: () => scheduler,
      getIsFullMode: () => isFullMode,
      getDbBroken: () => dbBroken,
      getMainWindow: () => mainWindow
    })
  })

  it('registers all schedule, diagnostic, video, and channel IPC channels', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'channels:addManual',
      'channels:delete',
      'channels:listAll',
      'channels:syncNow',
      'channels:togglePin',
      'diag:quotaStatus',
      'diag:rssFailureRate',
      'schedule:feed',
      'schedule:get',
      'schedule:refresh',
      'videos:addManual',
      'videos:clearViewed',
      'videos:listArchive',
      'videos:listFavorites',
      'videos:listMissed',
      'videos:markViewed',
      'videos:saveFavoriteOrder',
      'videos:searchByText',
      'videos:toggleFavorite',
      'videos:toggleNotify'
    ])
  })

  it('schedule:get splits visible videos into live and upcoming groups', () => {
    expect(invoke('schedule:get')).toEqual({
      live: [{ id: 'live-1', status: 'live' }],
      upcoming: [{ id: 'upcoming-1', status: 'upcoming' }]
    })
  })

  it('schedule:feed lists simple-mode feed videos with a fixed limit', () => {
    expect(invoke('schedule:feed')).toEqual({ videos: [{ id: 'feed-1' }] })
    expect(videoRepo.listFeed).toHaveBeenCalledWith(50)
  })

  it('schedule:refresh forces a full recheck and broadcasts schedule:updated', async () => {
    await expect(invoke('schedule:refresh')).resolves.toEqual({ ok: true })
    expect(scheduler.refresh).toHaveBeenCalledWith({ forceFullRecheck: true })
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('schedule:updated')
  })

  it('schedule:refresh hides unexpected scheduler failures behind REFRESH_FAILED', async () => {
    scheduler.refresh.mockRejectedValue(new Error('internal path leak'))

    await expect(invoke('schedule:refresh')).resolves.toEqual({ error: 'REFRESH_FAILED' })
  })

  it('diag:quotaStatus returns scheduler quota state or a default state', () => {
    expect(invoke('diag:quotaStatus')).toEqual({ exceeded: true, resetAt: 123 })

    registerVideoHandlers({
      getVideoRepo: () => videoRepo,
      getChannelRepo: () => channelRepo,
      getRssLogRepo: () => rssLogRepo,
      getScheduler: () => null,
      getIsFullMode: () => false,
      getDbBroken: () => false,
      getMainWindow: () => mainWindow
    })
    expect(invoke('diag:quotaStatus')).toEqual({ exceeded: false, resetAt: null })
  })

  it('diag:rssFailureRate reads the last 24 hours from the RSS log repository', () => {
    expect(invoke('diag:rssFailureRate')).toBe(0.25)
    expect(rssLogRepo.getFailureRateSince).toHaveBeenCalledWith(expect.any(Number))
  })

  it('videos:listMissed delegates to the video repository', () => {
    expect(invoke('videos:listMissed')).toEqual([{ id: 'missed-1' }])
  })

  it('videos:listArchive passes options to the video repository', () => {
    expect(invoke('videos:listArchive', { limit: 10 })).toEqual([{ id: 'archive-1' }])
    expect(videoRepo.listArchive).toHaveBeenCalledWith({ limit: 10 })
  })

  it('videos:addManual delegates to scheduler.addManualVideo', async () => {
    await expect(invoke('videos:addManual', { url: 'https://youtu.be/abc' })).resolves.toEqual({
      ok: true,
      video: { id: 'manual-video' }
    })
    expect(scheduler.addManualVideo).toHaveBeenCalledWith({ url: 'https://youtu.be/abc' })
  })

  it('videos:listFavorites delegates to the video repository', () => {
    expect(invoke('videos:listFavorites')).toEqual([{ id: 'favorite-1' }])
  })

  it('videos:saveFavoriteOrder passes ids to the video repository', () => {
    expect(invoke('videos:saveFavoriteOrder', ['v2', 'v1'])).toBe(true)
    expect(videoRepo.saveFavoriteOrder).toHaveBeenCalledWith(['v2', 'v1'])
  })

  it('videos:searchByText passes query and options to the video repository', () => {
    expect(invoke('videos:searchByText', 'query', { limit: 5 })).toEqual([{ id: 'search-1' }])
    expect(videoRepo.searchByText).toHaveBeenCalledWith('query', { limit: 5 })
  })

  it('videos:markViewed and videos:clearViewed update viewed state through the repository', () => {
    expect(invoke('videos:markViewed', 'v1')).toBe(true)
    expect(invoke('videos:clearViewed', 'v1')).toBe(true)
    expect(videoRepo.markViewed).toHaveBeenCalledWith('v1')
    expect(videoRepo.clearViewed).toHaveBeenCalledWith('v1')
  })

  it('videos:toggleFavorite and videos:toggleNotify return updated video state', () => {
    expect(invoke('videos:toggleFavorite', 'v1')).toEqual({ id: 'video-1', isFavorite: true })
    expect(invoke('videos:toggleNotify', 'v1')).toEqual({ id: 'video-1', notify: true })
  })

  it('channels:togglePin and channels:listAll delegate to the channel repository', () => {
    expect(invoke('channels:togglePin', 'UC1')).toEqual({ id: 'UC1', isPinned: true })
    expect(invoke('channels:listAll')).toEqual([{ id: 'UC1' }])
  })

  it('channels:addManual normalizes input before inserting a channel', async () => {
    normalizeManualChannelInput.mockResolvedValue({ id: 'UC2', title: 'Manual' })

    await expect(invoke('channels:addManual', { url: '@manual' })).resolves.toEqual({
      success: true,
      channel: { id: 'UC2' }
    })
    expect(channelRepo.addManual).toHaveBeenCalledWith({ id: 'UC2', title: 'Manual' })
  })

  it('channels:delete removes a channel by id', () => {
    expect(invoke('channels:delete', 'UC1')).toBe(true)
    expect(channelRepo.delete).toHaveBeenCalledWith('UC1')
  })

  it('channels:syncNow forces subscription resync and broadcasts schedule:updated', async () => {
    await expect(invoke('channels:syncNow')).resolves.toEqual({ ok: true })
    expect(scheduler.refresh).toHaveBeenCalledWith({ forceSubscriptionsResync: true })
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('schedule:updated')
  })

  // regression: 異常系分岐の個別カバー（Phase C で IPC 層を触る前の安全網）
  it('schedule:get reports dbBroken without reading the repository', () => {
    registerVideoHandlers({
      getVideoRepo: () => videoRepo,
      getChannelRepo: () => channelRepo,
      getRssLogRepo: () => rssLogRepo,
      getScheduler: () => scheduler,
      getIsFullMode: () => isFullMode,
      getDbBroken: () => true,
      getMainWindow: () => mainWindow
    })

    expect(invoke('schedule:get')).toEqual({ live: [], upcoming: [], dbBroken: true })
    expect(videoRepo.listVisible).not.toHaveBeenCalled()
  })

  it('schedule:get returns NOT_INITIALIZED when the video repository is missing', () => {
    registerVideoHandlers({
      getVideoRepo: () => null,
      getChannelRepo: () => channelRepo,
      getRssLogRepo: () => rssLogRepo,
      getScheduler: () => scheduler,
      getIsFullMode: () => isFullMode,
      getDbBroken: () => false,
      getMainWindow: () => mainWindow
    })

    expect(invoke('schedule:get')).toEqual({ error: 'NOT_INITIALIZED' })
  })

  it('schedule:feed returns empty videos in full mode', () => {
    registerVideoHandlers({
      getVideoRepo: () => videoRepo,
      getChannelRepo: () => channelRepo,
      getRssLogRepo: () => rssLogRepo,
      getScheduler: () => scheduler,
      getIsFullMode: () => true,
      getDbBroken: () => false,
      getMainWindow: () => mainWindow
    })

    expect(invoke('schedule:feed')).toEqual({ videos: [] })
    expect(videoRepo.listFeed).not.toHaveBeenCalled()
  })

  it('videos:addManual reports NOT_AUTHENTICATED without a scheduler', async () => {
    registerVideoHandlers({
      getVideoRepo: () => videoRepo,
      getChannelRepo: () => channelRepo,
      getRssLogRepo: () => rssLogRepo,
      getScheduler: () => null,
      getIsFullMode: () => false,
      getDbBroken: () => false,
      getMainWindow: () => mainWindow
    })

    await expect(invoke('videos:addManual', { url: 'https://youtu.be/abc' })).resolves.toEqual({
      ok: false,
      error: 'NOT_AUTHENTICATED'
    })
  })
})

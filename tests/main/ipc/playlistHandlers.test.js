import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, ipcMainHandle } = vi.hoisted(() => {
  const handlers = new Map()
  return {
    handlers,
    ipcMainHandle: vi.fn((channel, handler) => handlers.set(channel, handler))
  }
})

vi.mock('electron', () => ({
  ipcMain: { handle: ipcMainHandle }
}))

const { registerPlaylistHandlers } = await import('../../../src/main/ipc/playlistHandlers')

function invoke(channel, ...args) {
  return handlers.get(channel)({}, ...args)
}

describe('playlistHandlers', () => {
  let deps, mainWindow

  beforeEach(() => {
    handlers.clear()
    ipcMainHandle.mockClear()
    mainWindow = { webContents: { send: vi.fn() } }
    deps = {
      playlistRepo: {
        setConfig: vi.fn(),
        getConfig: vi.fn().mockReturnValue({ playlistId: 'PL1', enabled: true }),
        listPlaylistVideos: vi.fn().mockReturnValue([{ id: 'V1' }]),
        deleteRemoved: vi.fn().mockReturnValue({ deleted: 2 })
      },
      videoRepo: {
        listFavorites: vi.fn().mockReturnValue([
          { id: 'V1', url: 'https://www.youtube.com/watch?v=V1' },
          { id: 'V2', url: '' }
        ])
      },
      playlistFetcher: {
        listMyPlaylists: vi.fn().mockResolvedValue([{ id: 'PL1', title: 'One', itemCount: 1 }])
      },
      playlistSyncService: {
        refresh: vi.fn().mockResolvedValue({ added: 1, removed: 0, restored: 0 })
      },
      authClient: {}
    }
    registerPlaylistHandlers({
      getPlaylistRepo: () => deps.playlistRepo,
      getVideoRepo: () => deps.videoRepo,
      getPlaylistFetcher: () => deps.playlistFetcher,
      getPlaylistSyncService: () => deps.playlistSyncService,
      getAuthClient: () => deps.authClient,
      getMainWindow: () => mainWindow
    })
  })

  it('registers the expected IPC channels', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'playlist:cleanup',
      'playlist:exportFavorites',
      'playlist:get',
      'playlist:getConfig',
      'playlist:listMine',
      'playlist:refresh',
      'playlist:setConfig'
    ])
  })

  it('lists my playlists using the current OAuth client', async () => {
    await expect(invoke('playlist:listMine')).resolves.toEqual([
      { id: 'PL1', title: 'One', itemCount: 1 }
    ])
    expect(deps.playlistFetcher.listMyPlaylists).toHaveBeenCalledWith(deps.authClient)
  })

  it('returns NOT_AUTHENTICATED when listing playlists without auth', async () => {
    deps.authClient = null
    await expect(invoke('playlist:listMine')).resolves.toEqual({ error: 'NOT_AUTHENTICATED' })
  })

  it('saves config immediately and sends the initial refresh result in the background', async () => {
    let resolveRefresh
    deps.playlistSyncService.refresh.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve
      })
    )

    await expect(
      invoke('playlist:setConfig', { playlistId: 'PL1', playlistTitle: 'One', enabled: true })
    ).resolves.toEqual({ ok: true })
    expect(deps.playlistRepo.setConfig).toHaveBeenCalledWith({
      playlistId: 'PL1',
      playlistTitle: 'One',
      enabled: true
    })
    expect(deps.playlistSyncService.refresh).toHaveBeenCalledTimes(1)
    expect(mainWindow.webContents.send).not.toHaveBeenCalled()

    resolveRefresh({ added: 1, removed: 0, restored: 0 })
    await Promise.resolve()

    expect(mainWindow.webContents.send).toHaveBeenCalledWith('playlist:updated', {
      added: 1,
      removed: 0,
      restored: 0
    })
  })

  it('does not refresh when config is saved as disabled', async () => {
    await expect(
      invoke('playlist:setConfig', { playlistId: 'PL1', enabled: false })
    ).resolves.toEqual({ ok: true })
    expect(deps.playlistSyncService.refresh).not.toHaveBeenCalled()
  })

  it('returns playlist config and videos', async () => {
    expect(await invoke('playlist:getConfig')).toEqual({ playlistId: 'PL1', enabled: true })
    expect(await invoke('playlist:get', { filter: 'removed' })).toEqual([{ id: 'V1' }])
    expect(deps.playlistRepo.listPlaylistVideos).toHaveBeenCalledWith({ filter: 'removed' })
  })

  it('refreshes manually and maps not-configured skips to an error code', async () => {
    await expect(invoke('playlist:refresh')).resolves.toEqual({
      added: 1,
      removed: 0,
      restored: 0
    })
    deps.playlistSyncService.refresh.mockResolvedValueOnce({
      skipped: true,
      reason: 'not-configured'
    })
    await expect(invoke('playlist:refresh')).resolves.toEqual({
      error: 'PLAYLIST_NOT_CONFIGURED'
    })
  })

  it('cleans removed videos and exports favorite URLs', async () => {
    expect(await invoke('playlist:cleanup')).toEqual({ deleted: 2 })
    expect(await invoke('playlist:exportFavorites')).toEqual({
      urls: ['https://www.youtube.com/watch?v=V1', 'https://www.youtube.com/watch?v=V2']
    })
  })
})

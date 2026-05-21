import { ipcMain } from 'electron'
import { buildWatchUrl } from '../services/videoUrl.js'

function errorCode(err, fallback) {
  return err?.code ?? fallback
}

export function registerPlaylistHandlers({
  getPlaylistRepo,
  getVideoRepo,
  getPlaylistFetcher,
  getPlaylistSyncService,
  getAuthClient,
  getMainWindow
}) {
  ipcMain.handle('playlist:listMine', async () => {
    const authClient = getAuthClient()
    if (!authClient) return { error: 'NOT_AUTHENTICATED' }
    try {
      return await getPlaylistFetcher().listMyPlaylists(authClient)
    } catch (err) {
      return { error: errorCode(err, 'LIST_FAILED') }
    }
  })

  ipcMain.handle('playlist:setConfig', async (_, payload = {}) => {
    const repo = getPlaylistRepo()
    const service = getPlaylistSyncService()
    if (!repo || !service) return { error: 'NOT_INITIALIZED' }
    try {
      repo.setConfig({
        playlistId: payload.playlistId,
        playlistTitle: payload.playlistTitle ?? null,
        enabled: payload.enabled ?? true
      })
      if (payload.enabled !== false) {
        service
          .refresh()
          .then((result) => {
            if (!result?.skipped) getMainWindow()?.webContents.send('playlist:updated', result)
          })
          .catch((err) => {
            getMainWindow()?.webContents.send('playlist:error', {
              message: errorCode(err, 'REFRESH_FAILED')
            })
          })
      }
      return { ok: true }
    } catch (err) {
      return { error: errorCode(err, 'SET_CONFIG_FAILED') }
    }
  })

  ipcMain.handle('playlist:getConfig', () => {
    const repo = getPlaylistRepo()
    if (!repo) return null
    return repo.getConfig()
  })

  ipcMain.handle('playlist:get', (_, opts = {}) => {
    const repo = getPlaylistRepo()
    if (!repo) return []
    return repo.listPlaylistVideos({ filter: opts.filter ?? 'all' })
  })

  ipcMain.handle('playlist:refresh', async () => {
    const service = getPlaylistSyncService()
    if (!service) return { error: 'NOT_INITIALIZED' }
    try {
      const result = await service.refresh()
      if (result.skipped) {
        return {
          error:
            result.reason === 'not-authenticated' ? 'NOT_AUTHENTICATED' : 'PLAYLIST_NOT_CONFIGURED'
        }
      }
      getMainWindow()?.webContents.send('playlist:updated', result)
      return result
    } catch (err) {
      return { error: errorCode(err, 'REFRESH_FAILED') }
    }
  })

  ipcMain.handle('playlist:cleanup', () => {
    const repo = getPlaylistRepo()
    if (!repo) return { deleted: 0 }
    return repo.deleteRemoved()
  })

  ipcMain.handle('playlist:exportFavorites', () => {
    const repo = getVideoRepo()
    if (!repo) return { urls: [] }
    return {
      urls: repo.listFavorites().map((video) => video.url || buildWatchUrl(video.id))
    }
  })
}

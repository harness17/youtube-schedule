/**
 * settingsHandlers — 設定・インポートエクスポート系 IPC ハンドラ
 *
 * 登録チャンネル:
 *   settings:get / settings:set
 *   settings:export / settings:import
 *   favorites:export / favorites:import
 *
 * @param {{
 *   getVideoRepo:   () => import('../repositories/videoRepository.js').VideoRepository | undefined,
 *   getChannelRepo: () => import('../repositories/channelRepository.js').ChannelRepository | undefined,
 *   getMainWindow:  () => import('electron').BrowserWindow | undefined,
 * }} deps
 */
import { ipcMain, dialog } from 'electron'
import { getSetting, setSetting } from '../store.js'
import {
  buildSettingsExport,
  validateSettingsImport,
  buildFavoritesExport,
  applyFavoritesImport
} from '../services/settingsPorter.js'

export function registerSettingsHandlers({ getVideoRepo, getChannelRepo, getMainWindow }) {
  // ---- 設定の取得・保存 --------------------------------------------------------
  // electron-store ラッパー。renderer からの直接アクセスを防ぐため IPC 経由で提供
  ipcMain.handle('settings:get', (_, key, defaultValue) => getSetting(key, defaultValue))
  ipcMain.handle('settings:set', (_, key, value) => setSetting(key, value))

  // ---- 設定エクスポート --------------------------------------------------------
  ipcMain.handle('settings:export', async () => {
    const mainWindow = getMainWindow()
    const dateStr = new Date().toISOString().slice(0, 10)
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `settings-export-${dateStr}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return { canceled: true }

    const channelRepo = getChannelRepo()
    const pinnedChannels = (channelRepo?.listAll() ?? [])
      .filter((c) => c.isPinned)
      .map(({ id, title }) => ({ id, title }))
    const data = buildSettingsExport({
      settings: { darkMode: getSetting('darkMode', false) },
      pinnedChannels
    })
    const fs = await import('node:fs/promises')
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true }
  })

  // ---- 設定インポート ----------------------------------------------------------
  ipcMain.handle('settings:import', async () => {
    const mainWindow = getMainWindow()
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return { canceled: true }

    const fs = await import('node:fs/promises')
    let data
    try {
      data = JSON.parse(await fs.readFile(filePaths[0], 'utf-8'))
      validateSettingsImport(data)
    } catch (err) {
      return { error: err.message }
    }

    if (data.settings) {
      if (typeof data.settings.darkMode === 'boolean') {
        setSetting('darkMode', data.settings.darkMode)
      }
    }

    const channelRepo = getChannelRepo()
    if (Array.isArray(data.pinnedChannels) && channelRepo) {
      const safeChannels = data.pinnedChannels.filter(
        (c) => c && typeof c.id === 'string' && c.id.length > 0
      )
      channelRepo.replacePinnedChannels(safeChannels)
    }

    return {
      success: true,
      darkMode: typeof data.settings?.darkMode === 'boolean' ? data.settings.darkMode : null,
      pinnedChannels: data.pinnedChannels ?? []
    }
  })

  // ---- お気に入りエクスポート --------------------------------------------------
  ipcMain.handle('favorites:export', async () => {
    const mainWindow = getMainWindow()
    const dateStr = new Date().toISOString().slice(0, 10)
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `favorites-export-${dateStr}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (canceled || !filePath) return { canceled: true }

    const videoRepo = getVideoRepo()
    const favorites = videoRepo?.listFavorites() ?? []
    const data = buildFavoritesExport(favorites)
    const fs = await import('node:fs/promises')
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true, count: favorites.length }
  })

  // ---- お気に入りインポート ----------------------------------------------------
  ipcMain.handle('favorites:import', async () => {
    const mainWindow = getMainWindow()
    const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return { canceled: true }

    const videoRepo = getVideoRepo()
    if (!videoRepo) return { error: 'NOT_INITIALIZED' }

    const fs = await import('node:fs/promises')
    try {
      const data = JSON.parse(await fs.readFile(filePaths[0], 'utf-8'))
      const { applied, skipped } = applyFavoritesImport(data, (entry) =>
        videoRepo.importAsFavorite(entry)
      )
      return { success: true, applied, skipped }
    } catch (err) {
      return { error: err.message }
    }
  })
}

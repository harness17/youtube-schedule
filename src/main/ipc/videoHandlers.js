/**
 * videoHandlers — 動画・チャンネル・スケジュール取得系 IPC ハンドラ
 *
 * 登録チャンネル:
 *   schedule:get / schedule:refresh
 *   diag:rssFailureRate
 *   videos:listMissed / listArchive / listFavorites / searchByText
 *   videos:markViewed / clearViewed / toggleFavorite / toggleNotify
 *   channels:togglePin / listAll
 *
 * 依存オブジェクトは全てゲッター関数として受け取る。
 * index.js の変数が後から代入される場合（initDatabase 後など）でも
 * 常に最新の参照を取得できるようにするため。
 *
 * @param {{
 *   getVideoRepo:    () => import('../repositories/videoRepository.js').VideoRepository | undefined,
 *   getChannelRepo:  () => import('../repositories/channelRepository.js').ChannelRepository | undefined,
 *   getRssLogRepo:   () => object | undefined,
 *   getScheduler:    () => object | undefined,
 *   getDbBroken:     () => boolean,
 *   getMainWindow:   () => import('electron').BrowserWindow | undefined,
 * }} deps
 */
import { ipcMain } from 'electron'

export function registerVideoHandlers({
  getVideoRepo,
  getChannelRepo,
  getRssLogRepo,
  getScheduler,
  getDbBroken,
  getMainWindow
}) {
  // ---- 配信予定取得 ------------------------------------------------------------
  ipcMain.handle('schedule:get', () => {
    if (getDbBroken()) return { live: [], upcoming: [], dbBroken: true }
    const repo = getVideoRepo()
    if (!repo) return { error: 'NOT_INITIALIZED' }
    const visible = repo.listVisible()
    return {
      live: visible.filter((v) => v.status === 'live'),
      upcoming: visible.filter((v) => v.status === 'upcoming')
    }
  })

  // ---- 配信予定強制更新 --------------------------------------------------------
  ipcMain.handle('schedule:refresh', async () => {
    const scheduler = getScheduler()
    if (!scheduler) return { error: 'NOT_INITIALIZED' }
    await scheduler.refresh({ forceFullRecheck: true })
    getMainWindow()?.webContents.send('schedule:updated')
  })

  // ---- RSS 失敗率診断 ----------------------------------------------------------
  // 直近 24h の RSS フェッチ失敗率を返す（StatusBanners での警告表示に使用）
  ipcMain.handle('diag:rssFailureRate', () => {
    const repo = getRssLogRepo()
    if (!repo) return 0
    const since = Date.now() - 24 * 60 * 60 * 1000
    return repo.getFailureRateSince(since)
  })

  // ---- アーカイブ系リスト ------------------------------------------------------
  ipcMain.handle('videos:listMissed', () => {
    const repo = getVideoRepo()
    if (!repo) return []
    return repo.listMissed()
  })

  ipcMain.handle('videos:listArchive', (_, opts) => {
    const repo = getVideoRepo()
    if (!repo) return []
    return repo.listArchive(opts ?? {})
  })

  ipcMain.handle('videos:listFavorites', () => {
    const repo = getVideoRepo()
    if (!repo) return []
    return repo.listFavorites()
  })

  ipcMain.handle('videos:searchByText', (_, query, opts) => {
    const repo = getVideoRepo()
    if (!repo) return []
    return repo.searchByText(query, opts ?? {})
  })

  // ---- 視聴済みマーク ----------------------------------------------------------
  ipcMain.handle('videos:markViewed', (_, id) => {
    const repo = getVideoRepo()
    if (!repo) return false
    return repo.markViewed(id)
  })

  ipcMain.handle('videos:clearViewed', (_, id) => {
    const repo = getVideoRepo()
    if (!repo) return false
    return repo.clearViewed(id)
  })

  // ---- お気に入りトグル --------------------------------------------------------
  ipcMain.handle('videos:toggleFavorite', (_, id) => {
    const repo = getVideoRepo()
    if (!repo) return null
    return repo.toggleFavorite(id)
  })

  // ---- 🔔 お知らせトグル -------------------------------------------------------
  ipcMain.handle('videos:toggleNotify', (_, id) => {
    const repo = getVideoRepo()
    if (!repo) return null
    return repo.toggleNotify(id)
  })

  // ---- チャンネル --------------------------------------------------------------
  ipcMain.handle('channels:togglePin', (_, id) => {
    const repo = getChannelRepo()
    if (!repo) return null
    return repo.togglePin(id)
  })

  ipcMain.handle('channels:listAll', () => {
    const repo = getChannelRepo()
    if (!repo) return []
    return repo.listAll()
  })
}

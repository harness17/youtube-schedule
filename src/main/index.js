import 'dotenv/config'
import { app, shell, BrowserWindow, ipcMain, Notification } from 'electron'
import { join, dirname } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import {
  getAuthenticatedClient,
  startAuthFlow,
  logout,
  credentialsExist,
  getCredentialsPath
} from './auth.js'
import { google } from 'googleapis'
import { openDatabase, closeDatabase } from './db/connection.js'
import { runMigrations } from './db/migrate.js'
import { createVideoRepository } from './repositories/videoRepository.js'
import { createChannelRepository } from './repositories/channelRepository.js'
import { createRssFetchLogRepository } from './repositories/rssFetchLogRepository.js'
import { createMetaRepository } from './repositories/metaRepository.js'
import { createSchedulerService } from './services/schedulerService.js'
import { createRssFetcher } from './fetchers/rssFetcher.js'
import { createSubscriptionsFetcher } from './fetchers/subscriptionsFetcher.js'
import { createPlaylistItemsFetcher } from './fetchers/playlistItemsFetcher.js'
import { createVideoDetailsFetcher } from './fetchers/videoDetailsFetcher.js'
import {
  readLegacyScheduleCache,
  clearLegacyScheduleCache,
  getSetting,
  setSetting
} from './store.js'
import { createLogger } from './logger.js'

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      const win = windows[0]
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

const REFRESH_INTERVAL_MS = 30 * 60 * 1000
let db
let videoRepo, channelRepo, rssLogRepo, metaRepo
let scheduler
let refreshTimer
let dbBroken = false
let logger

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupAutoUpdater(mainWindow) {
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('updater:update-available', info)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('updater:update-downloaded', info)
  })

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('updater:error', err.message)
  })

  autoUpdater.checkForUpdates()
}

function initDatabase() {
  const dbPath = join(app.getPath('userData'), 'schedule.db')
  db = openDatabase(dbPath)
  const integrity = db.pragma('integrity_check', { simple: true })
  if (integrity !== 'ok') {
    dbBroken = true
    return
  }
  runMigrations(db, {
    legacyStoreReader: {
      read: readLegacyScheduleCache,
      clear: clearLegacyScheduleCache
    }
  })
  videoRepo = createVideoRepository(db)
  channelRepo = createChannelRepository(db)
  rssLogRepo = createRssFetchLogRepository(db)
  metaRepo = createMetaRepository(db)
}

function initScheduler(authClient) {
  scheduler = createSchedulerService({
    videoRepo,
    channelRepo,
    rssLogRepo,
    metaRepo,
    subsFetcher: createSubscriptionsFetcher(),
    rssFetcher: createRssFetcher({ timeoutMs: 3000 }),
    playlistFetcher: createPlaylistItemsFetcher(),
    videoFetcher: createVideoDetailsFetcher(),
    authClient,
    ytFactory: (auth) => google.youtube({ version: 'v3', auth }),
    logger
  })
}

function startPolling(mainWindow) {
  if (refreshTimer) clearInterval(refreshTimer)
  const kick = async () => {
    try {
      await scheduler.refresh()
      mainWindow?.webContents.send('schedule:updated')
    } catch (err) {
      logger?.error('scheduler.kick.error', { error: err })
      mainWindow?.webContents.send('schedule:error', {
        message: err?.message ?? String(err)
      })
    }
  }
  kick()
  refreshTimer = setInterval(kick, REFRESH_INTERVAL_MS)
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('io.github.harness17.youtube-schedule')

  logger = createLogger({ logsDir: join(app.getPath('userData'), 'logs') })
  logger.cleanupOldLogs()
  logger.info('app.start', { version: app.getVersion(), platform: process.platform })

  process.on('uncaughtException', (err) => {
    logger.error('process.uncaughtException', { error: err })
  })
  process.on('unhandledRejection', (reason) => {
    logger.error('process.unhandledRejection', { error: reason })
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDatabase()

  createWindow()

  const mainWindow = BrowserWindow.getAllWindows()[0]
  setupAutoUpdater(mainWindow)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // 起動時に認証済みクライアントがあればスケジューラーを初期化
  const exists = await credentialsExist()
  if (exists) {
    const client = await getAuthenticatedClient()
    if (client) {
      initScheduler(client)
      startPolling(mainWindow)
    }
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (refreshTimer) clearInterval(refreshTimer)
  closeDatabase(db)
})

// 認証状態確認
ipcMain.handle('auth:check', async () => {
  const exists = await credentialsExist()
  if (!exists) {
    return {
      isAuthenticated: false,
      error: 'CREDENTIALS_NOT_FOUND',
      credentialsPath: getCredentialsPath()
    }
  }
  const client = await getAuthenticatedClient()
  return { isAuthenticated: !!client }
})

// ログイン
ipcMain.handle('auth:login', async () => {
  const exists = await credentialsExist()
  if (!exists) {
    return {
      isAuthenticated: false,
      error: 'CREDENTIALS_NOT_FOUND',
      credentialsPath: getCredentialsPath()
    }
  }
  try {
    await startAuthFlow()
    const client = await getAuthenticatedClient()
    if (client && !scheduler) {
      initScheduler(client)
      const mainWindow = BrowserWindow.getAllWindows()[0]
      startPolling(mainWindow)
    }
    return { isAuthenticated: true }
  } catch (err) {
    return { isAuthenticated: false, error: err.message }
  }
})

// ログアウト
ipcMain.handle('auth:logout', async () => {
  await logout()
  return { isAuthenticated: false }
})

// 配信予定取得
ipcMain.handle('schedule:get', () => {
  if (dbBroken) return { live: [], upcoming: [], dbBroken: true }
  if (!videoRepo) return { error: 'NOT_INITIALIZED' }
  const visible = videoRepo.listVisible()
  return {
    live: visible.filter((v) => v.status === 'live'),
    upcoming: visible.filter((v) => v.status === 'upcoming')
  }
})

// 配信予定強制更新
ipcMain.handle('schedule:refresh', async () => {
  if (!scheduler) return { error: 'NOT_INITIALIZED' }
  await scheduler.refresh({ forceFullRecheck: true })
  const mainWindow = BrowserWindow.getAllWindows()[0]
  mainWindow?.webContents.send('schedule:updated')
})

// RSS 失敗率診断
ipcMain.handle('diag:rssFailureRate', () => {
  if (!rssLogRepo) return 0
  const since = Date.now() - 24 * 60 * 60 * 1000
  return rssLogRepo.getFailureRateSince(since)
})

// データベースリセット
ipcMain.handle('schedule:resetDatabase', async () => {
  if (refreshTimer) clearInterval(refreshTimer)
  closeDatabase(db)
  const fs = await import('node:fs/promises')
  const dbPath = join(app.getPath('userData'), 'schedule.db')
  await fs.rm(dbPath, { force: true })
  await fs.rm(dbPath + '-wal', { force: true })
  await fs.rm(dbPath + '-shm', { force: true })
  dbBroken = false
  initDatabase()
})

// デスクトップ通知
ipcMain.handle('notification:show', (_, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
})

// 設定の取得・保存
ipcMain.handle('settings:get', (_, key, defaultValue) => getSetting(key, defaultValue))
ipcMain.handle('settings:set', (_, key, value) => setSetting(key, value))

// アップデートを適用して再起動
ipcMain.handle('updater:quitAndInstall', () => {
  autoUpdater.quitAndInstall()
})

// アプリバージョンを取得
ipcMain.handle('app:version', () => app.getVersion())

// credentials.json が置かれるフォルダをエクスプローラーで開く
ipcMain.handle('shell:openFolder', async (_, filePath) => {
  try {
    await shell.openPath(dirname(filePath))
    return { success: true }
  } catch {
    return { success: false }
  }
})

// 動画: アーカイブ系一覧
ipcMain.handle('videos:listMissed', () => {
  if (!videoRepo) return []
  return videoRepo.listMissed()
})
ipcMain.handle('videos:listArchive', (_, opts) => {
  if (!videoRepo) return []
  return videoRepo.listArchive(opts ?? {})
})
ipcMain.handle('videos:listFavorites', () => {
  if (!videoRepo) return []
  return videoRepo.listFavorites()
})
ipcMain.handle('videos:searchByText', (_, query, opts) => {
  if (!videoRepo) return []
  return videoRepo.searchByText(query, opts ?? {})
})

// 動画: 見たマーク / クリア
ipcMain.handle('videos:markViewed', (_, id) => {
  if (!videoRepo) return false
  return videoRepo.markViewed(id)
})
ipcMain.handle('videos:clearViewed', (_, id) => {
  if (!videoRepo) return false
  return videoRepo.clearViewed(id)
})

// 動画: お気に入りトグル
ipcMain.handle('videos:toggleFavorite', (_, id) => {
  if (!videoRepo) return null
  return videoRepo.toggleFavorite(id)
})

// 動画: お知らせトグル
ipcMain.handle('videos:toggleNotify', (_, id) => {
  if (!videoRepo) return null
  return videoRepo.toggleNotify(id)
})

// チャンネル: ピントグル / 全件取得
ipcMain.handle('channels:togglePin', (_, id) => {
  if (!channelRepo) return null
  return channelRepo.togglePin(id)
})
ipcMain.handle('channels:listAll', () => {
  if (!channelRepo) return []
  return channelRepo.listAll()
})

// 外部ブラウザで URL を開く
ipcMain.handle('shell:openExternal', async (_, url) => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { success: false, error: 'Invalid URL scheme' }
    }
    await shell.openExternal(url)
    return { success: true }
  } catch {
    return { success: false, error: 'Invalid URL' }
  }
})

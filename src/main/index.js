/**
 * メインプロセスのエントリーポイント。
 *
 * 責務:
 *   - アプリライフサイクル管理（起動・終了・シングルインスタンス）
 *   - BrowserWindow 生成・自動アップデート設定
 *   - DB 初期化・スケジューラー初期化・30 分ポーリング
 *   - IPC ハンドラの登録（各 handlers ファイルに委譲）
 *
 * IPC ハンドラは責務別に分割:
 *   src/main/ipc/authHandlers.js     — auth:check/login/logout
 *   src/main/ipc/videoHandlers.js    — schedule:get/refresh, videos:*, channels:*, diag:*
 *   src/main/ipc/settingsHandlers.js — settings:*, favorites:*
 *   src/main/ipc/appHandlers.js      — app:*, shell:*, notification:*, updater:*
 */
import 'dotenv/config'
import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import { getAuthenticatedClient, credentialsExist } from './auth.js'
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
import { readLegacyScheduleCache, clearLegacyScheduleCache, getSetting } from './store.js'
import { createLogger } from './logger.js'
import { registerAuthHandlers } from './ipc/authHandlers.js'
import { registerVideoHandlers } from './ipc/videoHandlers.js'
import { registerSettingsHandlers } from './ipc/settingsHandlers.js'
import { registerAppHandlers } from './ipc/appHandlers.js'

// ===== シングルインスタンス保証 ================================================
// 多重起動時は既存ウィンドウをフォアグラウンドに出して即終了する
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

// ===== モジュールスコープの状態 =================================================
// getter パターンで IPC ハンドラに渡す。ハンドラ登録時点ではまだ undefined の場合があるため、
// 値ではなく関数（getter）を渡すことで常に最新の参照を取得できるようにする
const REFRESH_INTERVAL_MS = 30 * 60 * 1000
let db
let videoRepo, channelRepo, rssLogRepo, metaRepo
let scheduler
let refreshTimer
let dbBroken = false
let logger

// ===== ウィンドウ生成 ===========================================================
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

// ===== 自動アップデート設定 =====================================================
function setupAutoUpdater(mainWindow) {
  if (is.dev) return

  autoUpdater.autoDownload = getSetting('autoDownload', true)
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

// ===== DB 初期化 ================================================================
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

// ===== スケジューラー初期化 =====================================================
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

// ===== ポーリング開始 ===========================================================
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

// ===== IPC ハンドラ登録 =========================================================
// ゲッター関数を注入することで、ハンドラが登録された時点では未初期化でも
// 呼び出し時に常に最新の値を参照できる
function registerAllHandlers(getMainWindow) {
  // 認証ハンドラ
  registerAuthHandlers({
    onLoginSuccess: async (client) => {
      if (!scheduler) {
        initScheduler(client)
        startPolling(getMainWindow())
      }
    }
  })

  // 動画・チャンネル・スケジュール取得ハンドラ
  registerVideoHandlers({
    getVideoRepo: () => videoRepo,
    getChannelRepo: () => channelRepo,
    getRssLogRepo: () => rssLogRepo,
    getScheduler: () => scheduler,
    getDbBroken: () => dbBroken,
    getMainWindow
  })

  // 設定・インポートエクスポートハンドラ
  registerSettingsHandlers({
    getVideoRepo: () => videoRepo,
    getChannelRepo: () => channelRepo,
    getMainWindow
  })

  // アプリ基盤ハンドラ
  registerAppHandlers({
    getMainWindow,
    autoUpdater,
    isDev: is.dev,
    onResetDatabase: async () => {
      if (refreshTimer) clearInterval(refreshTimer)
      closeDatabase(db)
      const fs = await import('node:fs/promises')
      const dbPath = join(app.getPath('userData'), 'schedule.db')
      await fs.rm(dbPath, { force: true })
      await fs.rm(dbPath + '-wal', { force: true })
      await fs.rm(dbPath + '-shm', { force: true })
      dbBroken = false
      initDatabase()
    }
  })
}

// ===== アプリ起動 ================================================================
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

  // BrowserWindow は createWindow() の直後に取得できる
  const getMainWindow = () => BrowserWindow.getAllWindows()[0]

  setupAutoUpdater(getMainWindow())
  registerAllHandlers(getMainWindow)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // 起動時に認証済みクライアントがあればスケジューラーを初期化してポーリング開始
  const exists = await credentialsExist()
  if (exists) {
    const client = await getAuthenticatedClient()
    if (client) {
      initScheduler(client)
      startPolling(getMainWindow())
    }
  }
})

// ===== アプリ終了処理 ===========================================================
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (refreshTimer) clearInterval(refreshTimer)
  closeDatabase(db)
})

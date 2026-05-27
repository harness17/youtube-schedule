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
import { createStatsRepository } from './repositories/statsRepository.js'
import { createRssFetchLogRepository } from './repositories/rssFetchLogRepository.js'
import { createMetaRepository } from './repositories/metaRepository.js'
import { createPlaylistRepository } from './repositories/playlistRepository.js'
import { createSchedulerService } from './services/schedulerService.js'
import { createImminentPoller, IMMINENT_POLL_INTERVAL_MS } from './services/imminentPoller.js'
import { createRssFetcher } from './fetchers/rssFetcher.js'
import { createSubscriptionsFetcher } from './fetchers/subscriptionsFetcher.js'
import { createPlaylistItemsFetcher } from './fetchers/playlistItemsFetcher.js'
import { createPlaylistFetcher } from './fetchers/playlistFetcher.js'
import { createVideoDetailsFetcher } from './fetchers/videoDetailsFetcher.js'
import {
  createPlaylistSyncService,
  PLAYLIST_SYNC_INTERVAL_MS
} from './services/playlistSyncService.js'
import { startPlaylistPolling as startPlaylistPollingTimer } from './services/playlistPolling.js'
import { readLegacyScheduleCache, clearLegacyScheduleCache, getSetting } from './store.js'
import { createLogger } from './logger.js'
import { registerAuthHandlers } from './ipc/authHandlers.js'
import { registerVideoHandlers } from './ipc/videoHandlers.js'
import { registerSettingsHandlers } from './ipc/settingsHandlers.js'
import { registerAppHandlers } from './ipc/appHandlers.js'
import { registerStatsHandlers } from './ipc/statsHandlers.js'
import { registerPlaylistHandlers } from './ipc/playlistHandlers.js'

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
let videoRepo, channelRepo, statsRepo, rssLogRepo, metaRepo, playlistRepo
let scheduler, playlistApiFetcher, playlistSyncService
let imminentPoller
let currentAuthClient = null
let refreshTimer
let playlistRefreshTimer
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
    // shell.openExternal は file: や custom scheme を渡すと OS コマンド実行に繋がるため
    // IPC 側の shell:openExternal と同じ http/https allowlist で揃える
    try {
      const parsed = new URL(details.url)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(details.url)
      }
    } catch {
      /* invalid URL は無視 */
    }
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
    // err.message には内部 URL / ネットワーク詳細が混ざる可能性があるため汎用コードに丸める
    logger?.error('autoUpdater.error', { error: err })
    mainWindow.webContents.send('updater:error', 'UPDATE_CHECK_FAILED')
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
  statsRepo = createStatsRepository(db)
  rssLogRepo = createRssFetchLogRepository(db)
  metaRepo = createMetaRepository(db)
  playlistRepo = createPlaylistRepository(db)
}

// ===== スケジューラー初期化 =====================================================
function initScheduler(authClient) {
  currentAuthClient = authClient
  const videoDetailsFetcher = createVideoDetailsFetcher()
  playlistApiFetcher = createPlaylistFetcher({
    ytFactory: (auth) => google.youtube({ version: 'v3', auth: auth ?? undefined }),
    logger
  })
  playlistSyncService = createPlaylistSyncService({
    playlistRepo,
    videoRepo,
    channelRepo,
    playlistFetcher: playlistApiFetcher,
    videoDetailsFetcher,
    authClient,
    ytFactory: (auth) => google.youtube({ version: 'v3', auth: auth ?? undefined }),
    logger
  })
  scheduler = createSchedulerService({
    videoRepo,
    channelRepo,
    rssLogRepo,
    metaRepo,
    subsFetcher: createSubscriptionsFetcher(),
    rssFetcher: createRssFetcher({ timeoutMs: 3000 }),
    playlistFetcher: createPlaylistItemsFetcher(),
    playlistSyncService,
    videoFetcher: videoDetailsFetcher,
    authClient,
    ytFactory: (auth) => google.youtube({ version: 'v3', auth: auth ?? undefined }),
    logger
  })
  imminentPoller = createImminentPoller({
    videoRepo,
    videoFetcher: videoDetailsFetcher,
    getAuthClient: () => currentAuthClient,
    ytFactory: (auth) => google.youtube({ version: 'v3', auth: auth ?? undefined }),
    onUpdated: () => {
      const win = BrowserWindow.getAllWindows()[0]
      win?.webContents.send('schedule:updated')
    },
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
        error: 'REFRESH_FAILED'
      })
    }
  }
  kick()
  // 既存アーカイブの duration / published_at を一度だけ補完（自己ガード付き）
  scheduler
    .backfillArchiveMeta()
    .catch((err) => logger?.error('scheduler.backfill.kick.error', { error: err }))
  refreshTimer = setInterval(kick, REFRESH_INTERVAL_MS)
  // 配信開始直前の動画だけを 1 分間隔で再チェックして live 遷移を即時検出する。
  // 認証済みのときだけ動かす（簡易モードは RSS 経由で API キー不要のため対象外）。
  imminentPoller?.stop()
  if (currentAuthClient) {
    imminentPoller?.start(IMMINENT_POLL_INTERVAL_MS)
  }
}

function startPlaylistPolling(mainWindow) {
  startPlaylistPollingTimer({
    authClient: currentAuthClient,
    scheduler,
    mainWindow,
    logger,
    intervalMs: PLAYLIST_SYNC_INTERVAL_MS,
    getTimer: () => playlistRefreshTimer,
    setTimer: (timer) => {
      playlistRefreshTimer = timer
    }
  })
}

// ===== IPC ハンドラ登録 =========================================================
// ゲッター関数を注入することで、ハンドラが登録された時点では未初期化でも
// 呼び出し時に常に最新の値を参照できる
function registerAllHandlers(getMainWindow) {
  // 認証ハンドラ
  registerAuthHandlers({
    onLoginSuccess: async (client) => {
      initScheduler(client)
      startPolling(getMainWindow())
      startPlaylistPolling(getMainWindow())
    },
    onLogoutSuccess: async () => {
      initScheduler(null)
      startPolling(getMainWindow())
      startPlaylistPolling(getMainWindow())
    }
  })

  // 動画・チャンネル・スケジュール取得ハンドラ
  registerVideoHandlers({
    getVideoRepo: () => videoRepo,
    getChannelRepo: () => channelRepo,
    getRssLogRepo: () => rssLogRepo,
    getScheduler: () => scheduler,
    getIsFullMode: () => Boolean(currentAuthClient),
    getDbBroken: () => dbBroken,
    getMainWindow
  })

  registerStatsHandlers({
    getStatsRepo: () => statsRepo,
    getDbBroken: () => dbBroken
  })

  registerPlaylistHandlers({
    getPlaylistRepo: () => playlistRepo,
    getVideoRepo: () => videoRepo,
    getPlaylistFetcher: () => playlistApiFetcher,
    getPlaylistSyncService: () => playlistSyncService,
    getAuthClient: () => currentAuthClient,
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
      if (playlistRefreshTimer) clearInterval(playlistRefreshTimer)
      imminentPoller?.stop()
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

  // 起動時に認証済みならフルモード、未認証ならRSS-onlyモードで開始する。
  // credentials.json が壊れていても起動は継続する（簡易モードに退避）。
  const exists = await credentialsExist()
  let client = null
  if (exists) {
    try {
      client = await getAuthenticatedClient()
    } catch (err) {
      logger?.error?.('credentials.json の読み込みに失敗（簡易モードで起動）:', err.message)
      client = null
    }
  }
  initScheduler(client)
  startPolling(getMainWindow())
  startPlaylistPolling(getMainWindow())
})

// ===== アプリ終了処理 ===========================================================
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (playlistRefreshTimer) clearInterval(playlistRefreshTimer)
  imminentPoller?.stop()
  closeDatabase(db)
})

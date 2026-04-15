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
import { fetchSchedule, fetchMembershipSchedule, resolveChannel } from './youtube-api.js'
import {
  getCache,
  setCache,
  getSetting,
  setSetting,
  getMembershipChannels,
  setMembershipChannels,
  getMembershipCacheData,
  setMembershipCache,
  getMembershipWatchPool,
  setMembershipWatchPool
} from './store.js'

function mergeSchedules(rssData, memData) {
  const rss = rssData || { live: [], upcoming: [] }
  const mem = memData || { live: [], upcoming: [] }
  const liveMap = new Map()
  const upcomingMap = new Map()
  for (const item of [...rss.live, ...mem.live]) liveMap.set(item.id, item)
  for (const item of [...rss.upcoming, ...mem.upcoming]) upcomingMap.set(item.id, item)
  const upcoming = [...upcomingMap.values()].sort(
    (a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime()
  )
  return { live: [...liveMap.values()], upcoming }
}

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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('io.github.harness17.youtube-schedule')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  const mainWindow = BrowserWindow.getAllWindows()[0]
  setupAutoUpdater(mainWindow)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
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

// 配信予定取得（キャッシュ優先・RSS+メンバーシップ統合）
ipcMain.handle('schedule:get', async () => {
  const rssCache = getCache()            // TTL チェック済み（期限切れなら null）
  const memCacheData = getMembershipCacheData() // TTL チェック済み（期限切れなら null）

  // RSS キャッシュが有効な場合のみキャッシュ返却（RSS が切れたら再取得）
  if (rssCache !== null) {
    return { data: mergeSchedules(rssCache, memCacheData), fromCache: true }
  }

  const client = await getAuthenticatedClient()
  if (!client) return { error: 'NOT_AUTHENTICATED' }
  try {
    const rssData = await fetchSchedule(client)
    setCache(rssData)
    return { data: mergeSchedules(rssData, memCacheData), fromCache: false }
  } catch (err) {
    if (err.code === 403) return { error: 'QUOTA_EXCEEDED' }
    return { error: 'FETCH_FAILED' }
  }
})

// RSS のみ強制更新（10分自動リフレッシュ用）
ipcMain.handle('schedule:refresh', async () => {
  const client = await getAuthenticatedClient()
  if (!client) return { error: 'NOT_AUTHENTICATED' }
  try {
    const rssData = await fetchSchedule(client)
    setCache(rssData)
    const memCacheData = getMembershipCacheData() // TTL チェック済み
    return { data: mergeSchedules(rssData, memCacheData), fromCache: false }
  } catch (err) {
    if (err.code === 403) return { error: 'QUOTA_EXCEEDED' }
    return { error: 'FETCH_FAILED' }
  }
})

// メンバーシップ強制更新（2時間自動 or 手動更新時）
ipcMain.handle('membership:refresh', async () => {
  const client = await getAuthenticatedClient()
  if (!client) return { error: 'NOT_AUTHENTICATED' }
  const channels = getMembershipChannels()
  if (channels.length === 0) {
    const rssCache = getCache()
    return { data: mergeSchedules(rssCache, null), fromCache: true }
  }
  try {
    const channelIds = channels.map((c) => c.channelId)
    const { live, upcoming, updatedPool } = await fetchMembershipSchedule(
      client,
      channelIds,
      getMembershipWatchPool()
    )
    setMembershipWatchPool(updatedPool)
    const memData = { live, upcoming }
    setMembershipCache(memData)
    const rssCache = getCache()
    const merged = mergeSchedules(rssCache, memData)
    return { data: merged, fromCache: false }
  } catch (err) {
    if (err.code === 403) return { error: 'QUOTA_EXCEEDED' }
    return { error: 'FETCH_FAILED' }
  }
})

// メンバーシップチャンネル管理
ipcMain.handle('membership:getChannels', () => getMembershipChannels())
ipcMain.handle('membership:setChannels', (_, channels) => {
  setMembershipChannels(channels)
  return { success: true }
})
ipcMain.handle('membership:resolveChannel', async (_, input) => {
  const client = await getAuthenticatedClient()
  if (!client) return { error: 'NOT_AUTHENTICATED' }
  return resolveChannel(client, input)
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

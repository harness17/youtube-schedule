import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getAuthenticatedClient, startAuthFlow, logout } from './auth.js'
import { fetchSchedule, addToWatchLater } from './youtube-api.js'
import { getCache, setCache } from './store.js'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

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
  const client = getAuthenticatedClient()
  return { isAuthenticated: !!client }
})

// ログイン
ipcMain.handle('auth:login', async () => {
  try {
    await startAuthFlow()
    return { isAuthenticated: true }
  } catch (err) {
    return { isAuthenticated: false, error: err.message }
  }
})

// ログアウト
ipcMain.handle('auth:logout', async () => {
  logout()
  return { isAuthenticated: false }
})

// 配信予定取得（キャッシュ優先）
ipcMain.handle('schedule:get', async () => {
  const cached = getCache()
  if (cached) return { data: cached, fromCache: true }
  const client = getAuthenticatedClient()
  if (!client) return { error: 'NOT_AUTHENTICATED' }
  try {
    const data = await fetchSchedule(client)
    setCache(data)
    return { data, fromCache: false }
  } catch (err) {
    if (err.code === 403) return { error: 'QUOTA_EXCEEDED' }
    return { error: 'FETCH_FAILED' }
  }
})

// 配信予定強制更新
ipcMain.handle('schedule:refresh', async () => {
  const client = getAuthenticatedClient()
  if (!client) return { error: 'NOT_AUTHENTICATED' }
  try {
    const data = await fetchSchedule(client)
    setCache(data)
    return { data, fromCache: false }
  } catch (err) {
    if (err.code === 403) return { error: 'QUOTA_EXCEEDED' }
    return { error: 'FETCH_FAILED' }
  }
})

// 後で見るに追加
ipcMain.handle('schedule:addToWatchLater', async (_, videoId) => {
  const client = getAuthenticatedClient()
  if (!client) return { error: 'NOT_AUTHENTICATED' }
  try {
    await addToWatchLater(client, videoId)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// 外部ブラウザで URL を開く
ipcMain.handle('shell:openExternal', async (_, url) => {
  await shell.openExternal(url)
})

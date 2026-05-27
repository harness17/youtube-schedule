import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handlers,
  ipcMainHandle,
  openPath,
  openExternal,
  Notification,
  notificationShow,
  getCredentialsPath
} = vi.hoisted(() => {
  const handlers = new Map()
  const notificationShow = vi.fn()
  const Notification = vi.fn().mockImplementation(function Notification(options) {
    return { options, show: notificationShow }
  })
  Notification.isSupported = vi.fn()
  return {
    handlers,
    ipcMainHandle: vi.fn((channel, handler) => handlers.set(channel, handler)),
    openPath: vi.fn().mockResolvedValue(''),
    openExternal: vi.fn().mockResolvedValue(undefined),
    Notification,
    notificationShow,
    getCredentialsPath: vi.fn().mockReturnValue('/safe/userData/credentials.json')
  }
})

vi.mock('electron', () => ({
  ipcMain: { handle: ipcMainHandle },
  app: { getVersion: () => '0.0.0-test' },
  shell: { openPath, openExternal },
  Notification
}))

vi.mock('../../../src/main/auth.js', () => ({ getCredentialsPath }))

const { registerAppHandlers } = await import('../../../src/main/ipc/appHandlers')

describe('appHandlers shell:openFolder', () => {
  let autoUpdater
  let mainWindow
  let onResetDatabase

  beforeEach(() => {
    handlers.clear()
    ipcMainHandle.mockClear()
    openPath.mockClear()
    openExternal.mockClear()
    Notification.mockClear()
    Notification.isSupported.mockReset()
    Notification.isSupported.mockReturnValue(false)
    notificationShow.mockClear()
    getCredentialsPath.mockClear()
    mainWindow = { webContents: { send: vi.fn() } }
    onResetDatabase = vi.fn().mockResolvedValue(undefined)
    autoUpdater = {
      on: vi.fn(),
      checkForUpdates: vi.fn(),
      quitAndInstall: vi.fn()
    }
    registerAppHandlers({
      getMainWindow: () => mainWindow,
      onResetDatabase,
      autoUpdater,
      isDev: false
    })
  })

  // regression: renderer 由来の任意 filePath は無視し、必ず main 側で credentialsPath を取る
  it('ignores renderer-provided path and opens credentialsPath dirname only', async () => {
    const handler = handlers.get('shell:openFolder')
    await handler({}, 'C:\\Windows\\System32')
    expect(getCredentialsPath).toHaveBeenCalledOnce()
    expect(openPath).toHaveBeenCalledWith('/safe/userData')
  })

  it('registers all app IPC channels', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'app:version',
      'notification:show',
      'schedule:resetDatabase',
      'shell:openExternal',
      'shell:openFolder',
      'updater:checkNow',
      'updater:quitAndInstall'
    ])
  })

  it('returns the Electron app version', async () => {
    expect(handlers.get('app:version')({})).toBe('0.0.0-test')
  })

  it('opens http and https URLs externally', async () => {
    await expect(handlers.get('shell:openExternal')({}, 'https://example.com')).resolves.toEqual({
      success: true
    })
    await expect(handlers.get('shell:openExternal')({}, 'http://example.com')).resolves.toEqual({
      success: true
    })
    expect(openExternal).toHaveBeenCalledWith('https://example.com')
    expect(openExternal).toHaveBeenCalledWith('http://example.com')
  })

  it('rejects non-http URL schemes before calling shell.openExternal', async () => {
    await expect(handlers.get('shell:openExternal')({}, 'file:///C:/secret.txt')).resolves.toEqual({
      success: false,
      error: 'Invalid URL scheme'
    })
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('rejects malformed external URLs', async () => {
    await expect(handlers.get('shell:openExternal')({}, 'not a url')).resolves.toEqual({
      success: false,
      error: 'Invalid URL'
    })
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('shows a desktop notification when notifications are supported', async () => {
    Notification.isSupported.mockReturnValue(true)

    await handlers.get('notification:show')({}, { title: 'Title', body: 'Body' })

    expect(Notification).toHaveBeenCalledWith({ title: 'Title', body: 'Body' })
    expect(notificationShow).toHaveBeenCalledOnce()
  })

  it('does not create a desktop notification when notifications are unsupported', async () => {
    Notification.isSupported.mockReturnValue(false)

    await handlers.get('notification:show')({}, { title: 'Title', body: 'Body' })

    expect(Notification).not.toHaveBeenCalled()
  })

  it('schedule:resetDatabase delegates reset work to the injected callback', async () => {
    await expect(handlers.get('schedule:resetDatabase')({})).resolves.toBeUndefined()
    expect(onResetDatabase).toHaveBeenCalledOnce()
  })

  it('updater:quitAndInstall delegates to autoUpdater', async () => {
    expect(handlers.get('updater:quitAndInstall')({})).toBeUndefined()
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce()
  })

  it('updater:checkNow checks updates in production mode', async () => {
    expect(handlers.get('updater:checkNow')({})).toBeUndefined()
    expect(autoUpdater.checkForUpdates).toHaveBeenCalledOnce()
    expect(mainWindow.webContents.send).not.toHaveBeenCalled()
  })

  it('updater:checkNow sends a renderer error and skips updater in dev mode', async () => {
    registerAppHandlers({
      getMainWindow: () => mainWindow,
      onResetDatabase,
      autoUpdater,
      isDev: true
    })

    expect(handlers.get('updater:checkNow')({})).toBeUndefined()
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
    expect(mainWindow.webContents.send).toHaveBeenCalledWith(
      'updater:error',
      '開発環境ではアップデート確認をスキップします'
    )
  })
})

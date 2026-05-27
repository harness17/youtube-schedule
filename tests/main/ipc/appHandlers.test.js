import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, ipcMainHandle, openPath, getCredentialsPath } = vi.hoisted(() => {
  const handlers = new Map()
  return {
    handlers,
    ipcMainHandle: vi.fn((channel, handler) => handlers.set(channel, handler)),
    openPath: vi.fn().mockResolvedValue(''),
    getCredentialsPath: vi.fn().mockReturnValue('/safe/userData/credentials.json')
  }
})

vi.mock('electron', () => ({
  ipcMain: { handle: ipcMainHandle },
  app: { getVersion: () => '0.0.0-test' },
  shell: { openPath },
  Notification: { isSupported: () => false }
}))

vi.mock('../../../src/main/auth.js', () => ({ getCredentialsPath }))

const { registerAppHandlers } = await import('../../../src/main/ipc/appHandlers')

describe('appHandlers shell:openFolder', () => {
  beforeEach(() => {
    handlers.clear()
    ipcMainHandle.mockClear()
    openPath.mockClear()
    getCredentialsPath.mockClear()
    registerAppHandlers({
      getMainWindow: () => undefined,
      onResetDatabase: async () => {},
      autoUpdater: { on: () => {}, checkForUpdates: () => {}, quitAndInstall: () => {} },
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
})

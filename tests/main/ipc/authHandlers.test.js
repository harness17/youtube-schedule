import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handlers,
  ipcMainHandle,
  showOpenDialog,
  credentialsExist,
  getCredentialsPath,
  getAuthenticatedClient,
  startAuthFlow,
  logout,
  importCredentialsFromFile
} = vi.hoisted(() => {
  const handlers = new Map()
  return {
    handlers,
    ipcMainHandle: vi.fn((channel, handler) => handlers.set(channel, handler)),
    showOpenDialog: vi.fn(),
    credentialsExist: vi.fn(),
    getCredentialsPath: vi.fn(),
    getAuthenticatedClient: vi.fn(),
    startAuthFlow: vi.fn(),
    logout: vi.fn(),
    importCredentialsFromFile: vi.fn()
  }
})

vi.mock('electron', () => ({
  ipcMain: { handle: ipcMainHandle },
  dialog: { showOpenDialog }
}))

vi.mock('../../../src/main/auth.js', () => ({
  credentialsExist,
  getCredentialsPath,
  getAuthenticatedClient,
  startAuthFlow,
  logout,
  importCredentialsFromFile
}))

const { registerAuthHandlers } = await import('../../../src/main/ipc/authHandlers')

function invoke(channel, ...args) {
  return handlers.get(channel)({}, ...args)
}

describe('authHandlers', () => {
  let onLoginSuccess
  let onLogoutSuccess

  beforeEach(() => {
    handlers.clear()
    ipcMainHandle.mockClear()
    showOpenDialog.mockReset()
    credentialsExist.mockReset()
    getCredentialsPath.mockReset()
    getAuthenticatedClient.mockReset()
    startAuthFlow.mockReset()
    logout.mockReset()
    importCredentialsFromFile.mockReset()
    onLoginSuccess = vi.fn()
    onLogoutSuccess = vi.fn()
    getCredentialsPath.mockReturnValue('/userData/credentials.json')
    registerAuthHandlers({ onLoginSuccess, onLogoutSuccess })
  })

  it('registers the expected auth IPC channels', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'auth:check',
      'auth:importCredentials',
      'auth:login',
      'auth:logout'
    ])
  })

  it('auth:check reports missing credentials without loading a token', async () => {
    credentialsExist.mockResolvedValue(false)

    await expect(invoke('auth:check')).resolves.toEqual({
      isAuthenticated: false,
      credentialsMissing: true,
      credentialsPath: '/userData/credentials.json'
    })
    expect(getAuthenticatedClient).not.toHaveBeenCalled()
  })

  it('auth:check reports authenticated when saved credentials load', async () => {
    credentialsExist.mockResolvedValue(true)
    getAuthenticatedClient.mockResolvedValue({ token: 'client' })

    await expect(invoke('auth:check')).resolves.toEqual({
      isAuthenticated: true,
      credentialsMissing: false,
      credentialsPath: '/userData/credentials.json'
    })
  })

  it('auth:check converts credential load errors to an unauthenticated response', async () => {
    credentialsExist.mockResolvedValue(true)
    getAuthenticatedClient.mockRejectedValue(new Error('invalid credentials'))

    await expect(invoke('auth:check')).resolves.toEqual({
      isAuthenticated: false,
      credentialsMissing: false,
      credentialsPath: '/userData/credentials.json',
      error: 'invalid credentials'
    })
  })

  it('auth:login returns CREDENTIALS_NOT_FOUND when credentials are absent', async () => {
    credentialsExist.mockResolvedValue(false)

    await expect(invoke('auth:login')).resolves.toEqual({
      isAuthenticated: false,
      error: 'CREDENTIALS_NOT_FOUND',
      credentialsPath: '/userData/credentials.json'
    })
    expect(startAuthFlow).not.toHaveBeenCalled()
  })

  it('auth:login starts auth flow and calls onLoginSuccess with the loaded client', async () => {
    const client = { id: 'client' }
    credentialsExist.mockResolvedValue(true)
    startAuthFlow.mockResolvedValue(undefined)
    getAuthenticatedClient.mockResolvedValue(client)

    await expect(invoke('auth:login')).resolves.toEqual({ isAuthenticated: true })
    expect(onLoginSuccess).toHaveBeenCalledWith(client)
  })

  // regression: startAuthFlow 成功直後に client が null だと UI 上はログイン成功
  // なのにスケジューラが初期化されず動画取得が動かない問題があった。
  // 明示的な失敗コード AUTH_CLIENT_NOT_AVAILABLE を返すよう修正
  it('auth:login reports AUTH_CLIENT_NOT_AVAILABLE when no client is loaded after flow', async () => {
    credentialsExist.mockResolvedValue(true)
    startAuthFlow.mockResolvedValue(undefined)
    getAuthenticatedClient.mockResolvedValue(null)

    await expect(invoke('auth:login')).resolves.toEqual({
      isAuthenticated: false,
      error: 'AUTH_CLIENT_NOT_AVAILABLE'
    })
    expect(onLoginSuccess).not.toHaveBeenCalled()
  })

  it('auth:login reports auth flow errors without calling onLoginSuccess', async () => {
    credentialsExist.mockResolvedValue(true)
    startAuthFlow.mockRejectedValue(new Error('access_denied'))

    await expect(invoke('auth:login')).resolves.toEqual({
      isAuthenticated: false,
      error: 'access_denied'
    })
    expect(onLoginSuccess).not.toHaveBeenCalled()
  })

  it('auth:logout removes saved credentials and calls onLogoutSuccess', async () => {
    await expect(invoke('auth:logout')).resolves.toEqual({ isAuthenticated: false })
    expect(logout).toHaveBeenCalledOnce()
    expect(onLogoutSuccess).toHaveBeenCalledOnce()
  })

  it('auth:importCredentials returns canceled when the picker is canceled', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })

    await expect(invoke('auth:importCredentials')).resolves.toEqual({ canceled: true })
    expect(importCredentialsFromFile).not.toHaveBeenCalled()
  })

  it('auth:importCredentials imports the selected credentials file', async () => {
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['C:/tmp/credentials.json'] })
    importCredentialsFromFile.mockResolvedValue({ credentialsPath: '/userData/credentials.json' })

    await expect(invoke('auth:importCredentials')).resolves.toEqual({
      success: true,
      credentialsPath: '/userData/credentials.json'
    })
    expect(importCredentialsFromFile).toHaveBeenCalledWith('C:/tmp/credentials.json')
  })

  it('auth:importCredentials returns validation errors', async () => {
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['C:/tmp/bad.json'] })
    importCredentialsFromFile.mockRejectedValue(new Error('client_id が見つかりません'))

    await expect(invoke('auth:importCredentials')).resolves.toEqual({
      error: 'client_id が見つかりません'
    })
  })
})

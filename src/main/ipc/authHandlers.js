/**
 * authHandlers — 認証系 IPC ハンドラ
 *
 * 登録チャンネル: auth:check / auth:login / auth:logout
 *
 * @param {{ onLoginSuccess: (client: object) => void, onLogoutSuccess: () => void }} deps
 *   onLoginSuccess: ログイン成功後にスケジューラー初期化とポーリング開始を
 *                   index.js 側で行うためのコールバック。
 *                   ハンドラが index.js の内部実装に直接依存しないようにするため
 *                   コールバック注入パターンを採用する。
 */
import { ipcMain } from 'electron'
import { dialog } from 'electron'
import {
  getAuthenticatedClient,
  startAuthFlow,
  logout,
  credentialsExist,
  getCredentialsPath,
  importCredentialsFromFile
} from '../auth.js'

export function registerAuthHandlers({ onLoginSuccess, onLogoutSuccess }) {
  // ---- 認証状態確認 -----------------------------------------------------------
  ipcMain.handle('auth:check', async () => {
    const exists = await credentialsExist()
    if (!exists) {
      return {
        isAuthenticated: false,
        credentialsMissing: true,
        credentialsPath: getCredentialsPath()
      }
    }
    // credentials.json が壊れている場合 validateOAuthCredentials が throw する。
    // 起動不能を避けるため、未認証扱いで返す。
    try {
      const client = await getAuthenticatedClient()
      return {
        isAuthenticated: !!client,
        credentialsMissing: false,
        credentialsPath: getCredentialsPath()
      }
    } catch (err) {
      return {
        isAuthenticated: false,
        credentialsMissing: false,
        credentialsPath: getCredentialsPath(),
        error: err.message
      }
    }
  })

  // ---- ログイン ----------------------------------------------------------------
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
      if (client) {
        // スケジューラーの初期化・ポーリング開始は index.js が行う。
        // このファイルはトランスポート層の責務のみ持ち、サービス層に依存しない
        await onLoginSuccess(client)
      }
      return { isAuthenticated: true }
    } catch (err) {
      return { isAuthenticated: false, error: err.message }
    }
  })

  // ---- ログアウト --------------------------------------------------------------
  ipcMain.handle('auth:logout', async () => {
    await logout()
    await onLogoutSuccess?.()
    return { isAuthenticated: false }
  })

  ipcMain.handle('auth:importCredentials', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      filters: [{ name: 'Google OAuth credentials', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (canceled || filePaths.length === 0) return { canceled: true }
    try {
      const result = await importCredentialsFromFile(filePaths[0])
      return { success: true, ...result }
    } catch (err) {
      return { error: err.message }
    }
  })
}

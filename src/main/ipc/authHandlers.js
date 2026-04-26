/**
 * authHandlers — 認証系 IPC ハンドラ
 *
 * 登録チャンネル: auth:check / auth:login / auth:logout
 *
 * @param {{ onLoginSuccess: (client: object) => void }} deps
 *   onLoginSuccess: ログイン成功後にスケジューラー初期化とポーリング開始を
 *                   index.js 側で行うためのコールバック。
 *                   ハンドラが index.js の内部実装に直接依存しないようにするため
 *                   コールバック注入パターンを採用する。
 */
import { ipcMain } from 'electron'
import {
  getAuthenticatedClient,
  startAuthFlow,
  logout,
  credentialsExist,
  getCredentialsPath
} from '../auth.js'

export function registerAuthHandlers({ onLoginSuccess }) {
  // ---- 認証状態確認 -----------------------------------------------------------
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
    return { isAuthenticated: false }
  })
}

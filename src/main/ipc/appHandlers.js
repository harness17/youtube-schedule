/**
 * appHandlers — アプリ基盤系 IPC ハンドラ
 *
 * 登録チャンネル:
 *   app:version
 *   shell:openFolder / shell:openExternal
 *   notification:show
 *   schedule:resetDatabase
 *   updater:quitAndInstall / updater:checkNow
 *
 * @param {{
 *   getMainWindow: () => import('electron').BrowserWindow | undefined,
 *   onResetDatabase: () => Promise<void>,
 *   autoUpdater: import('electron-updater').AppUpdater,
 *   isDev: boolean,
 * }} deps
 */
import { ipcMain, app, shell, Notification } from 'electron'
import { dirname } from 'path'

export function registerAppHandlers({ getMainWindow, onResetDatabase, autoUpdater, isDev }) {
  // ---- アプリバージョン --------------------------------------------------------
  ipcMain.handle('app:version', () => app.getVersion())

  // ---- ファイルシステム操作 ----------------------------------------------------

  // credentials.json のフォルダをエクスプローラーで開く
  ipcMain.handle('shell:openFolder', async (_, filePath) => {
    try {
      await shell.openPath(dirname(filePath))
      return { success: true }
    } catch {
      return { success: false }
    }
  })

  // 外部ブラウザで URL を開く（https/http のみ許可）
  ipcMain.handle('shell:openExternal', async (_, url) => {
    try {
      const parsed = new URL(url)
      // http 以外のスキームを弾くことで、OS コマンド実行などの悪意ある URL を防ぐ
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { success: false, error: 'Invalid URL scheme' }
      }
      await shell.openExternal(url)
      return { success: true }
    } catch {
      return { success: false, error: 'Invalid URL' }
    }
  })

  // ---- デスクトップ通知 --------------------------------------------------------
  ipcMain.handle('notification:show', (_, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show()
    }
  })

  // ---- データベースリセット ----------------------------------------------------
  // DBファイルを削除して再初期化する。
  // 実際の削除・再初期化は index.js の onResetDatabase コールバックに委ねる。
  // このファイルはDBパスや内部変数を直接知らない
  ipcMain.handle('schedule:resetDatabase', async () => {
    await onResetDatabase()
  })

  // ---- 自動アップデート --------------------------------------------------------
  ipcMain.handle('updater:quitAndInstall', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('updater:checkNow', () => {
    if (isDev) {
      // 開発環境では electron-updater が動作しないため renderer に通知して終了
      getMainWindow()?.webContents.send(
        'updater:error',
        '開発環境ではアップデート確認をスキップします'
      )
      return
    }
    autoUpdater.checkForUpdates()
  })
}

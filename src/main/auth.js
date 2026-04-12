import { authenticate } from '@google-cloud/local-auth'
import { google } from 'googleapis'
import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'

const SCOPES = ['https://www.googleapis.com/auth/youtube']

// credentials.json: プロジェクトルート（dev）または exe 隣（prod）
const CREDENTIALS_PATH = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'credentials.json')
  : path.join(process.cwd(), 'credentials.json')

// token.json: ユーザーデータディレクトリに自動保存
const TOKEN_PATH = path.join(app.getPath('userData'), 'token.json')

async function loadSavedCredentials() {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf-8')
    return google.auth.fromJSON(JSON.parse(content))
  } catch {
    return null
  }
}

async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8')
  const keys = JSON.parse(content)
  const key = keys.installed || keys.web
  await fs.writeFile(TOKEN_PATH, JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  }))
}

export async function getAuthenticatedClient() {
  return await loadSavedCredentials()
}

export async function startAuthFlow() {
  const client = await authenticate({ keyfilePath: CREDENTIALS_PATH, scopes: SCOPES })
  await saveCredentials(client)
  return client
}

export async function logout() {
  try { await fs.unlink(TOKEN_PATH) } catch { /* already removed */ }
}

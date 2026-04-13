import { google } from 'googleapis'
import { app, shell } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import http from 'http'
import { URL } from 'url'

const SCOPES = ['https://www.googleapis.com/auth/youtube.readonly']
const PORT = 3456
const REDIRECT_URI = `http://localhost:${PORT}/callback`

const CREDENTIALS_PATH = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'credentials.json')
  : path.join(process.cwd(), 'credentials.json')

const TOKEN_PATH = path.join(app.getPath('userData'), 'token.json')

const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>認証完了 — YouTube Schedule Viewer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f0f;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      text-align: center;
      padding: 48px 64px;
      background: #1a1a1a;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      max-width: 480px;
      width: 90%;
    }
    .icon {
      width: 72px;
      height: 72px;
      background: #FF0000;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 36px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 10px;
      color: #fff;
    }
    p {
      font-size: 14px;
      color: #aaa;
      line-height: 1.6;
    }
    .brand {
      margin-top: 32px;
      font-size: 12px;
      color: #555;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .dot {
      width: 8px;
      height: 8px;
      background: #FF0000;
      border-radius: 50%;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>認証が完了しました</h1>
    <p>Google アカウントとの連携が完了しました。<br />このタブを閉じてアプリに戻ってください。</p>
    <div class="brand">
      <div class="dot"></div>
      YouTube Schedule Viewer
    </div>
  </div>
</body>
</html>`

const ERROR_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>認証エラー — YouTube Schedule Viewer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f0f;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      text-align: center;
      padding: 48px 64px;
      background: #1a1a1a;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      max-width: 480px;
      width: 90%;
    }
    .icon {
      width: 72px;
      height: 72px;
      background: #555;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      font-size: 36px;
    }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 10px; }
    p { font-size: 14px; color: #aaa; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✕</div>
    <h1>認証に失敗しました</h1>
    <p>アプリに戻って再度お試しください。</p>
  </div>
</body>
</html>`

async function loadKeys() {
  const raw = JSON.parse(await fs.readFile(CREDENTIALS_PATH, 'utf-8'))
  return raw.installed || raw.web
}

async function loadSavedCredentials() {
  try {
    const { refresh_token } = JSON.parse(await fs.readFile(TOKEN_PATH, 'utf-8'))
    if (!refresh_token) return null
    const key = await loadKeys()
    const client = new google.auth.OAuth2(key.client_id, key.client_secret, REDIRECT_URI)
    client.setCredentials({ refresh_token })
    return client
  } catch {
    return null
  }
}

async function saveCredentials(client) {
  await fs.writeFile(
    TOKEN_PATH,
    JSON.stringify({ refresh_token: client.credentials.refresh_token })
  )
}

export async function credentialsExist() {
  try {
    await fs.access(CREDENTIALS_PATH)
    return true
  } catch {
    return false
  }
}

export function getCredentialsPath() {
  return CREDENTIALS_PATH
}

export async function getAuthenticatedClient() {
  return await loadSavedCredentials()
}

export async function startAuthFlow() {
  const key = await loadKeys()
  const oAuth2Client = new google.auth.OAuth2(key.client_id, key.client_secret, REDIRECT_URI)

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  })

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith('/callback')) return

      const url = new URL(req.url, `http://localhost:${PORT}`)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')

      if (error || !code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(ERROR_HTML)
        server.close()
        reject(new Error(error || 'No code received'))
        return
      }

      try {
        const { tokens } = await oAuth2Client.getToken(code)
        oAuth2Client.setCredentials(tokens)
        await saveCredentials(oAuth2Client)

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(SUCCESS_HTML)
        server.close()
        resolve(oAuth2Client)
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(ERROR_HTML)
        server.close()
        reject(err)
      }
    })

    server.listen(PORT, () => {
      shell.openExternal(authUrl)
    })

    server.on('error', (err) => {
      reject(err)
    })
  })
}

export async function logout() {
  try {
    await fs.unlink(TOKEN_PATH)
  } catch {
    /* already removed */
  }
}

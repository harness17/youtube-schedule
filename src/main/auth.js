import { google } from 'googleapis'
import http from 'http'
import { shell } from 'electron'
import { getTokens, setTokens, clearTokens } from './store.js'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3456/callback'

const SCOPES = [
  'https://www.googleapis.com/auth/youtube',
]

function createOAuthClient() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)
}

export function getAuthenticatedClient() {
  const tokens = getTokens()
  if (!tokens) return null
  const oauth2Client = createOAuthClient()
  oauth2Client.setCredentials(tokens)
  oauth2Client.on('tokens', (newTokens) => {
    if (newTokens.refresh_token) {
      setTokens({ ...tokens, ...newTokens })
    } else {
      setTokens({ ...tokens, access_token: newTokens.access_token })
    }
  })
  return oauth2Client
}

export async function startAuthFlow() {
  return new Promise((resolve, reject) => {
    const oauth2Client = createOAuthClient()
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    })

    const server = http.createServer(async (req, res) => {
      if (!req.url.startsWith('/callback')) return

      const url = new URL(req.url, 'http://localhost:3456')
      const error = url.searchParams.get('error')
      const code = url.searchParams.get('code')

      res.end('<html><body><h2>認証完了。このウィンドウを閉じてください。</h2></body></html>')
      server.close()

      if (error || !code) {
        reject(new Error(`OAuth error: ${error || 'no code returned'}`))
        return
      }

      try {
        const { tokens } = await oauth2Client.getToken(code)
        setTokens(tokens)
        oauth2Client.setCredentials(tokens)
        resolve(oauth2Client)
      } catch (err) {
        reject(err)
      }
    })

    server.on('error', (err) => {
      reject(new Error(`Local server error: ${err.message}`))
    })

    server.listen(3456, () => {
      shell.openExternal(authUrl)
    })
  })
}

export function logout() {
  clearTokens()
}

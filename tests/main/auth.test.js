import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs/promises'
import http from 'http'
import os from 'os'
import path from 'path'

const VALID_CREDENTIALS = {
  installed: {
    client_id: 'client-id',
    client_secret: 'client-secret',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token'
  }
}

function request(pathname) {
  return new Promise((resolve, reject) => {
    const url = new URL(`http://127.0.0.1:3456${pathname}`)
    http
      .get(
        {
          hostname: url.hostname,
          port: url.port,
          path: `${url.pathname}${url.search}`,
          agent: false
        },
        (res) => {
          let body = ''
          res.setEncoding('utf8')
          res.on('data', (chunk) => {
            body += chunk
          })
          res.on('end', () => resolve({ statusCode: res.statusCode, body }))
        }
      )
      .on('error', reject)
  })
}

async function waitForAuthServerClosed() {
  await new Promise((resolve) => setTimeout(resolve, 50))
}

describe('auth.js', () => {
  let tempRoot
  let tempDir
  let electronState
  let googleState
  let shell

  async function importAuth() {
    vi.resetModules()
    vi.doMock('electron', () => ({
      app: {
        isPackaged: true,
        getPath: (name) => {
          if (name === 'userData') return tempDir
          if (name === 'exe') return path.join(tempRoot, 'app', 'app.exe')
          return tempRoot
        }
      },
      shell
    }))
    vi.doMock('googleapis', () => ({
      google: {
        auth: {
          OAuth2: vi.fn().mockImplementation(function OAuth2(clientId, clientSecret, redirectUri) {
            const instance = {
              clientId,
              clientSecret,
              redirectUri,
              credentials: {},
              generateAuthUrl: googleState.generateAuthUrl,
              getToken: googleState.getToken,
              setCredentials: googleState.setCredentials
            }
            electronState.oauthInstances.push(instance)
            return instance
          })
        }
      }
    }))
    return await import('../../src/main/auth.js')
  }

  async function writeCredentials(data = VALID_CREDENTIALS) {
    await fs.writeFile(path.join(tempDir, 'credentials.json'), JSON.stringify(data), 'utf-8')
  }

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'youtom-auth-'))
    tempDir = path.join(tempRoot, 'userData')
    await fs.mkdir(tempDir, { recursive: true })
    shell = { openExternal: vi.fn().mockResolvedValue(undefined) }
    electronState = { oauthInstances: [] }
    googleState = {
      generateAuthUrl: vi.fn().mockImplementation(({ state }) => {
        googleState.lastState = state
        return `https://accounts.google.com/o/oauth2/auth?state=${state}`
      }),
      getToken: vi.fn().mockResolvedValue({ tokens: { refresh_token: 'refresh-token' } }),
      setCredentials: vi.fn(function setCredentials(tokens) {
        this.credentials = tokens
      }),
      lastState: null
    }
  })

  afterEach(async () => {
    vi.doUnmock('electron')
    vi.doUnmock('googleapis')
    vi.resetModules()
    await fs.rm(tempRoot, { recursive: true, force: true })
  })

  it('getCredentialsPath returns the packaged userData credentials path', async () => {
    const auth = await importAuth()

    expect(auth.getCredentialsPath()).toBe(path.join(tempDir, 'credentials.json'))
  })

  it('credentialsExist returns true when credentials.json exists', async () => {
    await writeCredentials()
    const auth = await importAuth()

    await expect(auth.credentialsExist()).resolves.toBe(true)
  })

  it('credentialsExist returns false when credentials.json is missing', async () => {
    const auth = await importAuth()

    await expect(auth.credentialsExist()).resolves.toBe(false)
  })

  it('credentialsExist migrates old packaged credentials from the executable folder', async () => {
    const oldDir = path.join(tempRoot, 'app')
    await fs.mkdir(oldDir, { recursive: true })
    const oldPath = path.join(oldDir, 'credentials.json')
    await fs.writeFile(oldPath, JSON.stringify(VALID_CREDENTIALS), 'utf-8')
    const auth = await importAuth()

    await expect(auth.credentialsExist()).resolves.toBe(true)
    expect(await fs.readFile(auth.getCredentialsPath(), 'utf-8')).toBe(
      JSON.stringify(VALID_CREDENTIALS)
    )
  })

  it('importCredentialsFromFile copies valid credentials into userData', async () => {
    const sourcePath = path.join(tempDir, 'source.json')
    const targetDir = path.join(tempDir, 'nested')
    const sourceData = { web: VALID_CREDENTIALS.installed }
    await fs.writeFile(sourcePath, JSON.stringify(sourceData), 'utf-8')
    tempDir = targetDir
    const auth = await importAuth()

    await expect(auth.importCredentialsFromFile(sourcePath)).resolves.toEqual({
      credentialsPath: path.join(targetDir, 'credentials.json')
    })
    expect(
      JSON.parse(await fs.readFile(path.join(targetDir, 'credentials.json'), 'utf-8'))
    ).toEqual(sourceData)
  })

  it('importCredentialsFromFile rejects invalid JSON', async () => {
    const sourcePath = path.join(tempDir, 'bad.json')
    await fs.writeFile(sourcePath, '{bad json', 'utf-8')
    const auth = await importAuth()

    await expect(auth.importCredentialsFromFile(sourcePath)).rejects.toThrow()
  })

  it('importCredentialsFromFile rejects structurally invalid OAuth credentials', async () => {
    const sourcePath = path.join(tempDir, 'invalid.json')
    await fs.writeFile(sourcePath, JSON.stringify({ installed: {} }), 'utf-8')
    const auth = await importAuth()

    await expect(auth.importCredentialsFromFile(sourcePath)).rejects.toThrow('client_id')
  })

  it('getAuthenticatedClient returns an OAuth client with saved refresh token', async () => {
    await writeCredentials()
    const tokenPath = path.join(tempDir, 'token.json')
    await fs.writeFile(tokenPath, JSON.stringify({ refresh_token: 'r1' }))
    // regression: 既存 token.json の mode を best-effort で 0o600 に締め直す
    const chmodSpy = vi.spyOn(fs, 'chmod')
    const auth = await importAuth()

    const client = await auth.getAuthenticatedClient()

    expect(client).toBe(electronState.oauthInstances[0])
    expect(client.clientId).toBe('client-id')
    expect(client.clientSecret).toBe('client-secret')
    expect(client.redirectUri).toBe('http://127.0.0.1:3456/callback')
    expect(googleState.setCredentials).toHaveBeenCalledWith({ refresh_token: 'r1' })
    expect(chmodSpy).toHaveBeenCalledWith(tokenPath, 0o600)
    chmodSpy.mockRestore()
  })

  it('getAuthenticatedClient returns null when token has no refresh_token', async () => {
    await writeCredentials()
    await fs.writeFile(path.join(tempDir, 'token.json'), JSON.stringify({ access_token: 'a1' }))
    const auth = await importAuth()

    await expect(auth.getAuthenticatedClient()).resolves.toBeNull()
  })

  it('getAuthenticatedClient returns null when token cannot be read', async () => {
    await writeCredentials()
    const auth = await importAuth()

    await expect(auth.getAuthenticatedClient()).resolves.toBeNull()
  })

  it('startAuthFlow opens the auth URL and saves the refresh token on callback success', async () => {
    await writeCredentials()
    const auth = await importAuth()

    const authPromise = auth.startAuthFlow()
    await vi.waitFor(() => expect(shell.openExternal).toHaveBeenCalledOnce())
    const state = googleState.lastState
    const response = await request(`/callback?code=abc&state=${encodeURIComponent(state)}`)
    const client = await authPromise

    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('認証が完了しました')
    expect(client).toBe(electronState.oauthInstances[0])
    expect(googleState.getToken).toHaveBeenCalledWith('abc')
    expect(googleState.setCredentials).toHaveBeenCalledWith({ refresh_token: 'refresh-token' })
    expect(JSON.parse(await fs.readFile(path.join(tempDir, 'token.json'), 'utf-8'))).toEqual({
      refresh_token: 'refresh-token'
    })
    await waitForAuthServerClosed()
  })

  it('startAuthFlow rejects when callback state does not match', async () => {
    await writeCredentials()
    const auth = await importAuth()

    const authPromise = auth.startAuthFlow()
    const rejection = authPromise.catch((err) => err)
    await vi.waitFor(() => expect(shell.openExternal).toHaveBeenCalledOnce())
    const response = await request('/callback?code=abc&state=wrong')

    expect(response.statusCode).toBe(200)
    await expect(rejection).resolves.toMatchObject({ message: 'state mismatch' })
    await expect(fs.access(path.join(tempDir, 'token.json'))).rejects.toThrow()
    await waitForAuthServerClosed()
  })

  it('startAuthFlow returns 404 for non-callback requests and keeps the flow open', async () => {
    await writeCredentials()
    const auth = await importAuth()

    const authPromise = auth.startAuthFlow()
    await vi.waitFor(() => expect(shell.openExternal).toHaveBeenCalledOnce())
    const notFound = await request('/favicon.ico')
    const state = googleState.lastState
    const success = await request(`/callback?code=abc&state=${encodeURIComponent(state)}`)

    expect(notFound.statusCode).toBe(404)
    expect(notFound.body).toBe('Not Found')
    expect(success.statusCode).toBe(200)
    await expect(authPromise).resolves.toBe(electronState.oauthInstances[0])
    await waitForAuthServerClosed()
  })

  it('startAuthFlow rejects callback errors without saving a token', async () => {
    await writeCredentials()
    const auth = await importAuth()

    const authPromise = auth.startAuthFlow()
    const rejection = authPromise.catch((err) => err)
    await vi.waitFor(() => expect(shell.openExternal).toHaveBeenCalledOnce())
    const state = googleState.lastState
    const response = await request(
      `/callback?error=access_denied&state=${encodeURIComponent(state)}`
    )

    expect(response.statusCode).toBe(200)
    await expect(rejection).resolves.toMatchObject({ message: 'access_denied' })
    await expect(fs.access(path.join(tempDir, 'token.json'))).rejects.toThrow()
    await waitForAuthServerClosed()
  })

  it('startAuthFlow rejects token exchange failures', async () => {
    await writeCredentials()
    googleState.getToken.mockRejectedValue(new Error('token failed'))
    const auth = await importAuth()

    const authPromise = auth.startAuthFlow()
    const rejection = authPromise.catch((err) => err)
    await vi.waitFor(() => expect(shell.openExternal).toHaveBeenCalledOnce())
    const state = googleState.lastState
    await request(`/callback?code=abc&state=${encodeURIComponent(state)}`)

    await expect(rejection).resolves.toMatchObject({ message: 'token failed' })
    await waitForAuthServerClosed()
  })

  it('logout removes token.json', async () => {
    await fs.writeFile(path.join(tempDir, 'token.json'), JSON.stringify({ refresh_token: 'r1' }))
    const auth = await importAuth()

    await auth.logout()

    await expect(fs.access(path.join(tempDir, 'token.json'))).rejects.toThrow()
  })

  it('logout ignores already missing token.json', async () => {
    const auth = await importAuth()

    await expect(auth.logout()).resolves.toBeUndefined()
  })
})

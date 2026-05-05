import { describe, it, expect } from 'vitest'
import { validateOAuthCredentials } from '../../../src/main/services/credentialsValidator'

const valid = {
  installed: {
    client_id: 'client-id.apps.googleusercontent.com',
    client_secret: 'secret',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token'
  }
}

describe('credentialsValidator', () => {
  it('accepts Google OAuth desktop credentials', () => {
    expect(validateOAuthCredentials(valid)).toEqual({
      type: 'installed',
      clientId: 'client-id.apps.googleusercontent.com'
    })
  })

  it('rejects files without OAuth client data', () => {
    expect(() => validateOAuthCredentials({ foo: 'bar' })).toThrow('OAuth')
  })

  it('rejects missing client_secret', () => {
    expect(() =>
      validateOAuthCredentials({ installed: { ...valid.installed, client_secret: '' } })
    ).toThrow('client_secret')
  })
})

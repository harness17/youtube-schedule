export function validateOAuthCredentials(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('credentials.json の形式が正しくありません')
  }

  const key = data.installed ?? data.web
  if (!key || typeof key !== 'object') {
    throw new Error('installed または web のOAuthクライアント情報が見つかりません')
  }

  if (typeof key.client_id !== 'string' || !key.client_id.trim()) {
    throw new Error('client_id が見つかりません')
  }

  if (typeof key.client_secret !== 'string' || !key.client_secret.trim()) {
    throw new Error('client_secret が見つかりません')
  }

  if (!key.auth_uri?.includes('accounts.google.com')) {
    throw new Error('Google OAuth の auth_uri が見つかりません')
  }

  if (!key.token_uri?.includes('oauth2.googleapis.com')) {
    throw new Error('Google OAuth の token_uri が見つかりません')
  }

  return {
    type: data.installed ? 'installed' : 'web',
    clientId: key.client_id
  }
}

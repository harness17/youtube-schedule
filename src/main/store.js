import Store from 'electron-store'

const store = new Store()

export function getTokens() {
  return store.get('tokens', null)
}

export function setTokens(tokens) {
  store.set('tokens', tokens)
}

export function clearTokens() {
  store.delete('tokens')
}

export function getCache() {
  return store.get('scheduleCache', null)
}

export function setCache(data) {
  store.set('scheduleCache', data)
}

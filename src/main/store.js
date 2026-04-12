import Store from 'electron-store'

const store = new Store()

export function getCache() {
  return store.get('scheduleCache', null)
}

export function setCache(data) {
  store.set('scheduleCache', data)
}

export function clearCache() {
  store.delete('scheduleCache')
}

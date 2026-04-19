import Store from 'electron-store'

const store = new Store()

export function getSetting(key, defaultValue) {
  return store.get(`settings.${key}`, defaultValue)
}

export function setSetting(key, value) {
  store.set(`settings.${key}`, value)
}

export function readLegacyScheduleCache() {
  return store.get('scheduleCache', null)
}

export function clearLegacyScheduleCache() {
  store.delete('scheduleCache')
}

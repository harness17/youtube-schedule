import Store from 'electron-store'

// キャッシュの有効期限
const CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2時間

const store = new Store()

// TTL チェック済み。期限切れまたは旧形式（タイムスタンプなし）の場合は null を返す
export function getCache() {
  const entry = store.get('scheduleCache', null)
  if (!entry || !entry.timestamp) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null
  return entry.data
}

export function setCache(data) {
  store.set('scheduleCache', { data, timestamp: Date.now() })
}

export function clearCache() {
  store.delete('scheduleCache')
}

export function getSetting(key, defaultValue) {
  return store.get(`settings.${key}`, defaultValue)
}

export function setSetting(key, value) {
  store.set(`settings.${key}`, value)
}

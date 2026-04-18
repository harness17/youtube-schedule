import Store from 'electron-store'

// キャッシュの有効期限
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24時間

// 配信終了判定の閾値：actualStartTime からこの時間が経過した live は終了済みとみなす
const LIVE_MAX_DURATION_MS = 24 * 60 * 60 * 1000 // 24時間

// 遅延配信バッファ：スケジュール時刻を過ぎてもこの時間内なら upcoming として保持
const UPCOMING_DELAY_BUFFER_MS = 2 * 60 * 60 * 1000 // 2時間

const store = new Store()

// キャッシュ返却時に古い配信を除外する
//   upcoming: scheduledStartTime が now より未来のもののみ
//   live:     actualStartTime があり、かつ開始から LIVE_MAX_DURATION_MS 以内のもののみ
function filterStale(data) {
  if (!data || typeof data !== 'object') return data
  const now = Date.now()
  const upcoming = Array.isArray(data.upcoming)
    ? data.upcoming.filter(
        (v) =>
          v.scheduledStartTime &&
          new Date(v.scheduledStartTime).getTime() > now - UPCOMING_DELAY_BUFFER_MS
      )
    : data.upcoming
  const live = Array.isArray(data.live)
    ? data.live.filter((v) => {
        if (!v.actualStartTime) return false
        return now - new Date(v.actualStartTime).getTime() < LIVE_MAX_DURATION_MS
      })
    : data.live
  return { ...data, live, upcoming }
}

// TTL チェック済み。期限切れまたは旧形式（タイムスタンプなし）の場合は null を返す
// 有効なキャッシュは filterStale で古い配信を除外して返す
export function getCache() {
  const entry = store.get('scheduleCache', null)
  if (!entry || !entry.timestamp) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null
  return filterStale(entry.data)
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

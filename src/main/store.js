import Store from 'electron-store'

// キャッシュの有効期限（RSS・メンバーシップ共通）
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24時間

// 配信終了判定の閾値：actualStartTime からこの時間が経過した live は終了済みとみなす
const LIVE_MAX_DURATION_MS = 24 * 60 * 60 * 1000 // 24時間

// キャッシュ返却時に古い配信を除外する
//   upcoming: scheduledStartTime が now より未来のもののみ
//   live:     actualStartTime があり、かつ開始から LIVE_MAX_DURATION_MS 以内のもののみ
function filterStale(data) {
  if (!data || typeof data !== 'object') return data
  const now = Date.now()
  const upcoming = Array.isArray(data.upcoming)
    ? data.upcoming.filter(
        (v) => v.scheduledStartTime && new Date(v.scheduledStartTime).getTime() > now
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

// ────────────────────────────────────────────
// スキーマ定義
//   membershipChannels: 型・デフォルト値を明示して不正データを防ぐ
//   scheduleCache / membershipCache: 内部管理のため型チェックは行わない
// ────────────────────────────────────────────
const store = new Store({
  schema: {
    membershipChannels: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          channelId: { type: 'string' },
          channelTitle: { type: 'string' }
        },
        required: ['channelId', 'channelTitle']
      }
    }
  }
})

// ────────────────────────────────────────────
// RSS スケジュールキャッシュ
//   保存形式: { data: { live, upcoming }, timestamp }
//   旧形式（タイムスタンプなし）や TTL 超過は null を返す
// ────────────────────────────────────────────
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

// ────────────────────────────────────────────
// メンバーシップチャンネル: [{ channelId, channelTitle }]
// ────────────────────────────────────────────
export function getMembershipChannels() {
  return store.get('membershipChannels', [])
}

export function setMembershipChannels(channels) {
  store.set('membershipChannels', channels)
}

// ────────────────────────────────────────────
// メンバーシップキャッシュ（タイムスタンプ付き・RSS と統一形式）
// ────────────────────────────────────────────
export function getMembershipCache() {
  return store.get('membershipCache', null)
}

// TTL チェック済みのメンバーシップキャッシュデータを返す（期限切れなら null）
export function getMembershipCacheData() {
  const entry = store.get('membershipCache', null)
  if (!entry || !entry.timestamp) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null
  return filterStale(entry.data)
}

export function setMembershipCache(data) {
  store.set('membershipCache', { data, timestamp: Date.now() })
}

// ────────────────────────────────────────────
// メンバーシップ監視プール
//   search.list upcoming で発見した動画IDを永続保存
//   videos.list で追跡し、終了・消滅したIDは削除する
// ────────────────────────────────────────────
export function getMembershipWatchPool() {
  return store.get('membershipWatchPool', [])
}

export function setMembershipWatchPool(ids) {
  store.set('membershipWatchPool', ids)
}

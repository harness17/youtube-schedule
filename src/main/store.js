import Store from 'electron-store'

// キャッシュの有効期限（RSS・メンバーシップ共通）
const CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2時間

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

export function setMembershipCache(data) {
  store.set('membershipCache', { data, timestamp: Date.now() })
}

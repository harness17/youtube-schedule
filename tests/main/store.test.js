import { describe, it, expect, vi } from 'vitest'

vi.mock('electron-store', () => {
  return {
    default: class {
      constructor() {
        this._data = {}
      }
      get(key, def) {
        return this._data[key] ?? def
      }
      set(key, val) {
        this._data[key] = val
      }
      delete(key) {
        delete this._data[key]
      }
    }
  }
})

const {
  getCache,
  setCache,
  clearCache,
  getMembershipChannels,
  setMembershipChannels,
  getMembershipCache,
  setMembershipCache,
  getMembershipWatchPool,
  setMembershipWatchPool
} = await import('../../src/main/store.js')

describe('store', () => {
  it('キャッシュの保存と取得ができる', () => {
    const data = [{ id: '1', title: 'test' }]
    setCache(data)
    expect(getCache()).toEqual(data)
  })

  it('キャッシュの削除ができる', () => {
    setCache([{ id: '1' }])
    clearCache()
    expect(getCache()).toBeNull()
  })
})

describe('membershipChannels', () => {
  it('デフォルトは空配列を返す', () => {
    expect(getMembershipChannels()).toEqual([])
  })

  it('チャンネルの保存と取得ができる', () => {
    const channels = [{ channelId: 'UC123456789', channelTitle: 'テストチャンネル' }]
    setMembershipChannels(channels)
    expect(getMembershipChannels()).toEqual(channels)
  })

  it('複数チャンネルを保存できる', () => {
    const channels = [
      { channelId: 'UC111', channelTitle: 'チャンネルA' },
      { channelId: 'UC222', channelTitle: 'チャンネルB' }
    ]
    setMembershipChannels(channels)
    expect(getMembershipChannels()).toHaveLength(2)
  })
})

describe('membershipCache', () => {
  it('保存したデータを取得できる', () => {
    const data = { live: [], upcoming: [{ id: '1', title: 'test' }] }
    setMembershipCache(data)
    const entry = getMembershipCache()
    expect(entry.data).toEqual(data)
  })

  it('タイムスタンプが数値で付与される', () => {
    setMembershipCache({ live: [], upcoming: [] })
    const entry = getMembershipCache()
    expect(entry.timestamp).toBeTypeOf('number')
    expect(entry.timestamp).toBeGreaterThan(0)
  })
})

describe('membershipWatchPool', () => {
  it('デフォルトは空配列を返す', () => {
    expect(getMembershipWatchPool()).toEqual([])
  })

  it('IDを保存して取得できる', () => {
    setMembershipWatchPool(['abc123', 'def456'])
    expect(getMembershipWatchPool()).toEqual(['abc123', 'def456'])
  })

  it('空配列で上書きできる', () => {
    setMembershipWatchPool(['abc123'])
    setMembershipWatchPool([])
    expect(getMembershipWatchPool()).toEqual([])
  })
})

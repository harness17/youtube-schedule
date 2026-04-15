import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// electron-store のモック（共有データで旧形式テストも可能にする）
let mockStoreData = {}
vi.mock('electron-store', () => {
  return {
    default: class {
      get(key, def) {
        return mockStoreData[key] ?? def
      }
      set(key, val) {
        mockStoreData[key] = val
      }
      delete(key) {
        delete mockStoreData[key]
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

beforeEach(() => {
  mockStoreData = {}
})

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

  describe('TTL', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('2時間以内はキャッシュを返す', () => {
      const data = [{ id: '1', title: 'test' }]
      setCache(data)
      vi.advanceTimersByTime(2 * 60 * 60 * 1000 - 1) // 2時間 - 1ms
      expect(getCache()).toEqual(data)
    })

    it('2時間経過後は null を返す', () => {
      const data = [{ id: '1', title: 'test' }]
      setCache(data)
      vi.advanceTimersByTime(2 * 60 * 60 * 1000 + 1) // 2時間 + 1ms
      expect(getCache()).toBeNull()
    })

    it('タイムスタンプなし（旧形式）は null を返す', () => {
      // 旧バージョンのキャッシュ形式（timestamp なし）を直接書き込む
      mockStoreData['scheduleCache'] = [{ id: 'old', title: '旧形式' }]
      expect(getCache()).toBeNull()
    })
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

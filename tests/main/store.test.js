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

const { getCache, setCache, clearCache } = await import('../../src/main/store.js')

beforeEach(() => {
  mockStoreData = {}
})

describe('store', () => {
  it('キャッシュの保存と取得ができる', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const data = { live: [], upcoming: [{ id: '1', scheduledStartTime: future }] }
    setCache(data)
    expect(getCache()).toEqual(data)
  })

  it('キャッシュの削除ができる', () => {
    setCache({ live: [], upcoming: [] })
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

    it('24時間以内はキャッシュを返す', () => {
      const future = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      const data = { live: [], upcoming: [{ id: '1', scheduledStartTime: future }] }
      setCache(data)
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 - 1) // 24時間 - 1ms
      expect(getCache()).toEqual(data)
    })

    it('24時間経過後は null を返す', () => {
      const data = { live: [], upcoming: [] }
      setCache(data)
      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1) // 24時間 + 1ms
      expect(getCache()).toBeNull()
    })

    it('タイムスタンプなし（旧形式）は null を返す', () => {
      // 旧バージョンのキャッシュ形式（timestamp なし）を直接書き込む
      mockStoreData['scheduleCache'] = { live: [], upcoming: [] }
      expect(getCache()).toBeNull()
    })
  })

  describe('キャッシュ返却時のフィルタ', () => {
    it('予定時刻が2時間超過した upcoming は除外される', () => {
      const veryPast = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3h前
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      setCache({
        live: [],
        upcoming: [
          { id: 'very-past', scheduledStartTime: veryPast },
          { id: 'future', scheduledStartTime: future }
        ]
      })
      const cached = getCache()
      expect(cached.upcoming).toHaveLength(1)
      expect(cached.upcoming[0].id).toBe('future')
    })

    it('遅延配信（2時間以内のスケジュール超過）はキャッシュに残る', () => {
      const delayed = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30分前（遅延中）
      setCache({ live: [], upcoming: [{ id: 'delayed', scheduledStartTime: delayed }] })
      const cached = getCache()
      expect(cached.upcoming).toHaveLength(1)
      expect(cached.upcoming[0].id).toBe('delayed')
    })

    it('scheduledStartTime が無い upcoming は除外される', () => {
      setCache({ live: [], upcoming: [{ id: 'nostart', scheduledStartTime: null }] })
      expect(getCache().upcoming).toHaveLength(0)
    })

    it('actualStartTime から 24時間以内の live は残る', () => {
      const recent = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() // 6h前
      setCache({ live: [{ id: 'recent', actualStartTime: recent }], upcoming: [] })
      expect(getCache().live).toHaveLength(1)
    })

    it('actualStartTime から 24時間超過の live は除外される', () => {
      const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() // 25h前
      setCache({ live: [{ id: 'old', actualStartTime: old }], upcoming: [] })
      expect(getCache().live).toHaveLength(0)
    })

    it('actualStartTime が無い live は除外される', () => {
      setCache({ live: [{ id: 'nostart', actualStartTime: null }], upcoming: [] })
      expect(getCache().live).toHaveLength(0)
    })
  })
})

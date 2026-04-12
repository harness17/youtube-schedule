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

const { getCache, setCache, clearCache } = await import('../../src/main/store.js')

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

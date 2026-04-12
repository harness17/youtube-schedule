import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron-store', () => {
  return {
    default: class {
      constructor() { this._data = {} }
      get(key, def) { return this._data[key] ?? def }
      set(key, val) { this._data[key] = val }
      delete(key) { delete this._data[key] }
    }
  }
})

const { getTokens, setTokens, clearTokens, getCache, setCache } = await import('../../src/main/store.js')

describe('store', () => {
  it('トークンの保存と取得ができる', () => {
    setTokens({ access_token: 'abc' })
    expect(getTokens()).toEqual({ access_token: 'abc' })
  })

  it('トークンの削除ができる', () => {
    setTokens({ access_token: 'abc' })
    clearTokens()
    expect(getTokens()).toBeNull()
  })

  it('キャッシュの保存と取得ができる', () => {
    const data = [{ id: '1', title: 'test' }]
    setCache(data)
    expect(getCache()).toEqual(data)
  })
})

import { describe, it, expect } from 'vitest'
import {
  buildSettingsExport,
  validateImportData,
  buildFavoritesExport,
  applyFavoritesImport
} from '../../../src/main/services/settingsPorter'

describe('buildSettingsExport', () => {
  it('version:1 のオブジェクトを返す', () => {
    const result = buildSettingsExport({ settings: { darkMode: true }, pinnedChannels: [] })
    expect(result.version).toBe(1)
  })

  it('exportedAt が ISO 文字列', () => {
    const result = buildSettingsExport({ settings: {}, pinnedChannels: [] })
    expect(() => new Date(result.exportedAt)).not.toThrow()
  })

  it('settings と pinnedChannels がそのまま含まれる', () => {
    const pinned = [{ id: 'UC1', title: 'A' }]
    const result = buildSettingsExport({ settings: { darkMode: false }, pinnedChannels: pinned })
    expect(result.settings.darkMode).toBe(false)
    expect(result.pinnedChannels).toEqual(pinned)
  })
})

describe('validateImportData', () => {
  it('version:1 は通過する', () => {
    expect(() => validateImportData({ version: 1 })).not.toThrow()
  })

  it('null は例外を投げる', () => {
    expect(() => validateImportData(null)).toThrow('Invalid format')
  })

  it('version:2 は例外を投げる', () => {
    expect(() => validateImportData({ version: 2 })).toThrow('Unknown version')
  })
})

describe('buildFavoritesExport', () => {
  it('version:1 のオブジェクトを返す', () => {
    const result = buildFavoritesExport([])
    expect(result.version).toBe(1)
  })

  it('必要なフィールドだけ含める', () => {
    const input = [{ id: 'v1', title: 'T', channelId: 'UC1', channelTitle: 'Ch', extra: 'x' }]
    const result = buildFavoritesExport(input)
    expect(result.favorites[0]).toEqual({
      id: 'v1',
      title: 'T',
      channelId: 'UC1',
      channelTitle: 'Ch',
      viewedAt: null
    })
    expect(result.favorites[0].extra).toBeUndefined()
  })

  it('viewedAt があれば保持し、なければ null になる', () => {
    const input = [
      { id: 'v1', title: 'T', channelId: 'UC1', channelTitle: 'Ch', viewedAt: 1700000000000 },
      { id: 'v2', title: 'T', channelId: 'UC1', channelTitle: 'Ch', viewedAt: null }
    ]
    const result = buildFavoritesExport(input)
    expect(result.favorites[0].viewedAt).toBe(1700000000000)
    expect(result.favorites[1].viewedAt).toBeNull()
  })
})

describe('applyFavoritesImport', () => {
  it('setFavorite が呼ばれ applied をカウントする', () => {
    const calls = []
    const setFav = (id, viewedAt) => {
      calls.push({ id, viewedAt })
      return true
    }
    const { applied, skipped } = applyFavoritesImport(
      { version: 1, favorites: [{ id: 'v1' }, { id: 'v2' }] },
      setFav
    )
    expect(calls).toEqual([
      { id: 'v1', viewedAt: null },
      { id: 'v2', viewedAt: null }
    ])
    expect(applied).toBe(2)
    expect(skipped).toBe(0)
  })

  it('viewedAt を setFavorite コールバックに引き渡す', () => {
    const calls = []
    const setFav = (id, viewedAt) => {
      calls.push({ id, viewedAt })
      return true
    }
    applyFavoritesImport(
      {
        version: 1,
        favorites: [
          { id: 'v1', viewedAt: 1700000000000 },
          { id: 'v2', viewedAt: null },
          { id: 'v3' }
        ]
      },
      setFav
    )
    expect(calls[0]).toEqual({ id: 'v1', viewedAt: 1700000000000 })
    expect(calls[1]).toEqual({ id: 'v2', viewedAt: null })
    expect(calls[2]).toEqual({ id: 'v3', viewedAt: null })
  })

  it('setFavorite が null を返すと skipped にカウントする', () => {
    const { applied, skipped } = applyFavoritesImport(
      { version: 1, favorites: [{ id: 'missing' }] },
      () => null
    )
    expect(applied).toBe(0)
    expect(skipped).toBe(1)
  })

  it('favorites が空配列でも例外を投げない', () => {
    const result = applyFavoritesImport({ version: 1, favorites: [] }, () => true)
    expect(result).toEqual({ applied: 0, skipped: 0 })
  })

  it('id が falsy なエントリをスキップする', () => {
    const { skipped } = applyFavoritesImport(
      { version: 1, favorites: [{ id: '' }, { id: null }] },
      () => true
    )
    expect(skipped).toBe(2)
  })
})

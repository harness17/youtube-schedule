import { describe, it, expect } from 'vitest'
import {
  buildSettingsExport,
  validateImportData,
  validateSettingsImport,
  validateFavoritesImport,
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

describe('validateSettingsImport', () => {
  it('settings を含む有効なデータは通過する', () => {
    expect(() =>
      validateSettingsImport({ version: 1, settings: { darkMode: true }, pinnedChannels: [] })
    ).not.toThrow()
  })

  it('favorites キーを持つデータはエラー（お気に入りファイルの誤投入）', () => {
    expect(() => validateSettingsImport({ version: 1, favorites: [] })).toThrow(
      'お気に入りのエクスポート'
    )
  })

  it('settings も pinnedChannels もないデータはエラー', () => {
    expect(() => validateSettingsImport({ version: 1 })).toThrow('settings または pinnedChannels')
  })

  it('version:1 以外はエラー', () => {
    expect(() => validateSettingsImport({ version: 2, settings: {} })).toThrow('Unknown version')
  })
})

describe('validateFavoritesImport', () => {
  it('favorites 配列を含む有効なデータは通過する', () => {
    expect(() => validateFavoritesImport({ version: 1, favorites: [] })).not.toThrow()
  })

  it('settings キーを持つデータはエラー（設定ファイルの誤投入）', () => {
    expect(() => validateFavoritesImport({ version: 1, settings: {}, pinnedChannels: [] })).toThrow(
      '設定のエクスポート'
    )
  })

  it('favorites が配列でない場合はエラー', () => {
    expect(() => validateFavoritesImport({ version: 1, favorites: 'not-array' })).toThrow(
      'favorites 配列'
    )
  })

  it('favorites キー自体がない場合はエラー', () => {
    expect(() => validateFavoritesImport({ version: 1 })).toThrow('favorites 配列')
  })

  it('version:1 以外はエラー', () => {
    expect(() => validateFavoritesImport({ version: 2, favorites: [] })).toThrow('Unknown version')
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
  it('importEntry が呼ばれ applied をカウントする', () => {
    const calls = []
    const importEntry = (entry) => {
      calls.push(entry)
      return true
    }
    const { applied, skipped } = applyFavoritesImport(
      {
        version: 1,
        favorites: [
          { id: 'v1', title: 'T1', channelId: 'UC1', channelTitle: 'Ch1', viewedAt: null },
          { id: 'v2', title: 'T2', channelId: 'UC1', channelTitle: 'Ch1', viewedAt: null }
        ]
      },
      importEntry
    )
    expect(calls.map((e) => e.id)).toEqual(['v1', 'v2'])
    expect(applied).toBe(2)
    expect(skipped).toBe(0)
  })

  it('エントリ全体がコールバックに渡される（viewedAt 含む）', () => {
    const calls = []
    applyFavoritesImport(
      {
        version: 1,
        favorites: [
          { id: 'v1', title: 'T', channelId: 'UC1', channelTitle: 'Ch', viewedAt: 1700000000000 },
          { id: 'v2', title: 'T', channelId: 'UC1', channelTitle: 'Ch', viewedAt: null }
        ]
      },
      (entry) => {
        calls.push(entry)
        return true
      }
    )
    expect(calls[0].viewedAt).toBe(1700000000000)
    expect(calls[1].viewedAt).toBeNull()
  })

  it('importEntry が null を返すと skipped にカウントする', () => {
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

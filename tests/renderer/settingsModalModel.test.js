import { describe, expect, it } from 'vitest'
import {
  SETTINGS_TAB_KEYS,
  getSettingsChannelGroups,
  manualVideoErrorMessage,
  manualVideoSuccessMessage,
  sortSettingsChannels
} from '../../src/renderer/src/settingsModalModel.js'

describe('settingsModalModel', () => {
  it('設定タブのキーを公開する', () => {
    expect(SETTINGS_TAB_KEYS).toEqual(['display', 'channels', 'data', 'connection', 'about'])
  })

  it('優先チャンネルを先頭にし、タイトル順に並べる', () => {
    const input = [
      { id: '3', title: 'Gamma', isPinned: false },
      { id: '2', title: 'Beta', isPinned: true },
      { id: '1', title: 'Alpha', isPinned: true }
    ]

    expect(sortSettingsChannels(input).map((channel) => channel.id)).toEqual(['1', '2', '3'])
    expect(input.map((channel) => channel.id)).toEqual(['3', '2', '1'])
  })

  it('タイトルがないチャンネルも並び替えできる', () => {
    const result = sortSettingsChannels([
      { id: '1', title: undefined, isPinned: false },
      { id: '2', title: 'Beta', isPinned: false }
    ])

    expect(result.map((channel) => channel.id)).toEqual(['1', '2'])
  })

  it('購読チャンネルと手動追加チャンネルを分ける', () => {
    const { subscriptionChannels, manualChannels } = getSettingsChannelGroups(
      [
        { id: 'sub', title: 'Alpha', isManual: false },
        { id: 'manual', title: 'Beta', isManual: true }
      ],
      ''
    )

    expect(subscriptionChannels.map((channel) => channel.id)).toEqual(['sub'])
    expect(manualChannels.map((channel) => channel.id)).toEqual(['manual'])
  })

  it('検索語は購読チャンネルだけに適用し、大文字小文字を区別しない', () => {
    const { subscriptionChannels, manualChannels } = getSettingsChannelGroups(
      [
        { id: 'sub1', title: 'Alpha Channel', isManual: false },
        { id: 'sub2', title: 'Beta Channel', isManual: false },
        { id: 'manual', title: 'Beta Manual', isManual: true }
      ],
      'ALPHA'
    )

    expect(subscriptionChannels.map((channel) => channel.id)).toEqual(['sub1'])
    expect(manualChannels.map((channel) => channel.id)).toEqual(['manual'])
  })

  it('動画追加の成功メッセージを作る', () => {
    expect(manualVideoSuccessMessage({ title: '限定配信' })).toBe('「限定配信」を追加しました')
    expect(manualVideoSuccessMessage(null)).toBe('「動画」を追加しました')
  })

  it('動画追加エラーコードを表示文言に変換する', () => {
    expect(manualVideoErrorMessage('INVALID_INPUT')).toContain('形式が正しくありません')
    expect(manualVideoErrorMessage('NOT_AUTHENTICATED')).toContain('ログインが必要')
    expect(manualVideoErrorMessage('NOT_FOUND')).toContain('動画が見つかりません')
    expect(manualVideoErrorMessage('FETCH_FAILED')).toContain('取得に失敗')
    expect(manualVideoErrorMessage('UNKNOWN')).toBe('追加に失敗しました')
  })
})

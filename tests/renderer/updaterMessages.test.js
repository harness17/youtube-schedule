import { describe, it, expect } from 'vitest'
import { updaterErrorMessage } from '../../src/renderer/src/updaterMessages'

describe('updaterErrorMessage', () => {
  it('既知のエラーコードを日本語メッセージへ変換する', () => {
    expect(updaterErrorMessage('UPDATE_CHECK_FAILED')).toBe(
      '更新の確認に失敗しました。時間をおいて再試行してください。'
    )
  })

  it('既に日本語化済みの文字列はそのまま返す', () => {
    const msg = '開発環境ではアップデート確認をスキップします'
    expect(updaterErrorMessage(msg)).toBe(msg)
  })

  it('未知のコードはそのまま返す（フォールバック）', () => {
    expect(updaterErrorMessage('SOMETHING_ELSE')).toBe('SOMETHING_ELSE')
  })
})

import { describe, it, expect } from 'vitest'
import { APP_TABS, getVisibleTabs } from '../../src/renderer/src/appTabsModel.js'

describe('getVisibleTabs', () => {
  it('未認証時は simple と both モードのタブを返す', () => {
    expect(getVisibleTabs(false).map((tab) => tab.key)).toEqual(['feed', 'favorites'])
  })

  it('認証済みなら full と both のタブを返す', () => {
    expect(getVisibleTabs(true).map((tab) => tab.key)).toEqual([
      'schedule',
      'missed',
      'archive',
      'stats',
      'favorites',
      'playlist'
    ])
  })

  it('full モードタブは認証解除時のリセット対象と一致する', () => {
    expect(APP_TABS.filter((tab) => tab.mode === 'full').map((tab) => tab.key)).toEqual([
      'schedule',
      'missed',
      'archive',
      'stats',
      'playlist'
    ])
  })
})

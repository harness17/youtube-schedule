import { describe, it, expect } from 'vitest'
import {
  isArchiveChannelOnly,
  toggleArchiveChannelOnly
} from '../../src/renderer/src/channelFilter.js'

describe('isArchiveChannelOnly', () => {
  it('そのチャンネル単独で選択中なら true', () => {
    expect(isArchiveChannelOnly(['UC_a'], 'UC_a')).toBe(true)
  })

  it('未選択（空配列）なら false', () => {
    expect(isArchiveChannelOnly([], 'UC_a')).toBe(false)
  })

  it('別チャンネル単独選択中なら false', () => {
    expect(isArchiveChannelOnly(['UC_b'], 'UC_a')).toBe(false)
  })

  it('複数選択中は対象を含んでいても false', () => {
    expect(isArchiveChannelOnly(['UC_a', 'UC_b'], 'UC_a')).toBe(false)
  })
})

describe('toggleArchiveChannelOnly', () => {
  it('そのチャンネル単独で選択中なら空にする（トグル解除）', () => {
    expect(toggleArchiveChannelOnly(['UC_a'], 'UC_a')).toEqual([])
  })

  it('未選択ならそのチャンネル単独にする', () => {
    expect(toggleArchiveChannelOnly([], 'UC_a')).toEqual(['UC_a'])
  })

  it('別チャンネル選択中ならそのチャンネル単独に置換する', () => {
    expect(toggleArchiveChannelOnly(['UC_b'], 'UC_a')).toEqual(['UC_a'])
  })

  it('複数選択中ならそのチャンネル単独に置換する', () => {
    expect(toggleArchiveChannelOnly(['UC_a', 'UC_b'], 'UC_a')).toEqual(['UC_a'])
  })
})

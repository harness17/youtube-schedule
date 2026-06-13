import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useStats } from '../../../src/renderer/hooks/useStats.js'

beforeEach(() => {
  window.api = {
    getChannelActivityStats: vi.fn().mockResolvedValue({
      unwatchedPinned: [
        { id: 'video-1', isFavorite: false, isNotify: false },
        { id: 'video-2', isFavorite: false, isNotify: false }
      ],
      silentChannels: [],
      frequencyRanking: [],
      viewedRates: [],
      unviewedBacklog: [],
      favoriteChannels: []
    }),
    onScheduleUpdated: vi.fn(() => vi.fn())
  }
})

describe('useStats', () => {
  it('loads stats when active', async () => {
    const { result } = renderHook(() => useStats(true))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.stats.unwatchedPinned).toHaveLength(2)
  })

  it('patchVideo updates only the matching unwatchedPinned item immutably', async () => {
    const { result } = renderHook(() => useStats(true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const before = result.current.stats.unwatchedPinned

    act(() => {
      result.current.patchVideo('video-1', { isFavorite: 1 })
    })

    const after = result.current.stats.unwatchedPinned
    expect(after).not.toBe(before) // 新しい配列参照（再レンダーされる）
    expect(after[0]).toEqual({ id: 'video-1', isFavorite: 1, isNotify: false })
    expect(after[1]).toBe(before[1]) // 一致しない item は同一参照のまま
  })

  it('patchVideo is a no-op when the id is not present', async () => {
    const { result } = renderHook(() => useStats(true))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.patchVideo('missing', { isNotify: 1 })
    })

    expect(result.current.stats.unwatchedPinned).toEqual([
      { id: 'video-1', isFavorite: false, isNotify: false },
      { id: 'video-2', isFavorite: false, isNotify: false }
    ])
  })
})

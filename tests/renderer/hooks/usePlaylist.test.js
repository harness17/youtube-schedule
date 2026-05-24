import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlaylist } from '../../../src/renderer/hooks/usePlaylist.js'

const config = {
  playlistId: 'PL_TEST',
  playlistTitle: 'お気に入り動画',
  lastSyncedAt: Date.now(),
  enabled: true
}

const video = {
  id: 'v1',
  title: '動画1',
  channelId: 'UC1',
  channelTitle: 'チャンネル1'
}

let updatedHandler
let errorHandler
let unsubscribeUpdated
let unsubscribeError

beforeEach(() => {
  updatedHandler = null
  errorHandler = null
  unsubscribeUpdated = vi.fn()
  unsubscribeError = vi.fn()
  window.api = {
    playlist: {
      getConfig: vi.fn().mockResolvedValue(config),
      get: vi.fn(({ filter }) => Promise.resolve(filter === 'removed' ? [] : [video])),
      refresh: vi.fn().mockResolvedValue({ added: 1, removed: 0, restored: 0 }),
      cleanup: vi.fn().mockResolvedValue({ deleted: 1 }),
      deleteOne: vi.fn().mockResolvedValue({ deleted: 1 }),
      onUpdated: vi.fn((cb) => {
        updatedHandler = cb
        return unsubscribeUpdated
      }),
      onError: vi.fn((cb) => {
        errorHandler = cb
        return unsubscribeError
      })
    }
  }
})

describe('usePlaylist', () => {
  it('loads config and playlist videos', async () => {
    const { result } = renderHook(() => usePlaylist(true))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.config).toEqual(config)
    expect(result.current.configured).toBe(true)
    expect(result.current.videos).toEqual([{ ...video, isRemovedFromPlaylist: false }])
  })

  it('refreshes and reloads playlist data', async () => {
    const { result } = renderHook(() => usePlaylist(true))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.refresh()
    })

    expect(window.api.playlist.refresh).toHaveBeenCalled()
    expect(window.api.playlist.get).toHaveBeenCalledWith({ filter: 'all' })
  })

  it('maps refresh errors to Japanese messages', async () => {
    window.api.playlist.refresh.mockResolvedValueOnce({ error: 'QUOTA_EXCEEDED' })
    const { result } = renderHook(() => usePlaylist(true))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.errorMessage).toContain('YouTube API クォータ上限')
  })

  it('reloads on playlist updated event and unsubscribes listeners', async () => {
    const { result, unmount } = renderHook(() => usePlaylist(true))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      updatedHandler({ added: 0, removed: 1, restored: 0 })
    })

    expect(result.current.lastResult).toEqual({ added: 0, removed: 1, restored: 0 })
    unmount()
    expect(unsubscribeUpdated).toHaveBeenCalled()
    expect(unsubscribeError).toHaveBeenCalled()
  })

  it('handles playlist error events', async () => {
    const { result } = renderHook(() => usePlaylist(true))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      errorHandler({ message: 'PLAYLIST_NOT_FOUND' })
    })

    expect(result.current.errorMessage).toContain('削除/非公開化')
  })

  it('applies local video updates without reloading playlist data', async () => {
    const removedVideo = { ...video, id: 'removed' }
    window.api.playlist.get.mockImplementation(({ filter }) =>
      Promise.resolve(filter === 'removed' ? [removedVideo] : [video, removedVideo])
    )
    const { result } = renderHook(() => usePlaylist(true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    window.api.playlist.get.mockClear()

    act(() => {
      result.current.applyVideoUpdate('removed', { isNotify: true })
    })

    expect(result.current.videos.find((item) => item.id === 'removed')).toMatchObject({
      isNotify: true
    })
    expect(result.current.removedVideos.find((item) => item.id === 'removed')).toMatchObject({
      isNotify: true
    })
    expect(window.api.playlist.get).not.toHaveBeenCalled()
  })

  it('deletes one removed video locally without reloading playlist data', async () => {
    const { result } = renderHook(() => usePlaylist(true))
    await waitFor(() => expect(result.current.loading).toBe(false))
    window.api.playlist.get.mockClear()

    await act(async () => {
      await result.current.deleteOne('v1')
    })

    expect(window.api.playlist.deleteOne).toHaveBeenCalledWith('v1')
    expect(result.current.videos).toEqual([])
    expect(window.api.playlist.get).not.toHaveBeenCalled()
  })
})

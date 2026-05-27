import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSchedule } from '../../../src/renderer/hooks/useSchedule.js'

let scheduleUpdatedHandler
let scheduleErrorHandler
let unsubscribeUpdated
let unsubscribeError

beforeEach(() => {
  scheduleUpdatedHandler = null
  scheduleErrorHandler = null
  unsubscribeUpdated = vi.fn()
  unsubscribeError = vi.fn()
  window.api = {
    getSchedule: vi.fn().mockResolvedValue({
      live: [],
      upcoming: [{ id: 'upcoming-1', status: 'upcoming' }]
    }),
    getFeed: vi.fn().mockResolvedValue({ videos: [{ id: 'feed-1' }] }),
    refreshSchedule: vi.fn().mockResolvedValue({ ok: true }),
    onScheduleUpdated: vi.fn((cb) => {
      scheduleUpdatedHandler = cb
      return unsubscribeUpdated
    }),
    onScheduleError: vi.fn((cb) => {
      scheduleErrorHandler = cb
      return unsubscribeError
    })
  }
})

describe('useSchedule', () => {
  it('loads schedule and feed on mount', async () => {
    const { result } = renderHook(() => useSchedule())

    await waitFor(() => expect(result.current.initialLoaded).toBe(true))

    expect(result.current.upcoming).toEqual([{ id: 'upcoming-1', status: 'upcoming' }])
    expect(result.current.feedVideos).toEqual([{ id: 'feed-1' }])
    expect(result.current.loading).toBe(false)
  })

  it('manual refresh reloads data even if the schedule updated event is delayed', async () => {
    const { result } = renderHook(() => useSchedule())
    await waitFor(() => expect(result.current.initialLoaded).toBe(true))
    window.api.getSchedule.mockResolvedValueOnce({
      live: [{ id: 'live-1', status: 'live' }],
      upcoming: []
    })

    await act(async () => {
      await result.current.refresh()
    })

    expect(window.api.refreshSchedule).toHaveBeenCalled()
    expect(result.current.live).toEqual([{ id: 'live-1', status: 'live' }])
    expect(result.current.loading).toBe(false)
  })

  it('manual refresh result errors clear loading and expose the error code', async () => {
    window.api.refreshSchedule.mockResolvedValueOnce({ error: 'REFRESH_FAILED' })
    const { result } = renderHook(() => useSchedule())
    await waitFor(() => expect(result.current.initialLoaded).toBe(true))

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.error).toBe('REFRESH_FAILED')
    expect(result.current.loading).toBe(false)
  })

  it('reloads when the schedule updated event arrives', async () => {
    const { result } = renderHook(() => useSchedule())
    await waitFor(() => expect(result.current.initialLoaded).toBe(true))
    window.api.getSchedule.mockResolvedValueOnce({
      live: [{ id: 'event-live', status: 'live' }],
      upcoming: []
    })

    await act(async () => {
      await scheduleUpdatedHandler()
    })

    expect(result.current.live).toEqual([{ id: 'event-live', status: 'live' }])
  })

  it('exposes background schedule errors and clears loading state', async () => {
    const { result, unmount } = renderHook(() => useSchedule())
    await waitFor(() => expect(result.current.initialLoaded).toBe(true))

    await act(async () => {
      scheduleErrorHandler({ error: 'REFRESH_FAILED' })
    })

    expect(result.current.error).toBe('REFRESH_FAILED')
    expect(result.current.loading).toBe(false)

    unmount()
    expect(unsubscribeUpdated).toHaveBeenCalled()
    expect(unsubscribeError).toHaveBeenCalled()
  })
})

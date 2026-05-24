import { describe, expect, it, vi } from 'vitest'
import { startPlaylistPolling } from '../../../src/main/services/playlistPolling'

describe('startPlaylistPolling', () => {
  it('clears existing timer and does not kick playlist refresh without auth', () => {
    let timer = 'existing'
    const scheduler = { refreshPlaylistIfDue: vi.fn() }
    const clearIntervalFn = vi.fn()
    const setIntervalFn = vi.fn()

    const started = startPlaylistPolling({
      authClient: null,
      scheduler,
      mainWindow: { webContents: { send: vi.fn() } },
      intervalMs: 1000,
      getTimer: () => timer,
      setTimer: (nextTimer) => {
        timer = nextTimer
      },
      clearIntervalFn,
      setIntervalFn
    })

    expect(started).toBe(false)
    expect(clearIntervalFn).toHaveBeenCalledWith('existing')
    expect(timer).toBeNull()
    expect(scheduler.refreshPlaylistIfDue).not.toHaveBeenCalled()
    expect(setIntervalFn).not.toHaveBeenCalled()
  })

  it('kicks immediately and schedules periodic refresh when authenticated', async () => {
    let timer = null
    const mainWindow = { webContents: { send: vi.fn() } }
    const scheduler = {
      refreshPlaylistIfDue: vi.fn().mockResolvedValue({ added: 1, removed: 0, restored: 0 })
    }
    const setIntervalFn = vi.fn().mockReturnValue('timer')

    const started = startPlaylistPolling({
      authClient: {},
      scheduler,
      mainWindow,
      intervalMs: 1000,
      getTimer: () => timer,
      setTimer: (nextTimer) => {
        timer = nextTimer
      },
      setIntervalFn,
      clearIntervalFn: vi.fn()
    })

    await Promise.resolve()

    expect(started).toBe(true)
    expect(scheduler.refreshPlaylistIfDue).toHaveBeenCalledTimes(1)
    expect(mainWindow.webContents.send).toHaveBeenCalledWith('playlist:updated', {
      added: 1,
      removed: 0,
      restored: 0
    })
    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 1000)
    expect(timer).toBe('timer')
  })
})

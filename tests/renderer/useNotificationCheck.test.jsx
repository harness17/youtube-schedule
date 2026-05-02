import { render } from '@testing-library/react'
import PropTypes from 'prop-types'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useNotificationCheck } from '../../src/renderer/hooks/useNotificationCheck.js'

const baseLive = {
  id: 'live-1',
  status: 'live',
  title: 'ライブ配信',
  channelTitle: 'テストチャンネル',
  scheduledStartTime: Date.now() - 60_000,
  actualStartTime: Date.now()
}

const baseUpcoming = {
  id: 'upcoming-1',
  status: 'upcoming',
  title: '予定配信',
  channelTitle: 'テストチャンネル',
  scheduledStartTime: Date.now() + 10 * 60_000,
  actualStartTime: null,
  isNotify: true
}

function HookHost({ upcoming = [], live = [], isAuthenticated = true, reminderMinutes = 5 }) {
  useNotificationCheck({ upcoming, live, isAuthenticated, reminderMinutes })
  return null
}

HookHost.propTypes = {
  upcoming: PropTypes.array,
  live: PropTypes.array,
  isAuthenticated: PropTypes.bool,
  reminderMinutes: PropTypes.number
}

beforeEach(() => {
  window.api = {
    showNotification: vi.fn()
  }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useNotificationCheck', () => {
  it('初回表示時点ですでに live の配信ではライブ開始通知を出さない', () => {
    render(<HookHost live={[{ ...baseLive, isNotify: true }]} />)
    expect(window.api.showNotification).not.toHaveBeenCalled()
  })

  it('通知登録済みの配信が新しく live に入ったときライブ開始通知を出す', () => {
    const { rerender } = render(<HookHost live={[]} />)
    rerender(<HookHost live={[{ ...baseLive, isNotify: true }]} />)

    expect(window.api.showNotification).toHaveBeenCalledWith(
      '配信が始まりました',
      'テストチャンネル「ライブ配信」がライブ配信を開始しました'
    )
  })

  it('通知登録されていない配信が live になっても通知を出さない', () => {
    const { rerender } = render(<HookHost live={[]} />)
    rerender(<HookHost live={[{ ...baseLive, isNotify: false }]} />)

    expect(window.api.showNotification).not.toHaveBeenCalled()
  })

  it('同じ live 配信ではライブ開始通知を1回だけ出す', () => {
    const item = { ...baseLive, isNotify: true }
    const { rerender } = render(<HookHost live={[]} />)
    rerender(<HookHost live={[item]} />)
    rerender(<HookHost live={[{ ...item, concurrentViewers: 1200 }]} />)

    expect(window.api.showNotification).toHaveBeenCalledTimes(1)
  })

  it('未認証中は live 配信が入っても通知を出さない', () => {
    const { rerender } = render(<HookHost live={[]} isAuthenticated={false} />)
    rerender(<HookHost live={[{ ...baseLive, isNotify: true }]} isAuthenticated={false} />)

    expect(window.api.showNotification).not.toHaveBeenCalled()
  })

  it('設定した分数以内に入った配信前通知を出す', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-02T10:00:00Z'))
    const upcoming = [
      {
        ...baseUpcoming,
        scheduledStartTime: new Date('2026-05-02T10:10:00Z').toISOString()
      }
    ]

    render(<HookHost upcoming={upcoming} reminderMinutes={10} />)
    vi.advanceTimersByTime(60_000)

    expect(window.api.showNotification).toHaveBeenCalledWith(
      'もうすぐ配信開始',
      'テストチャンネル「予定配信」が10分後に始まります'
    )
  })

  it('設定した分数より先の配信では配信前通知を出さない', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-02T10:00:00Z'))
    const upcoming = [
      {
        ...baseUpcoming,
        scheduledStartTime: new Date('2026-05-02T10:10:00Z').toISOString()
      }
    ]

    render(<HookHost upcoming={upcoming} reminderMinutes={5} />)
    vi.advanceTimersByTime(60_000)

    expect(window.api.showNotification).not.toHaveBeenCalled()
  })
})

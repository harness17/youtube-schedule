import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import StatsTab from '../../src/renderer/components/StatsTab.jsx'

const baseStats = {
  unwatchedPinned: [],
  silentChannels: [],
  frequencyRanking: []
}

beforeEach(() => {
  window.api = {
    openExternal: vi.fn().mockResolvedValue({ success: true })
  }
})

describe('StatsTab', () => {
  it('renders empty state for the default active section (unwatched)', () => {
    render(<StatsTab stats={baseStats} />)

    expect(screen.getByText('推し見落としチェック')).toBeInTheDocument()
    expect(screen.getByText('見逃しなし ✨')).toBeInTheDocument()
    // 沈黙・ランキングはサブナビには出るが、本文は非表示
    expect(
      screen.queryByText('60日以上配信していないチャンネルはありません')
    ).not.toBeInTheDocument()
    expect(screen.queryByText('ランキング対象の配信はありません')).not.toBeInTheDocument()
  })

  it('switches sections via sub-nav', () => {
    render(<StatsTab stats={baseStats} />)

    fireEvent.click(screen.getByRole('button', { name: /沈黙チャンネル/ }))
    expect(screen.getByText('60日以上配信していないチャンネルはありません')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /配信頻度ランキング/ }))
    expect(screen.getByText('ランキング対象の配信はありません')).toBeInTheDocument()
  })

  it('renders stats data and opens links for silent channels and ranking', () => {
    render(
      <StatsTab
        stats={{
          unwatchedPinned: [
            {
              id: 'v1',
              status: 'ended',
              title: '見落とし配信',
              channelTitle: 'Pinned Channel',
              channelId: 'UC_PIN',
              description: '',
              thumbnail: 'https://example.com/thumb.jpg',
              scheduledStartTime: null,
              actualStartTime: Date.parse('2026-05-01T00:00:00Z'),
              concurrentViewers: null,
              url: 'https://www.youtube.com/watch?v=v1',
              isNotify: false,
              isFavorite: false
            }
          ],
          silentChannels: [
            {
              id: 'UC_MANUAL',
              title: 'Manual Channel',
              category: 'manual',
              isPinned: false,
              isManual: true,
              lastActivityAt: Date.parse('2026-01-01T00:00:00Z'),
              silentDays: 139
            }
          ],
          frequencyRanking: [
            {
              channelId: 'UC_PIN',
              channelTitle: 'Pinned Channel',
              count: 3,
              isPinned: true,
              channelUrl: 'https://www.youtube.com/channel/UC_PIN'
            }
          ]
        }}
      />
    )

    // 初期表示は推し見落とし
    expect(screen.getByText('見落とし配信')).toBeInTheDocument()

    // 沈黙チャンネルへ切り替えてリンククリック
    fireEvent.click(screen.getByRole('button', { name: /沈黙チャンネル/ }))
    fireEvent.click(screen.getByRole('button', { name: /Manual Channel/ }))
    expect(window.api.openExternal).toHaveBeenCalledWith(
      'https://www.youtube.com/channel/UC_MANUAL'
    )

    // 配信頻度ランキングへ切り替えてリンククリック
    fireEvent.click(screen.getByRole('button', { name: /配信頻度ランキング/ }))
    expect(screen.getByText('3件')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Pinned Channel/ }))
    expect(window.api.openExternal).toHaveBeenCalledWith('https://www.youtube.com/channel/UC_PIN')
  })
})

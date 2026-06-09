import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import StatsTab from '../../src/renderer/components/StatsTab.jsx'

const baseStats = {
  unwatchedPinned: [],
  silentChannels: [],
  frequencyRanking: [],
  viewedRates: [],
  unviewedBacklog: [],
  favoriteChannels: []
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
    expect(screen.queryByText('60日以上活動のないチャンネルはありません')).not.toBeInTheDocument()
    expect(screen.queryByText('ランキング対象の配信はありません')).not.toBeInTheDocument()
  })

  it('switches sections via sub-nav', () => {
    render(<StatsTab stats={baseStats} />)

    fireEvent.click(screen.getByRole('button', { name: /沈黙チャンネル/ }))
    expect(screen.getByText('60日以上活動のないチャンネルはありません')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /配信頻度ランキング/ }))
    expect(screen.getByText('ランキング対象の配信はありません')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /視聴傾向/ }))
    expect(screen.getByText('視聴済みの推し配信はありません')).toBeInTheDocument()
  })

  it('shows sync-now button in silent section and calls onSyncNow', () => {
    const onSyncNow = vi.fn()
    render(<StatsTab stats={baseStats} onSyncNow={onSyncNow} syncing={false} />)

    fireEvent.click(screen.getByRole('button', { name: /沈黙チャンネル/ }))
    const syncBtn = screen.getByRole('button', { name: /今すぐ同期/ })
    fireEvent.click(syncBtn)
    expect(onSyncNow).toHaveBeenCalled()
  })

  it('disables sync button while syncing', () => {
    render(<StatsTab stats={baseStats} onSyncNow={vi.fn()} syncing={true} />)

    fireEvent.click(screen.getByRole('button', { name: /沈黙チャンネル/ }))
    const syncBtn = screen.getByRole('button', { name: /同期中/ })
    expect(syncBtn).toBeDisabled()
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
          ],
          viewedRates: [
            {
              channelId: 'UC_PIN',
              channelTitle: 'Pinned Channel',
              totalCount: 4,
              viewedCount: 3,
              unviewedCount: 1,
              viewedRate: 75,
              channelUrl: 'https://www.youtube.com/channel/UC_PIN'
            },
            {
              channelId: 'UC_LOW',
              channelTitle: 'Low Channel',
              totalCount: 5,
              viewedCount: 1,
              unviewedCount: 4,
              viewedRate: 20,
              channelUrl: 'https://www.youtube.com/channel/UC_LOW'
            }
          ],
          unviewedBacklog: [
            {
              channelId: 'UC_BACKLOG',
              channelTitle: 'Backlog Channel',
              unviewedCount: 4,
              notifyCount: 2,
              oldestActivityAt: Date.parse('2026-04-25T00:00:00Z'),
              isPinned: false,
              channelUrl: 'https://www.youtube.com/channel/UC_BACKLOG'
            }
          ],
          favoriteChannels: [
            {
              channelId: 'UC_FAV',
              channelTitle: 'Favorite Channel',
              favoriteCount: 3,
              viewedCount: 2,
              isPinned: true,
              channelUrl: 'https://www.youtube.com/channel/UC_FAV'
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

    // 視聴傾向へ切り替えて、よく見る推しを確認
    fireEvent.click(screen.getByRole('button', { name: /視聴傾向/ }))
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('視聴済み 3件 / 全4件（未視聴 1件）')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Pinned Channel/ }))
    expect(window.api.openExternal).toHaveBeenLastCalledWith(
      'https://www.youtube.com/channel/UC_PIN'
    )

    // 未視聴蓄積
    fireEvent.click(screen.getByRole('button', { name: '未視聴の蓄積' }))
    expect(screen.getByText('4件')).toBeInTheDocument()
    expect(screen.getByText(/お知らせ登録 2件/)).toBeInTheDocument()

    // 頻度 x 視聴率
    fireEvent.click(screen.getByRole('button', { name: '頻度 × 視聴済み率' }))
    expect(screen.getByText('よく配信・よく見る')).toBeInTheDocument()
    expect(screen.getByText('よく配信・追えていない')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Low Channel/ })).toBeInTheDocument()

    // お気に入り傾向
    fireEvent.click(screen.getByRole('button', { name: 'お気に入り傾向' }))
    expect(screen.getByText('お気に入り 3件 / うち視聴済み 2件')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Favorite Channel/ }))
    expect(window.api.openExternal).toHaveBeenLastCalledWith(
      'https://www.youtube.com/channel/UC_FAV'
    )
  })

  it('sorts frequent channels and classifies frequency-rate boundaries', () => {
    render(
      <StatsTab
        stats={{
          ...baseStats,
          viewedRates: [
            {
              channelId: 'UC_LOW_LOW',
              channelTitle: 'Low Low',
              totalCount: 3,
              viewedCount: 1,
              unviewedCount: 2,
              viewedRate: 49,
              channelUrl: 'https://www.youtube.com/channel/UC_LOW_LOW'
            },
            {
              channelId: 'UC_HIGH_LOW',
              channelTitle: 'High Low',
              totalCount: 4,
              viewedCount: 1,
              unviewedCount: 3,
              viewedRate: 25,
              channelUrl: 'https://www.youtube.com/channel/UC_HIGH_LOW'
            },
            {
              channelId: 'UC_HIGH_HIGH',
              channelTitle: 'High High',
              totalCount: 4,
              viewedCount: 3,
              unviewedCount: 1,
              viewedRate: 75,
              channelUrl: 'https://www.youtube.com/channel/UC_HIGH_HIGH'
            },
            {
              channelId: 'UC_LOW_HIGH',
              channelTitle: 'Low High',
              totalCount: 3,
              viewedCount: 2,
              unviewedCount: 1,
              viewedRate: 50,
              channelUrl: 'https://www.youtube.com/channel/UC_LOW_HIGH'
            },
            {
              channelId: 'UC_ZERO',
              channelTitle: 'Zero Viewed',
              totalCount: 5,
              viewedCount: 0,
              unviewedCount: 5,
              viewedRate: 0,
              channelUrl: 'https://www.youtube.com/channel/UC_ZERO'
            }
          ]
        }}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /視聴傾向/ }))
    const frequentRows = screen.getAllByTitle('YouTube でチャンネルを開く')
    expect(frequentRows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('High High'),
      expect.stringContaining('Low High'),
      expect.stringContaining('Low Low'),
      expect.stringContaining('High Low')
    ])
    expect(screen.queryByText('Zero Viewed')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '頻度 × 視聴済み率' }))
    expect(screen.getByRole('button', { name: /High High/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /High Low/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Low High/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Low Low/ })).toBeInTheDocument()
  })
})

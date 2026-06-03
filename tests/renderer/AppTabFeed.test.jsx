import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AppTabFeed from '../../src/renderer/components/AppTabFeed.jsx'

const cardCtx = {
  darkMode: false,
  pinnedChannelIds: new Set(),
  onToggleWatch: vi.fn(),
  onToggleFavorite: vi.fn(),
  onMarkViewed: vi.fn(),
  onTogglePin: vi.fn(),
  onFilterChannel: vi.fn(),
  isChannelFiltered: vi.fn().mockReturnValue(false)
}

function renderFeed(props = {}) {
  return render(
    <AppTabFeed
      feedVideos={[]}
      allDbChannels={[{ id: 'channel-1' }]}
      loading={false}
      darkMode={false}
      subColor="#6060a0"
      onOpenSettings={vi.fn()}
      cardCtx={cardCtx}
      {...props}
    />
  )
}

describe('AppTabFeed', () => {
  it('loading=true のとき読み込み中を表示する', () => {
    renderFeed({ loading: true })

    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('allDbChannels=[] のとき SimpleModeEmptyScreen を表示する', () => {
    renderFeed({ allDbChannels: [] })

    expect(screen.getByText('チャンネルを追加しよう')).toBeInTheDocument()
  })

  it('チャンネルがあり feedVideos=[] のとき新着なしを表示する', () => {
    renderFeed()

    expect(screen.getByText('新着動画はまだありません')).toBeInTheDocument()
  })
})

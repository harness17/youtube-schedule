import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TabCard from '../../src/renderer/components/TabCard.jsx'

const item = {
  id: 'video-1',
  status: 'ended',
  title: '共通カードテスト',
  channelTitle: 'テストチャンネル',
  channelId: 'channel-1',
  description: '',
  thumbnail: 'https://example.com/thumb.jpg',
  scheduledStartTime: null,
  actualStartTime: Date.parse('2026-06-01T10:00:00Z'),
  concurrentViewers: null,
  url: 'https://www.youtube.com/watch?v=video-1',
  isNotify: false,
  isFavorite: false,
  viewedAt: null
}

function createCardCtx(overrides = {}) {
  return {
    darkMode: false,
    pinnedChannelIds: new Set(),
    onToggleWatch: vi.fn(),
    onToggleFavorite: vi.fn(),
    onMarkViewed: vi.fn(),
    onTogglePin: vi.fn(),
    onFilterChannel: vi.fn(),
    isChannelFiltered: vi.fn().mockReturnValue(false),
    ...overrides
  }
}

beforeEach(() => {
  window.api = {
    openExternal: vi.fn().mockResolvedValue({ success: true })
  }
})

describe('TabCard', () => {
  it('item と cardCtx を渡してレンダリングできる', () => {
    render(<TabCard item={item} cardCtx={createCardCtx()} />)

    expect(screen.getByText('共通カードテスト')).toBeInTheDocument()
  })

  it('cardCtx.isChannelFiltered を item.channelId で呼び出す', () => {
    const isChannelFiltered = vi.fn().mockReturnValue(true)
    render(<TabCard item={item} cardCtx={createCardCtx({ isChannelFiltered })} />)

    expect(isChannelFiltered).toHaveBeenCalledWith('channel-1')
  })
})

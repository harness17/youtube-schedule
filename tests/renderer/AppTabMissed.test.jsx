import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AppTabMissed from '../../src/renderer/components/AppTabMissed.jsx'

function createVideo(overrides = {}) {
  return {
    id: 'video-1',
    status: 'ended',
    title: '見逃しテスト動画',
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
    viewedAt: null,
    ...overrides
  }
}

function createCardCtx() {
  return {
    darkMode: false,
    pinnedChannelIds: new Set(),
    onToggleWatch: vi.fn(),
    onToggleFavorite: vi.fn(),
    onMarkViewed: vi.fn(),
    onTogglePin: vi.fn(),
    onFilterChannel: vi.fn(),
    isChannelFiltered: vi.fn().mockReturnValue(false)
  }
}

function renderMissed(props = {}) {
  return render(
    <AppTabMissed
      tabLoading={false}
      filteredMissed={[]}
      hasMissed={false}
      searchQuery=""
      selectedChannel="all"
      subColor="#6060a0"
      missedSections={{ upcomingMissed: [], endedMissed: [] }}
      cardCtx={createCardCtx()}
      {...props}
    />
  )
}

beforeEach(() => {
  window.api = {
    openExternal: vi.fn().mockResolvedValue({ success: true })
  }
})

describe('AppTabMissed', () => {
  it('tabLoading=true のとき読み込み中を表示する', () => {
    renderMissed({ tabLoading: true })

    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('filteredMissed=[] かつ hasMissed=false のとき見逃しなしを表示する', () => {
    renderMissed()

    expect(screen.getByText('見逃した配信はありません 🎉')).toBeInTheDocument()
  })

  it("filteredMissed=[] かつ hasMissed=true かつ selectedChannel != 'all' のときチャンネル不一致を表示する", () => {
    renderMissed({ hasMissed: true, selectedChannel: 'channel-1' })

    expect(screen.getByText('このチャンネルの配信はありません')).toBeInTheDocument()
  })

  it('filteredMissed=[] かつ hasMissed=true かつ searchQuery ありのとき検索結果なしを表示する', () => {
    renderMissed({ hasMissed: true, searchQuery: 'keyword' })

    expect(screen.getByText('検索結果がありません')).toBeInTheDocument()
  })

  it('upcomingMissed のアイテムとステータスバッジを表示する', () => {
    const upcoming = createVideo({
      id: 'upcoming-1',
      status: 'upcoming',
      title: '予定テスト動画',
      scheduledStartTime: '2026-06-05T10:00:00Z',
      actualStartTime: null
    })

    renderMissed({
      filteredMissed: [upcoming],
      hasMissed: true,
      missedSections: { upcomingMissed: [upcoming], endedMissed: [] }
    })

    expect(screen.getByText('📅 予定・配信中')).toBeInTheDocument()
    expect(screen.getByText('予定テスト動画')).toBeInTheDocument()
    expect(screen.getByText('📅 配信予定')).toBeInTheDocument()
  })

  it('endedMissed のアイテムと視聴済みボタンを表示する', () => {
    const ended = createVideo({ id: 'ended-1', title: '終了テスト動画' })

    renderMissed({
      filteredMissed: [ended],
      hasMissed: true,
      missedSections: { upcomingMissed: [], endedMissed: [ended] }
    })

    expect(screen.getByText('📋 見逃し')).toBeInTheDocument()
    expect(screen.getByText('終了テスト動画')).toBeInTheDocument()
    expect(screen.getByTitle('見た')).toBeInTheDocument()
  })
})

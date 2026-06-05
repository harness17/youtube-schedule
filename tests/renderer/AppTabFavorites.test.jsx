import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AppTabFavorites from '../../src/renderer/components/AppTabFavorites.jsx'

function createVideo(overrides = {}) {
  return {
    id: 'video-1',
    status: 'ended',
    title: 'お気に入りテスト動画',
    channelTitle: 'テストチャンネル',
    channelId: 'channel-1',
    description: '',
    thumbnail: 'https://example.com/thumb.jpg',
    scheduledStartTime: null,
    actualStartTime: Date.parse('2026-06-01T10:00:00Z'),
    concurrentViewers: null,
    url: 'https://www.youtube.com/watch?v=video-1',
    isNotify: false,
    isFavorite: true,
    viewedAt: null,
    ...overrides
  }
}

function createFavoriteCardCtx() {
  return {
    darkMode: false,
    pinnedChannelIds: new Set(),
    onToggleWatch: vi.fn(),
    onToggleFavorite: vi.fn(),
    onMarkViewed: vi.fn(),
    onTogglePin: vi.fn(),
    onFilterChannel: vi.fn(),
    isChannelFiltered: vi.fn().mockReturnValue(false),
    reorderMode: false
  }
}

function renderFavorites(props = {}) {
  return render(
    <AppTabFavorites
      tabLoading={false}
      filteredFavorites={[]}
      hasFavorites={false}
      searchQuery=""
      selectedChannel="all"
      subColor="#6060a0"
      favoriteSections={{ upcomingFavs: [], normalFavs: [], viewedFavs: [] }}
      favoriteCardCtx={createFavoriteCardCtx()}
      sensors={[]}
      reorderFavorites={vi.fn()}
      {...props}
    />
  )
}

beforeEach(() => {
  window.api = {
    openExternal: vi.fn().mockResolvedValue({ success: true })
  }
})

describe('AppTabFavorites', () => {
  it('tabLoading=true のとき読み込み中を表示する', () => {
    renderFavorites({ tabLoading: true })

    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('filteredFavorites=[] かつ hasFavorites=false のときお気に入りなしを表示する', () => {
    renderFavorites()

    expect(screen.getByText('お気に入りはまだありません')).toBeInTheDocument()
  })

  it("filteredFavorites=[] かつ hasFavorites=true かつ selectedChannel != 'all' のときチャンネル不一致を表示する", () => {
    renderFavorites({ hasFavorites: true, selectedChannel: 'channel-1' })

    expect(screen.getByText('このチャンネルの配信はありません')).toBeInTheDocument()
  })

  it('filteredFavorites=[] かつ hasFavorites=true かつ searchQuery ありのとき検索結果なしを表示する', () => {
    renderFavorites({ hasFavorites: true, searchQuery: 'keyword' })

    expect(screen.getByText('検索結果がありません')).toBeInTheDocument()
  })

  it('upcomingFavs セクションを表示する', () => {
    const upcoming = createVideo({
      id: 'upcoming-1',
      status: 'upcoming',
      title: '予定お気に入り動画',
      scheduledStartTime: '2026-06-05T10:00:00Z',
      actualStartTime: null
    })

    renderFavorites({
      filteredFavorites: [upcoming],
      hasFavorites: true,
      favoriteSections: { upcomingFavs: [upcoming], normalFavs: [], viewedFavs: [] }
    })

    expect(screen.getByText('📅 予定・配信中')).toBeInTheDocument()
    expect(screen.getByText('予定お気に入り動画')).toBeInTheDocument()
  })

  it('normalFavs セクションを表示する', () => {
    const normal = createVideo({ id: 'normal-1', title: '通常お気に入り動画' })

    renderFavorites({
      filteredFavorites: [normal],
      hasFavorites: true,
      favoriteSections: { upcomingFavs: [], normalFavs: [normal], viewedFavs: [] }
    })

    expect(screen.getByText('📋 通常')).toBeInTheDocument()
    expect(screen.getByText('通常お気に入り動画')).toBeInTheDocument()
  })

  it('viewedFavs セクションを表示する', () => {
    const viewed = createVideo({
      id: 'viewed-1',
      title: '視聴済みお気に入り動画',
      viewedAt: Date.parse('2026-06-02T10:00:00Z')
    })

    renderFavorites({
      filteredFavorites: [viewed],
      hasFavorites: true,
      favoriteSections: { upcomingFavs: [], normalFavs: [], viewedFavs: [viewed] }
    })

    expect(screen.getByText('✅ 視聴済み')).toBeInTheDocument()
    expect(screen.getByText('視聴済みお気に入り動画')).toBeInTheDocument()
  })
})

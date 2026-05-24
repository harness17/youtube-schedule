import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlaylistTab from '../../src/renderer/components/PlaylistTab.jsx'

const playlistVideo = {
  id: 'pl1',
  status: 'ended',
  title: 'プレイリスト動画',
  channelTitle: 'チャンネルA',
  channelId: 'UC_A',
  description: '',
  thumbnail: 'https://example.com/pl.jpg',
  scheduledStartTime: null,
  actualStartTime: Date.parse('2026-05-01T00:00:00Z'),
  concurrentViewers: null,
  url: 'https://www.youtube.com/watch?v=pl1',
  isNotify: false,
  isFavorite: false,
  viewedAt: null
}

const removedVideo = {
  ...playlistVideo,
  id: 'removed1',
  title: '削除済み動画',
  url: 'https://www.youtube.com/watch?v=removed1'
}

function renderTab(props = {}) {
  return render(
    <PlaylistTab
      active={true}
      isAuthenticated={true}
      searchQuery=""
      hideMembershipVideos={false}
      pinnedChannelIds={new Set()}
      onToggleWatch={vi.fn()}
      onToggleFavorite={vi.fn()}
      onMarkViewed={vi.fn()}
      onTogglePin={vi.fn()}
      onToast={vi.fn()}
      {...props}
    />
  )
}

beforeEach(() => {
  window.api = {
    openExternal: vi.fn(),
    playlist: {
      getConfig: vi.fn().mockResolvedValue({
        playlistId: 'PL_TEST',
        playlistTitle: '取り込みリスト',
        lastSyncedAt: Date.now(),
        enabled: true
      }),
      get: vi.fn(({ filter }) =>
        Promise.resolve(filter === 'removed' ? [removedVideo] : [playlistVideo, removedVideo])
      ),
      listMine: vi.fn().mockResolvedValue([
        { id: 'PL_TEST', title: '取り込みリスト', itemCount: 2 },
        { id: 'PL_NEW', title: '新リスト', itemCount: 5 }
      ]),
      setConfig: vi.fn().mockResolvedValue({ ok: true }),
      refresh: vi.fn().mockResolvedValue({ added: 1, removed: 0, restored: 0 }),
      deleteOne: vi.fn().mockResolvedValue({ deleted: 1 }),
      onUpdated: vi.fn(() => vi.fn()),
      onError: vi.fn(() => vi.fn())
    }
  }
})

describe('PlaylistTab', () => {
  it('renders imported playlist videos with a compact playlist selector', async () => {
    renderTab()

    expect(await screen.findByRole('heading', { name: '📂 プレイリスト' })).toBeInTheDocument()
    expect(screen.getByLabelText('取得するプレイリスト')).toHaveValue('PL_TEST')
    expect(
      screen.getByText('※「後で見る」「高評価動画」は YouTube 仕様により取得できません')
    ).toBeInTheDocument()
    expect(screen.getByText(/最終取得:/)).toBeInTheDocument()
    expect(screen.getByText('プレイリスト動画')).toBeInTheDocument()
    expect(screen.getByText('削除済み動画')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /取得/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /設定/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /エクスポート/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /反映/ })).not.toBeInTheDocument()
  })

  it('shows unconfigured empty state with playlist selector visible', async () => {
    window.api.playlist.getConfig.mockResolvedValue(null)
    window.api.playlist.get.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    renderTab()

    expect(await screen.findByText('未設定')).toBeInTheDocument()
    expect(screen.getByText('プレイリストが未設定です')).toBeInTheDocument()
    expect(screen.getByLabelText('取得するプレイリスト')).toBeInTheDocument()
  })

  it('saves playlist selection from the header selector', async () => {
    const onToast = vi.fn()
    renderTab({ onToast })

    const select = await screen.findByLabelText('取得するプレイリスト')
    fireEvent.change(select, { target: { value: 'PL_NEW' } })

    await waitFor(() =>
      expect(window.api.playlist.setConfig).toHaveBeenCalledWith({
        playlistId: 'PL_NEW',
        playlistTitle: '新リスト',
        enabled: true
      })
    )
    expect(screen.getByText('取得中...')).toBeInTheDocument()
    expect(onToast).toHaveBeenCalledWith('プレイリストを設定しました')
  })

  it('calls setConfig when the current playlist id is selected again', async () => {
    renderTab()

    const select = await screen.findByLabelText('取得するプレイリスト')
    fireEvent.change(select, { target: { value: 'PL_TEST' } })

    await waitFor(() =>
      expect(window.api.playlist.setConfig).toHaveBeenCalledWith({
        playlistId: 'PL_TEST',
        playlistTitle: '取り込みリスト',
        enabled: true
      })
    )
  })

  it('keeps removed videos mixed in the playlist without removed-only controls', async () => {
    renderTab()
    await screen.findByRole('heading', { name: '📂 プレイリスト' })

    expect(screen.getByText('プレイリスト動画')).toBeInTheDocument()
    expect(screen.getByText('削除済み動画')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /削除済みのみ/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /削除済みを一括削除/ })).not.toBeInTheDocument()
  })

  it('deletes one removed video from its card confirmation modal', async () => {
    const onToast = vi.fn()
    renderTab({ onToast })
    await screen.findByRole('heading', { name: '📂 プレイリスト' })
    window.api.playlist.get.mockClear()

    fireEvent.click(screen.getByTitle('YouTom から削除'))
    expect(screen.getByText('この動画を YouTom から削除しますか？')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => expect(window.api.playlist.deleteOne).toHaveBeenCalledWith('removed1'))
    expect(screen.queryByText('削除済み動画')).not.toBeInTheDocument()
    expect(window.api.playlist.get).not.toHaveBeenCalled()
    expect(onToast).toHaveBeenCalledWith('動画を削除しました')
  })

  it('updates favorite locally without reloading playlist data', async () => {
    const onToggleFavorite = vi.fn().mockResolvedValue(true)
    renderTab({ onToggleFavorite })
    await screen.findByText('プレイリスト動画')
    window.api.playlist.get.mockClear()

    fireEvent.click(screen.getAllByTitle('お気に入りに追加')[0])

    await waitFor(() => expect(onToggleFavorite).toHaveBeenCalledWith('pl1'))
    await waitFor(() => expect(screen.getByTitle('お気に入り解除')).toBeInTheDocument())
    expect(window.api.playlist.get).not.toHaveBeenCalled()
  })

  it('updates notify locally without reloading playlist data', async () => {
    const onToggleWatch = vi.fn().mockResolvedValue(true)
    renderTab({ onToggleWatch })
    await screen.findByText('プレイリスト動画')
    window.api.playlist.get.mockClear()

    fireEvent.click(screen.getAllByTitle('通知をオンにする')[0])

    await waitFor(() => expect(onToggleWatch).toHaveBeenCalledWith('pl1'))
    await waitFor(() => expect(screen.getByTitle('通知オン（クリックで解除）')).toBeInTheDocument())
    expect(window.api.playlist.get).not.toHaveBeenCalled()
  })

  it('updates viewed state locally without reloading playlist data', async () => {
    const viewedAt = Date.parse('2026-05-24T00:00:00Z')
    const onMarkViewed = vi.fn().mockResolvedValue(viewedAt)
    renderTab({ onMarkViewed })
    await screen.findByText('プレイリスト動画')
    window.api.playlist.get.mockClear()

    fireEvent.click(screen.getAllByTitle('見た')[0])

    await waitFor(() => expect(onMarkViewed).toHaveBeenCalledWith('pl1', true))
    await waitFor(() => expect(screen.getByTitle('視聴済みを解除')).toBeInTheDocument())
    expect(window.api.playlist.get).not.toHaveBeenCalled()
  })
})

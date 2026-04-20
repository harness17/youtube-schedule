import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ScheduleCard from '../../src/renderer/components/ScheduleCard.jsx'

const mockItem = {
  id: 'vid1',
  status: 'upcoming',
  title: 'テスト配信タイトル',
  channelTitle: 'テストチャンネル',
  channelId: 'UC_test1',
  description: 'これは概要文です。',
  thumbnail: 'https://img.example.com/thumb.jpg',
  scheduledStartTime: '2026-04-13T09:00:00Z',
  actualStartTime: null,
  concurrentViewers: '12000',
  url: 'https://www.youtube.com/watch?v=vid1',
  channelUrl: 'https://www.youtube.com/channel/UC_test1'
}

const liveItem = {
  ...mockItem,
  id: 'live1',
  status: 'live',
  actualStartTime: '2026-04-12T08:05:00Z'
}

beforeEach(() => {
  window.api = {
    openExternal: vi.fn().mockResolvedValue({ success: true })
  }
})

describe('ScheduleCard', () => {
  it('タイトルとチャンネル名が表示される', () => {
    render(<ScheduleCard item={mockItem} />)
    expect(screen.getByText('テスト配信タイトル')).toBeInTheDocument()
    expect(screen.getByText('テストチャンネル')).toBeInTheDocument()
  })

  it('視聴者数が表示される', () => {
    render(<ScheduleCard item={mockItem} />)
    expect(screen.getByText(/1\.2万/)).toBeInTheDocument()
  })

  it('視聴者数が null のとき非表示', () => {
    render(<ScheduleCard item={{ ...mockItem, concurrentViewers: null }} />)
    expect(screen.queryByText(/万人/)).not.toBeInTheDocument()
  })

  it('YouTube で開くボタンで openExternal が呼ばれる', () => {
    render(<ScheduleCard item={mockItem} />)
    fireEvent.click(screen.getByText('YouTube で開く'))
    expect(window.api.openExternal).toHaveBeenCalledWith(mockItem.url)
  })

  it('通知ボタンクリックで onToggleWatch が呼ばれる', () => {
    const onToggleWatch = vi.fn()
    render(<ScheduleCard item={mockItem} onToggleWatch={onToggleWatch} />)
    fireEvent.click(screen.getByTitle('通知をオンにする'))
    expect(onToggleWatch).toHaveBeenCalledWith(mockItem.id)
  })

  it('live アイテムに LIVE バッジが表示される', () => {
    render(<ScheduleCard item={liveItem} />)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('upcoming アイテムに LIVE バッジが表示されない', () => {
    render(<ScheduleCard item={mockItem} />)
    expect(screen.queryByText('LIVE')).not.toBeInTheDocument()
  })

  it('⭐ ボタンクリックで onToggleFavorite が呼ばれる', () => {
    const onToggleFavorite = vi.fn()
    render(<ScheduleCard item={mockItem} onToggleFavorite={onToggleFavorite} />)
    fireEvent.click(screen.getByTitle('お気に入りに追加'))
    expect(onToggleFavorite).toHaveBeenCalledWith(mockItem.id)
  })

  it('isFavorite=true のとき ⭐ ボタンのタイトルが「お気に入り解除」になる', () => {
    render(<ScheduleCard item={{ ...mockItem, isFavorite: true }} />)
    expect(screen.getByTitle('お気に入り解除')).toBeInTheDocument()
  })

  it('isPinned=true のときチャンネル名の横に 📌 が表示される', () => {
    render(<ScheduleCard item={mockItem} isPinned={true} />)
    expect(screen.getByText('📌')).toBeInTheDocument()
  })

  it('isPinned=false のとき 📌 が表示されない', () => {
    render(<ScheduleCard item={mockItem} isPinned={false} />)
    expect(screen.queryByText('📌')).not.toBeInTheDocument()
  })

  it('showViewedButton=true のとき ✓ ボタンが表示される', () => {
    render(<ScheduleCard item={mockItem} showViewedButton={true} />)
    expect(screen.getByTitle('見た')).toBeInTheDocument()
  })

  it('showViewedButton=false のとき ✓ ボタンが表示されない', () => {
    render(<ScheduleCard item={mockItem} showViewedButton={false} />)
    expect(screen.queryByTitle('見た')).not.toBeInTheDocument()
  })

  it('✓ ボタンクリックで onMarkViewed が呼ばれる', () => {
    const onMarkViewed = vi.fn()
    render(<ScheduleCard item={mockItem} showViewedButton={true} onMarkViewed={onMarkViewed} />)
    fireEvent.click(screen.getByTitle('見た'))
    expect(onMarkViewed).toHaveBeenCalledWith(mockItem.id, true)
  })

  it('viewedAt が設定済みのとき ✓ ボタンのタイトルが「視聴済みを解除」になる', () => {
    render(<ScheduleCard item={{ ...mockItem, viewedAt: 1000000 }} showViewedButton={true} />)
    expect(screen.getByTitle('視聴済みを解除')).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ScheduleList from '../../src/renderer/components/ScheduleList.jsx'

beforeEach(() => {
  window.api = {
    openExternal: vi.fn().mockResolvedValue({ success: true }),
    addToWatchLater: vi.fn().mockResolvedValue({ success: true }),
  }
})

const makeItem = (id, status, scheduledStartTime) => ({
  id, status, title: `配信${id}`, channelTitle: 'ch1',
  channelId: 'UC1', description: '', thumbnail: '',
  scheduledStartTime, actualStartTime: null,
  concurrentViewers: null,
  url: `https://youtube.com/watch?v=${id}`,
  channelUrl: 'https://youtube.com/channel/UC1',
})

const liveItems = [makeItem('lv1', 'live', '2026-04-12T08:00:00Z')]
const upcomingItems = [
  makeItem('v1', 'upcoming', '2026-04-13T00:00:00+09:00'), // JST 4月13日
  makeItem('v2', 'upcoming', '2026-04-15T18:00:00+09:00'), // JST 4月15日
]

describe('ScheduleList', () => {
  it('live も upcoming も0件のとき空メッセージを表示する', () => {
    render(<ScheduleList live={[]} upcoming={[]} />)
    expect(screen.getByText('予定された配信はありません')).toBeInTheDocument()
  })

  it('ライブ中セクションのタイトルが表示される', () => {
    render(<ScheduleList live={liveItems} upcoming={[]} />)
    expect(screen.getByText('ライブ配信中')).toBeInTheDocument()
  })

  it('配信予定セクションの日付ヘッダーが表示される', () => {
    render(<ScheduleList live={[]} upcoming={upcomingItems} />)
    expect(screen.getByText(/4月13日/)).toBeInTheDocument()
    expect(screen.getByText(/4月15日/)).toBeInTheDocument()
  })

  it('各配信タイトルが表示される', () => {
    render(<ScheduleList live={liveItems} upcoming={upcomingItems} />)
    expect(screen.getByText('配信lv1')).toBeInTheDocument()
    expect(screen.getByText('配信v1')).toBeInTheDocument()
    expect(screen.getByText('配信v2')).toBeInTheDocument()
  })

  it('live のみでも問題なく表示される', () => {
    render(<ScheduleList live={liveItems} upcoming={[]} />)
    expect(screen.getByText('配信lv1')).toBeInTheDocument()
    expect(screen.queryByText('予定された配信はありません')).not.toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ScheduleList from '../../src/renderer/components/ScheduleList.jsx'

beforeEach(() => {
  window.api = {
    openExternal: vi.fn().mockResolvedValue({ success: true }),
    addToWatchLater: vi.fn().mockResolvedValue({ success: true })
  }
})

const makeItem = (id, status, scheduledStartTime) => ({
  id,
  status,
  title: `配信${id}`,
  channelTitle: 'ch1',
  channelId: 'UC1',
  description: '',
  thumbnail: '',
  scheduledStartTime,
  actualStartTime: null,
  concurrentViewers: null,
  url: `https://youtube.com/watch?v=${id}`,
  channelUrl: 'https://youtube.com/channel/UC1'
})

const liveItems = [makeItem('lv1', 'live', '2026-04-12T08:00:00Z')]
const upcomingItems = [
  makeItem('v1', 'upcoming', '2026-04-13T00:00:00+09:00'), // JST 4月13日
  makeItem('v2', 'upcoming', '2026-04-15T18:00:00+09:00') // JST 4月15日
]

describe('ScheduleList', () => {
  it('live も upcoming も0件のとき空メッセージを表示する', () => {
    render(<ScheduleList live={[]} upcoming={[]} />)
    expect(screen.getByText('予定された配信はありません')).toBeInTheDocument()
  })

  it('ライブ中セクションのタイトルが表示される', () => {
    render(<ScheduleList live={liveItems} upcoming={[]} />)
    expect(screen.getByText('🔴 ライブ配信中')).toBeInTheDocument()
  })

  it('配信予定セクションの日付ヘッダーが表示される', () => {
    render(<ScheduleList live={[]} upcoming={upcomingItems} />)
    expect(screen.getAllByText(/4月13日/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/4月15日/).length).toBeGreaterThan(0)
  })

  it('各配信タイトルが表示される', () => {
    render(<ScheduleList live={liveItems} upcoming={upcomingItems} />)
    expect(screen.getByText('配信lv1')).toBeInTheDocument()
    expect(screen.getByText('配信v1')).toBeInTheDocument()
    expect(screen.getByText('配信v2')).toBeInTheDocument()
  })

  it('時刻未取得のフィード項目を1月1日ではなく専用セクションに表示する', () => {
    render(<ScheduleList live={[]} upcoming={[makeItem('feed1', 'upcoming', null)]} />)
    expect(screen.getByText('📡 時刻未取得')).toBeInTheDocument()
    expect(screen.queryByText(/1月1日/)).not.toBeInTheDocument()
    expect(screen.getByText('配信feed1')).toBeInTheDocument()
  })

  it('live のみでも問題なく表示される', () => {
    render(<ScheduleList live={liveItems} upcoming={[]} />)
    expect(screen.getByText('配信lv1')).toBeInTheDocument()
    expect(screen.queryByText('予定された配信はありません')).not.toBeInTheDocument()
  })

  it('pinnedChannelIds に含まれるチャンネルの配信が同一日付グループ内で先頭に表示される', () => {
    const sameDay = [
      makeItem('va', 'upcoming', '2026-04-13T10:00:00+09:00'), // ch: UC1 (非ピン)
      makeItem('vb', 'upcoming', '2026-04-13T09:00:00+09:00') // ch: UC2 (ピン済み)
    ]
    // vb は UC1、va は UC2 のようにチャンネルを振り直す
    sameDay[0] = { ...sameDay[0], channelId: 'UC1' }
    sameDay[1] = { ...sameDay[1], channelId: 'UC2' }
    const pinnedChannelIds = new Set(['UC2'])
    render(<ScheduleList live={[]} upcoming={sameDay} pinnedChannelIds={pinnedChannelIds} />)
    const cards = screen.getAllByText(/配信v/)
    // 「配信vb」がピン済み UC2 なので先頭になるはず
    expect(cards[0].textContent).toBe('配信vb')
  })

  it('ライブ配信を優先ブロックごとに分け、それぞれの内部を配信時間順に表示する', () => {
    const live = [
      { ...makeItem('plainEarly', 'live', '2026-04-13T08:00:00+09:00') },
      { ...makeItem('pinnedLate', 'live', '2026-04-13T11:00:00+09:00'), channelId: 'UC_PIN' },
      { ...makeItem('notifyLate', 'live', '2026-04-13T10:00:00+09:00'), isNotify: true },
      { ...makeItem('favEarly', 'live', '2026-04-13T09:00:00+09:00'), isFavorite: true },
      { ...makeItem('plainLate', 'live', '2026-04-13T12:00:00+09:00') },
      {
        ...makeItem('pinnedEarly', 'live', '2026-04-13T07:00:00+09:00'),
        channelId: 'UC_PIN'
      }
    ]

    render(<ScheduleList live={live} upcoming={[]} pinnedChannelIds={new Set(['UC_PIN'])} />)

    const cards = screen.getAllByText(
      /配信(favEarly|notifyLate|pinnedEarly|pinnedLate|plainEarly|plainLate)/
    )
    expect(cards.map((card) => card.textContent)).toEqual([
      '配信favEarly',
      '配信notifyLate',
      '配信pinnedEarly',
      '配信pinnedLate',
      '配信plainEarly',
      '配信plainLate'
    ])
  })

  it('同日配信予定を優先ブロックごとに分け、それぞれの内部を配信時間順に表示する', () => {
    const upcoming = [
      { ...makeItem('plainEarly', 'upcoming', '2026-04-13T08:00:00+09:00') },
      {
        ...makeItem('pinnedLate', 'upcoming', '2026-04-13T11:00:00+09:00'),
        channelId: 'UC_PIN'
      },
      { ...makeItem('notifyLate', 'upcoming', '2026-04-13T10:00:00+09:00'), isNotify: true },
      { ...makeItem('favEarly', 'upcoming', '2026-04-13T09:00:00+09:00'), isFavorite: true },
      { ...makeItem('plainLate', 'upcoming', '2026-04-13T12:00:00+09:00') },
      {
        ...makeItem('pinnedEarly', 'upcoming', '2026-04-13T07:00:00+09:00'),
        channelId: 'UC_PIN'
      }
    ]

    render(<ScheduleList live={[]} upcoming={upcoming} pinnedChannelIds={new Set(['UC_PIN'])} />)

    const cards = screen.getAllByText(
      /配信(favEarly|notifyLate|pinnedEarly|pinnedLate|plainEarly|plainLate)/
    )
    expect(cards.map((card) => card.textContent)).toEqual([
      '配信favEarly',
      '配信notifyLate',
      '配信pinnedEarly',
      '配信pinnedLate',
      '配信plainEarly',
      '配信plainLate'
    ])
  })

  it('ピックアップモードではお気に入り・通知・優先チャンネルの配信だけを表示する', () => {
    const items = [
      { ...makeItem('fav', 'upcoming', '2026-04-13T09:00:00+09:00'), isFavorite: true },
      { ...makeItem('notify', 'upcoming', '2026-04-13T10:00:00+09:00'), isNotify: true },
      {
        ...makeItem('pinned', 'upcoming', '2026-04-13T11:00:00+09:00'),
        channelId: 'UC_PIN'
      },
      makeItem('plain', 'upcoming', '2026-04-13T12:00:00+09:00')
    ]

    render(
      <ScheduleList
        live={[]}
        upcoming={items}
        pinnedChannelIds={new Set(['UC_PIN'])}
        pickupOnly={true}
      />
    )

    expect(screen.getByText('配信fav')).toBeInTheDocument()
    expect(screen.getByText('配信notify')).toBeInTheDocument()
    expect(screen.getByText('配信pinned')).toBeInTheDocument()
    expect(screen.queryByText('配信plain')).not.toBeInTheDocument()
  })

  it('ピックアップ対象がないとき専用の空メッセージを表示する', () => {
    render(<ScheduleList live={[]} upcoming={[makeItem('plain', 'upcoming', null)]} pickupOnly />)

    expect(screen.getByText('ピックアップ対象の予定・ライブはありません')).toBeInTheDocument()
    expect(screen.queryByText('予定された配信はありません')).not.toBeInTheDocument()
  })

  it('onFilterChannel を渡すと各カードに「このチャンネルのみ」ボタンを中継表示する', () => {
    render(<ScheduleList live={liveItems} upcoming={upcomingItems} onFilterChannel={vi.fn()} />)
    expect(screen.getAllByTitle('このチャンネルのみ表示').length).toBe(3)
  })

  it('onFilterChannel 未指定ならボタンは表示されない', () => {
    render(<ScheduleList live={liveItems} upcoming={upcomingItems} />)
    expect(screen.queryByTitle('このチャンネルのみ表示')).not.toBeInTheDocument()
  })

  it('isChannelFiltered が true を返すチャンネルのカードは解除タイトルになる', () => {
    render(
      <ScheduleList
        live={liveItems}
        upcoming={upcomingItems}
        onFilterChannel={vi.fn()}
        isChannelFiltered={(channelId) => channelId === 'UC1'}
      />
    )
    expect(screen.getAllByTitle('このチャンネルの絞り込みを解除').length).toBe(3)
  })
})

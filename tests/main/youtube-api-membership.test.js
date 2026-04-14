import { describe, it, expect, vi } from 'vitest'

// https は fetchRssFeed で使われるが membership 関数では不使用。
// モジュールロード時のエラーを防ぐためダミーで mock する。
vi.mock('https', () => ({
  default: { get: vi.fn() }
}))

// テストごとに返却値を切り替えられるよう可変オブジェクトで管理する
const mockState = {
  searchItems: [],
  videoItems: [],
  channelItems: []
}

vi.mock('googleapis', () => ({
  google: {
    youtube: () => ({
      search: {
        list: vi.fn().mockImplementation(() =>
          Promise.resolve({ data: { items: mockState.searchItems } })
        )
      },
      videos: {
        list: vi.fn().mockImplementation(() =>
          Promise.resolve({ data: { items: mockState.videoItems } })
        )
      },
      channels: {
        list: vi.fn().mockImplementation(() =>
          Promise.resolve({ data: { items: mockState.channelItems } })
        )
      }
    })
  }
}))

// ────────────────────────────────────────────
// テスト用フィクスチャ
// ────────────────────────────────────────────

const upcomingVideo = {
  id: 'mem_upcoming',
  snippet: {
    title: 'メンバー限定配信予定',
    channelTitle: 'テストチャンネル',
    channelId: 'UC_mem',
    description: '',
    thumbnails: { high: { url: 'https://example.com/thumb.jpg' } }
  },
  liveStreamingDetails: {
    scheduledStartTime: new Date(Date.now() + 86400000).toISOString() // 明日
  }
}

const upcomingVideoLater = {
  id: 'mem_upcoming2',
  snippet: {
    title: 'メンバー限定配信予定2',
    channelTitle: 'テストチャンネル',
    channelId: 'UC_mem',
    description: '',
    thumbnails: { high: { url: 'https://example.com/thumb2.jpg' } }
  },
  liveStreamingDetails: {
    scheduledStartTime: new Date(Date.now() + 172800000).toISOString() // 2日後
  }
}

const liveVideo = {
  id: 'mem_live',
  snippet: {
    title: 'メンバー限定ライブ中',
    channelTitle: 'テストチャンネル',
    channelId: 'UC_mem',
    description: '',
    thumbnails: { high: { url: 'https://example.com/live.jpg' } }
  },
  liveStreamingDetails: {
    scheduledStartTime: new Date(Date.now() - 3600000).toISOString(),
    actualStartTime: new Date(Date.now() - 3600000).toISOString() // 1時間前から配信中
  }
}

const { fetchMembershipSchedule, resolveChannel } = await import(
  '../../src/main/youtube-api.js'
)

// ────────────────────────────────────────────
// fetchMembershipSchedule
// ────────────────────────────────────────────

describe('fetchMembershipSchedule', () => {
  it('チャンネルIDが空のとき空を返す', async () => {
    const result = await fetchMembershipSchedule({}, [])
    expect(result.live).toHaveLength(0)
    expect(result.upcoming).toHaveLength(0)
  })

  it('upcoming と live を返す（includeLive: true）', async () => {
    mockState.searchItems = [
      { id: { videoId: 'mem_upcoming' } },
      { id: { videoId: 'mem_live' } }
    ]
    mockState.videoItems = [upcomingVideo, liveVideo]

    const result = await fetchMembershipSchedule({}, ['UC_mem'], { includeLive: true })
    expect(result.upcoming).toHaveLength(1)
    expect(result.live).toHaveLength(1)
    expect(result.upcoming[0].title).toBe('メンバー限定配信予定')
    expect(result.live[0].title).toBe('メンバー限定ライブ中')
  })

  it('各アイテムに status フィールドがある', async () => {
    mockState.searchItems = [
      { id: { videoId: 'mem_upcoming' } },
      { id: { videoId: 'mem_live' } }
    ]
    mockState.videoItems = [upcomingVideo, liveVideo]

    const result = await fetchMembershipSchedule({}, ['UC_mem'], { includeLive: true })
    for (const item of result.upcoming) expect(item.status).toBe('upcoming')
    for (const item of result.live) expect(item.status).toBe('live')
  })

  it('upcoming は scheduledStartTime で昇順ソート', async () => {
    mockState.searchItems = [
      { id: { videoId: 'mem_upcoming2' } },
      { id: { videoId: 'mem_upcoming' } }
    ]
    // 意図的に逆順で返す
    mockState.videoItems = [upcomingVideoLater, upcomingVideo]

    const result = await fetchMembershipSchedule({}, ['UC_mem'], { includeLive: false })
    expect(result.upcoming).toHaveLength(2)
    expect(new Date(result.upcoming[0].scheduledStartTime).getTime()).toBeLessThanOrEqual(
      new Date(result.upcoming[1].scheduledStartTime).getTime()
    )
  })
})

// ────────────────────────────────────────────
// resolveChannel
// ────────────────────────────────────────────

describe('resolveChannel', () => {
  it('チャンネルID を渡すと名前を解決する', async () => {
    mockState.channelItems = [
      { id: 'UCtest12345678901234567890', snippet: { title: 'テストチャンネル' } }
    ]
    const result = await resolveChannel({}, 'UCtest12345678901234567890')
    expect(result.channelId).toBe('UCtest12345678901234567890')
    expect(result.channelTitle).toBe('テストチャンネル')
  })

  it('@ハンドルを渡すと名前を解決する', async () => {
    mockState.channelItems = [
      { id: 'UCtest12345678901234567890', snippet: { title: 'テストチャンネル' } }
    ]
    const result = await resolveChannel({}, '@testchannel')
    expect(result.channelId).toBe('UCtest12345678901234567890')
    expect(result.channelTitle).toBe('テストチャンネル')
  })

  it('/channel/UC... URL を渡すと名前を解決する', async () => {
    mockState.channelItems = [
      { id: 'UCtest12345678901234567890', snippet: { title: 'テストチャンネル' } }
    ]
    const result = await resolveChannel(
      {},
      'https://www.youtube.com/channel/UCtest12345678901234567890'
    )
    expect(result.channelId).toBe('UCtest12345678901234567890')
    expect(result.channelTitle).toBe('テストチャンネル')
  })

  it('チャンネルが見つからない場合 error: NOT_FOUND を返す', async () => {
    mockState.channelItems = []
    const result = await resolveChannel({}, '@notexist')
    expect(result.error).toBe('NOT_FOUND')
  })
})

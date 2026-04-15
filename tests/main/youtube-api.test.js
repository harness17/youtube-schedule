import { describe, it, expect, vi } from 'vitest'

// RSS フィードで vid1（配信予定）と vid_live（ライブ中）を返す
const rss =
  '<feed><entry><yt:videoId>vid1</yt:videoId></entry>' +
  '<entry><yt:videoId>vid_live</yt:videoId></entry></feed>'

// https.get のモック: setTimeout / destroy / on を備えた req オブジェクトを返す
vi.mock('https', () => {
  return {
    default: {
      get: vi.fn().mockImplementation((_url, callback) => {
        const mockRes = {
          on: (event, handler) => {
            if (event === 'data') handler(rss)
            if (event === 'end') handler()
            return mockRes
          }
        }
        callback(mockRes)
        const req = {
          setTimeout: vi.fn(),
          destroy: vi.fn(),
          on: vi.fn()
        }
        return req
      })
    }
  }
})

const mockSubscriptions = {
  data: {
    items: [{ snippet: { resourceId: { channelId: 'UC_test1' } } }],
    nextPageToken: null
  }
}

const mockVideos = {
  data: {
    items: [
      {
        id: 'vid1',
        snippet: {
          title: 'テスト配信',
          channelTitle: 'テストチャンネル',
          channelId: 'UC_test1',
          description: '概要テスト',
          thumbnails: { maxres: { url: 'https://img.example.com/thumb.jpg' } }
        },
        liveStreamingDetails: {
          scheduledStartTime: new Date(Date.now() + 86400000).toISOString(), // 明日
          concurrentViewers: '12000'
        }
      },
      {
        id: 'vid_live',
        snippet: {
          title: 'ライブ中配信',
          channelTitle: 'テストチャンネル',
          channelId: 'UC_test1',
          description: 'ライブ中',
          thumbnails: { high: { url: 'https://img.example.com/live.jpg' } }
        },
        liveStreamingDetails: {
          scheduledStartTime: new Date(Date.now() - 3600000).toISOString(), // 1時間前に開始
          actualStartTime: new Date(Date.now() - 3600000).toISOString(),
          concurrentViewers: '5000'
        }
      }
    ]
  }
}

vi.mock('googleapis', () => ({
  google: {
    youtube: () => ({
      subscriptions: {
        list: vi.fn().mockResolvedValue(mockSubscriptions)
      },
      videos: {
        list: vi.fn().mockResolvedValue(mockVideos)
      }
    })
  }
}))

const { fetchSchedule } = await import('../../src/main/youtube-api.js')

describe('fetchSchedule', () => {
  it('配信予定とライブ中を返す', async () => {
    const result = await fetchSchedule({})
    expect(result.upcoming).toHaveLength(1)
    expect(result.live).toHaveLength(1)
    expect(result.upcoming[0].title).toBe('テスト配信')
    expect(result.live[0].title).toBe('ライブ中配信')
  })

  it('upcoming は scheduledStartTime で昇順ソート', async () => {
    const result = await fetchSchedule({})
    for (let i = 1; i < result.upcoming.length; i++) {
      expect(new Date(result.upcoming[i].scheduledStartTime).getTime()).toBeGreaterThanOrEqual(
        new Date(result.upcoming[i - 1].scheduledStartTime).getTime()
      )
    }
  })

  it('各アイテムに status フィールドがある', async () => {
    const result = await fetchSchedule({})
    expect(result.upcoming[0].status).toBe('upcoming')
    expect(result.live[0].status).toBe('live')
  })
})

describe('fetchRssFeed (タイムアウト)', () => {
  it('RSS 取得時に req.setTimeout が呼ばれる', async () => {
    const https = await import('https')
    https.default.get.mockClear()

    await fetchSchedule({})

    // チャンネルごとに https.get が呼ばれ、req.setTimeout が設定されているか確認
    expect(https.default.get).toHaveBeenCalled()
    const req = https.default.get.mock.results[0].value
    expect(req.setTimeout).toHaveBeenCalledWith(5000, expect.any(Function))
  })

  it('タイムアウト時は req.destroy を呼んで空文字で解決する', async () => {
    const https = await import('https')
    https.default.get.mockClear()

    // タイムアウトを発火させるモック
    https.default.get.mockImplementationOnce(() => {
      const req = {
        setTimeout: vi.fn((_, handler) => handler()), // 即座にタイムアウト発火
        destroy: vi.fn(),
        on: vi.fn()
      }
      return req
    })

    await fetchSchedule({})

    const req = https.default.get.mock.results[0].value
    expect(req.destroy).toHaveBeenCalled()
  })
})

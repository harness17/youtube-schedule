import { describe, it, expect, vi } from 'vitest'

const mockSubscriptions = {
  data: {
    items: [{ snippet: { resourceId: { channelId: 'UC_test1' } } }],
    nextPageToken: null
  }
}

const mockPlaylistItems = {
  data: {
    items: [
      { contentDetails: { videoId: 'vid1' } },
      { contentDetails: { videoId: 'vid_live' } },
      { contentDetails: { videoId: 'vid_delayed' } },
      { contentDetails: { videoId: 'vid_ended' } },
      { contentDetails: { videoId: 'vid_old_upcoming' } }
    ]
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
          thumbnails: { maxres: { url: 'https://img.example.com/thumb.jpg' } },
          liveBroadcastContent: 'upcoming'
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
          thumbnails: { high: { url: 'https://img.example.com/live.jpg' } },
          liveBroadcastContent: 'live'
        },
        liveStreamingDetails: {
          scheduledStartTime: new Date(Date.now() - 3600000).toISOString(),
          actualStartTime: new Date(Date.now() - 3600000).toISOString(),
          concurrentViewers: '5000'
        }
      },
      {
        id: 'vid_delayed',
        snippet: {
          title: '遅延配信',
          channelTitle: 'テストチャンネル',
          channelId: 'UC_test1',
          description: 'スケジュール時刻超過・未開始',
          thumbnails: { high: { url: 'https://img.example.com/delayed.jpg' } },
          liveBroadcastContent: 'upcoming'
        },
        liveStreamingDetails: {
          scheduledStartTime: new Date(Date.now() - 1800000).toISOString() // 30分前（遅延中）
        }
      },
      {
        id: 'vid_ended',
        snippet: {
          title: '終了済み配信',
          channelTitle: 'テストチャンネル',
          channelId: 'UC_test1',
          description: '終了済み',
          thumbnails: {},
          liveBroadcastContent: 'none'
        },
        liveStreamingDetails: {
          scheduledStartTime: new Date(Date.now() - 7200000).toISOString(),
          actualStartTime: new Date(Date.now() - 7200000).toISOString(),
          actualEndTime: new Date(Date.now() - 3600000).toISOString()
        }
      },
      {
        id: 'vid_old_upcoming',
        snippet: {
          title: '古い予定配信（更新されていないキャンセル等）',
          channelTitle: 'テストチャンネル',
          channelId: 'UC_test1',
          description: '3時間前に予定されていたが未開始のまま',
          thumbnails: {},
          liveBroadcastContent: 'upcoming'
        },
        liveStreamingDetails: {
          scheduledStartTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3時間前
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
      playlistItems: {
        list: vi.fn().mockResolvedValue(mockPlaylistItems)
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
    expect(result.upcoming).toHaveLength(2) // 通常upcoming + 遅延upcoming
    expect(result.live).toHaveLength(1)
    expect(result.upcoming.map((v) => v.title)).toContain('テスト配信')
    expect(result.live[0].title).toBe('ライブ中配信')
  })

  it('スケジュール時刻超過でも liveBroadcastContent=upcoming なら配信予定に含む', async () => {
    const result = await fetchSchedule({})
    const delayed = result.upcoming.find((v) => v.id === 'vid_delayed')
    expect(delayed).toBeDefined()
    expect(delayed.title).toBe('遅延配信')
  })

  it('actualEndTime がある終了済み配信を除外する', async () => {
    const result = await fetchSchedule({})
    const ended = [...result.upcoming, ...result.live].find((v) => v.id === 'vid_ended')
    expect(ended).toBeUndefined()
  })

  it('2時間以上前に予定されていた未開始配信（古い予定）を除外する', async () => {
    const result = await fetchSchedule({})
    const old = result.upcoming.find((v) => v.id === 'vid_old_upcoming')
    expect(old).toBeUndefined()
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

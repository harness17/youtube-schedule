import { describe, it, expect } from 'vitest'
import { toRssVideoRecord, toVideoRecord } from '../../../src/main/services/videoRecordMapper'

describe('videoRecordMapper', () => {
  it('maps YouTube API details into a persisted video record', () => {
    const now = 1_700_000_000_000
    const record = toVideoRecord(
      {
        id: 'api1',
        snippet: {
          channelId: 'UC1',
          channelTitle: 'Channel',
          title: 'Title',
          description: 'Desc',
          publishedAt: '2023-11-14T22:00:00.000Z',
          thumbnails: {
            medium: { url: 'medium.jpg' },
            high: { url: 'high.jpg' }
          },
          liveBroadcastContent: 'live'
        },
        liveStreamingDetails: {
          scheduledStartTime: '2023-11-14T21:30:00.000Z',
          actualStartTime: '2023-11-14T22:00:00.000Z',
          concurrentViewers: '123'
        },
        contentDetails: {
          duration: 'PT1H2M3S'
        }
      },
      now
    )

    expect(record).toMatchObject({
      id: 'api1',
      channelId: 'UC1',
      channelTitle: 'Channel',
      title: 'Title',
      description: 'Desc',
      thumbnail: 'high.jpg',
      status: 'live',
      scheduledStartTime: Date.parse('2023-11-14T21:30:00.000Z'),
      actualStartTime: Date.parse('2023-11-14T22:00:00.000Z'),
      concurrentViewers: 123,
      duration: 3723,
      publishedAt: Date.parse('2023-11-14T22:00:00.000Z'),
      firstSeenAt: now,
      lastCheckedAt: now,
      source: 'api'
    })
  })

  it('maps RSS entries using feed time as first seen timestamp', () => {
    const now = 1_700_000_000_000
    const record = toRssVideoRecord(
      {
        id: 'rss1',
        title: 'RSS title',
        description: 'RSS desc',
        published: '2023-11-15T01:00:00.000Z',
        channelTitle: 'Feed Channel'
      },
      { id: 'UC_RSS', title: 'Stored Channel' },
      now
    )

    expect(record).toMatchObject({
      id: 'rss1',
      channelId: 'UC_RSS',
      channelTitle: 'Feed Channel',
      title: 'RSS title',
      description: 'RSS desc',
      status: 'upcoming',
      scheduledStartTime: null,
      actualStartTime: null,
      firstSeenAt: Date.parse('2023-11-15T01:00:00.000Z'),
      lastCheckedAt: now,
      publishedAt: Date.parse('2023-11-15T01:00:00.000Z'),
      source: 'rss'
    })
  })

  it('falls back to channel id and current time when RSS metadata is sparse', () => {
    const now = 1_700_000_000_000
    const record = toRssVideoRecord({ id: 'rss2' }, { id: 'UC_ONLY' }, now)

    expect(record.channelTitle).toBe('UC_ONLY')
    expect(record.title).toBe('(タイトル未取得)')
    expect(record.firstSeenAt).toBe(now)
    expect(record.publishedAt).toBeNull()
    expect(record.url).toBe('https://www.youtube.com/watch?v=rss2')
  })
})

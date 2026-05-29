import { parseDuration } from '../lib/parseDuration.js'
import { deriveStatus } from './videoStatus.js'

export function toVideoRecord(v, now) {
  const ld = v.liveStreamingDetails || {}
  return {
    id: v.id,
    channelId: v.snippet.channelId,
    channelTitle: v.snippet.channelTitle,
    title: v.snippet.title,
    description: v.snippet.description ?? '',
    thumbnail:
      v.snippet.thumbnails?.maxres?.url ??
      v.snippet.thumbnails?.high?.url ??
      v.snippet.thumbnails?.medium?.url ??
      '',
    status: deriveStatus(v, now),
    scheduledStartTime: ld.scheduledStartTime ? new Date(ld.scheduledStartTime).getTime() : null,
    actualStartTime: ld.actualStartTime ? new Date(ld.actualStartTime).getTime() : null,
    concurrentViewers: ld.concurrentViewers ? Number(ld.concurrentViewers) : null,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    firstSeenAt: now,
    lastCheckedAt: now,
    duration: parseDuration(v.contentDetails?.duration),
    publishedAt: v.snippet.publishedAt ? new Date(v.snippet.publishedAt).getTime() : null,
    source: 'api'
  }
}

export function toRssVideoRecord(entry, channel, now) {
  const feedTime = Date.parse(entry.published ?? entry.updated ?? '')
  return {
    id: entry.id,
    channelId: channel.id,
    channelTitle: entry.channelTitle ?? channel.title ?? channel.id,
    title: entry.title || '(タイトル未取得)',
    description: entry.description ?? '',
    thumbnail: `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
    status: 'upcoming',
    scheduledStartTime: null,
    actualStartTime: null,
    concurrentViewers: null,
    url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
    firstSeenAt: Number.isNaN(feedTime) ? now : feedTime,
    lastCheckedAt: now,
    duration: null,
    publishedAt: Number.isNaN(feedTime) ? null : feedTime,
    source: 'rss'
  }
}

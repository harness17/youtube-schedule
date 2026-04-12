import { google } from 'googleapis'
import https from 'https'
import { XMLParser } from 'fast-xml-parser'

// ────────────────────────────────────────────
// コスト比較
//   旧: search.list × チャンネル数 × 2 = 100ユニット/チャンネル
//   新: subscriptions.list(~4) + RSS(0) + videos.list(~30) ≒ 34ユニット合計
// ────────────────────────────────────────────

async function getSubscribedChannelIds(yt) {
  const channelIds = []
  let pageToken = undefined
  do {
    const res = await yt.subscriptions.list({
      part: ['snippet'],
      mine: true,
      maxResults: 50,
      pageToken
    })
    for (const item of res.data.items || []) {
      channelIds.push(item.snippet.resourceId.channelId)
    }
    pageToken = res.data.nextPageToken
  } while (pageToken)
  return channelIds
}

// RSS フィードからビデオIDを取得（クォータ消費ゼロ）
function fetchRssFeed(channelId) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    https
      .get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => resolve(data))
      })
      .on('error', () => resolve(''))
  })
}

function parseVideoIdsFromRss(xml) {
  if (!xml) return []
  try {
    const parser = new XMLParser()
    const result = parser.parse(xml)
    const entries = result?.feed?.entry
    if (!entries) return []
    const arr = Array.isArray(entries) ? entries : [entries]
    return arr.map((e) => e['yt:videoId']).filter(Boolean)
  } catch {
    return []
  }
}

// videos.list は50件ずつバッチ処理（1バッチ = 1ユニット）
async function getVideoDetailsBatch(yt, videoIds) {
  if (videoIds.length === 0) return []
  const results = []
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const res = await yt.videos.list({
      part: ['snippet', 'liveStreamingDetails'],
      id: batch.join(',')
    })
    results.push(...(res.data.items || []))
  }
  return results
}

function toScheduleItem(v, status) {
  return {
    id: v.id,
    status,
    title: v.snippet.title,
    channelTitle: v.snippet.channelTitle,
    channelId: v.snippet.channelId,
    description: v.snippet.description,
    thumbnail:
      v.snippet.thumbnails?.maxres?.url ??
      v.snippet.thumbnails?.high?.url ??
      v.snippet.thumbnails?.medium?.url ??
      '',
    scheduledStartTime: v.liveStreamingDetails?.scheduledStartTime ?? null,
    actualStartTime: v.liveStreamingDetails?.actualStartTime ?? null,
    concurrentViewers: v.liveStreamingDetails?.concurrentViewers ?? null,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    channelUrl: `https://www.youtube.com/channel/${v.snippet.channelId}`
  }
}

export async function fetchSchedule(authClient) {
  const yt = google.youtube({ version: 'v3', auth: authClient })

  // Step1: 登録チャンネルID取得（~4ユニット）
  const channelIds = await getSubscribedChannelIds(yt)

  // Step2: 各チャンネルの RSS を並列取得（0ユニット）
  const rssResults = await Promise.all(channelIds.map(fetchRssFeed))
  const allVideoIds = [...new Set(rssResults.flatMap((xml) => parseVideoIdsFromRss(xml)))]

  // Step3: 動画詳細を取得（1ユニット/50件）
  const details = await getVideoDetailsBatch(yt, allVideoIds)

  const now = Date.now()
  const live = []
  const upcoming = []

  for (const v of details) {
    const ld = v.liveStreamingDetails
    if (!ld) continue

    // ライブ中: actualStartTime あり、actualEndTime なし
    if (ld.actualStartTime && !ld.actualEndTime) {
      live.push(toScheduleItem(v, 'live'))
      continue
    }

    // 配信予定: scheduledStartTime が未来
    if (ld.scheduledStartTime) {
      const startMs = new Date(ld.scheduledStartTime).getTime()
      if (startMs > now) {
        upcoming.push(toScheduleItem(v, 'upcoming'))
      }
    }
  }

  upcoming.sort(
    (a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime()
  )

  return { live, upcoming }
}

export async function addToWatchLater(authClient, videoId) {
  const yt = google.youtube({ version: 'v3', auth: authClient })
  await yt.playlistItems.insert({
    part: ['snippet'],
    requestBody: {
      snippet: {
        playlistId: 'WL',
        resourceId: {
          kind: 'youtube#video',
          videoId
        }
      }
    }
  })
  return true
}

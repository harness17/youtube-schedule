import { google } from 'googleapis'

// ────────────────────────────────────────────
// コスト比較
//   旧: RSS(0) + videos.list(~30) ≒ 34ユニット
//       ※ YouTubeがRSSをUser-Agentなしで404返すようになり廃止
//   新: subscriptions.list(~7) + playlistItems.list(326) + videos.list(~98) ≒ 431ユニット
//       ※ 認証済みAPIで安定動作、日次クォータ10,000に対し余裕あり
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

// UC→UU変換でアップロードプレイリストIDを導出
function getUploadsPlaylistId(channelId) {
  return 'UU' + channelId.slice(2)
}

// チャンネルの最新動画IDを playlistItems.list で取得（1ユニット/チャンネル）
// 非公開・エラーのチャンネルは空配列を返してスキップ
async function getRecentVideoIds(yt, channelId, maxResults = 15) {
  try {
    const res = await yt.playlistItems.list({
      part: ['contentDetails'],
      playlistId: getUploadsPlaylistId(channelId),
      maxResults
    })
    return (res.data.items || []).map((item) => item.contentDetails.videoId)
  } catch {
    return []
  }
}

// 全チャンネルの動画IDを並列取得（同時リクエスト数制限あり）
const PLAYLIST_CONCURRENCY = 10

async function getAllVideoIds(yt, channelIds) {
  const allIds = []
  for (let i = 0; i < channelIds.length; i += PLAYLIST_CONCURRENCY) {
    const batch = channelIds.slice(i, i + PLAYLIST_CONCURRENCY)
    const results = await Promise.all(batch.map((id) => getRecentVideoIds(yt, id)))
    allIds.push(...results.flat())
  }
  return [...new Set(allIds)]
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

  // Step1: 登録チャンネルID取得（~7ユニット）
  const channelIds = await getSubscribedChannelIds(yt)

  // Step2: 各チャンネルのアップロード一覧から最新動画IDを取得（1ユニット/チャンネル）
  const allVideoIds = await getAllVideoIds(yt, channelIds)

  // Step3: 動画詳細を取得（1ユニット/50件）
  const details = await getVideoDetailsBatch(yt, allVideoIds)

  const now = Date.now()
  const live = []
  const upcoming = []

  for (const v of details) {
    const ld = v.liveStreamingDetails
    const bc = v.snippet?.liveBroadcastContent

    // 終了済みはスキップ
    if (ld?.actualEndTime) continue

    // ライブ中: actualStartTime あり、actualEndTime なし
    if (ld?.actualStartTime && !ld?.actualEndTime) {
      live.push(toScheduleItem(v, 'live'))
      continue
    }

    // 配信予定・遅延待機中: liveBroadcastContent が 'upcoming'
    // scheduledStartTime が 2時間以上前のものはキャンセル済み扱いで除外
    if (bc === 'upcoming') {
      const startMs = ld?.scheduledStartTime
        ? new Date(ld.scheduledStartTime).getTime()
        : now + 1
      if (startMs > now - 2 * 60 * 60 * 1000) {
        upcoming.push(toScheduleItem(v, 'upcoming'))
      }
      continue
    }

    // フォールバック: scheduledStartTime が未来（liveBroadcastContent がない場合）
    if (ld?.scheduledStartTime) {
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

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
// 5秒でタイムアウト → 詰まったチャンネルをスキップして他の取得を続行
const RSS_TIMEOUT_MS = 5000

function fetchRssFeed(channelId) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const req = https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => resolve(data))
    })
    req.setTimeout(RSS_TIMEOUT_MS, () => {
      req.destroy()
      resolve('')
    })
    req.on('error', () => resolve(''))
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

// ────────────────────────────────────────────
// メンバーシップ限定チャンネルの配信取得
//   発見フェーズ: search.list upcoming → 新規IDを監視プールに追加
//   追跡フェーズ: videos.list(プール全ID) → 状態の真実はこちら
//     actualStartTime あり + actualEndTime なし → live
//     scheduledStartTime > now               → upcoming
//     actualEndTime あり / ID なし            → 終了、プールから削除
// ────────────────────────────────────────────

export async function fetchMembershipSchedule(authClient, channelIds, watchPool = []) {
  if (channelIds.length === 0) return { live: [], upcoming: [], updatedPool: [...watchPool] }

  const yt = google.youtube({ version: 'v3', auth: authClient })
  const poolSet = new Set(watchPool)

  // 発見フェーズ: search.list upcoming のみ（live は videos.list 追跡で検出）
  for (const channelId of channelIds) {
    try {
      const res = await yt.search.list({
        part: ['id'],
        channelId,
        eventType: 'upcoming',
        type: 'video',
        maxResults: 10
      })
      for (const item of res.data.items || []) {
        if (item.id?.videoId) poolSet.add(item.id.videoId)
      }
    } catch (err) {
      if (err.code === 403) throw err
    }
  }

  if (poolSet.size === 0) return { live: [], upcoming: [], updatedPool: [] }

  // 追跡フェーズ: プール全IDを videos.list にかけて状態を判定
  const details = await getVideoDetailsBatch(yt, [...poolSet])
  const foundIds = new Set(details.map((v) => v.id))
  const now = Date.now()
  const live = []
  const upcoming = []
  const toRemove = new Set()

  // API で見つからなかったID（削除済み・非公開化）
  for (const id of poolSet) {
    if (!foundIds.has(id)) toRemove.add(id)
  }

  for (const v of details) {
    const ld = v.liveStreamingDetails
    if (!ld) {
      toRemove.add(v.id)
      continue
    }
    if (ld.actualEndTime) {
      toRemove.add(v.id) // 配信終了
      continue
    }
    if (ld.actualStartTime && !ld.actualEndTime) {
      live.push(toScheduleItem(v, 'live'))
      continue
    }
    if (ld.scheduledStartTime) {
      const startMs = new Date(ld.scheduledStartTime).getTime()
      if (startMs > now) {
        upcoming.push(toScheduleItem(v, 'upcoming'))
      } else if (now - startMs > 6 * 60 * 60 * 1000) {
        // 予定時刻から6時間以上経過しても開始されていない → 中止扱いで削除
        toRemove.add(v.id)
      }
      // 6時間以内の過去予定（遅延・開始待ち）はプールに残す
    } else {
      toRemove.add(v.id)
    }
  }

  for (const id of toRemove) poolSet.delete(id)

  upcoming.sort(
    (a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime()
  )

  return { live, upcoming, updatedPool: [...poolSet] }
}

// ────────────────────────────────────────────
// URL / チャンネルID / @ハンドル → { channelId, channelTitle }
// ────────────────────────────────────────────

export async function resolveChannel(authClient, input) {
  const yt = google.youtube({ version: 'v3', auth: authClient })
  const trimmed = input.trim()

  let channelId = null
  let handle = null

  // UC から始まる 24文字のチャンネルID
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    channelId = trimmed
  }
  // https://www.youtube.com/channel/UCxxx
  else if (trimmed.includes('/channel/')) {
    const m = trimmed.match(/\/channel\/(UC[\w-]{22})/)
    if (m) channelId = m[1]
  }
  // @ハンドル または URL に @handle が含まれる
  else {
    const m = trimmed.match(/@([\w.-]+)/)
    handle = m ? m[1] : trimmed
  }

  try {
    const params = channelId ? { id: [channelId] } : { forHandle: handle }
    const res = await yt.channels.list({ part: ['snippet'], ...params })
    const ch = res.data.items?.[0]
    if (!ch) return { error: 'NOT_FOUND' }
    return { channelId: ch.id, channelTitle: ch.snippet.title }
  } catch {
    return { error: 'NOT_FOUND' }
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

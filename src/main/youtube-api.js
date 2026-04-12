import { google } from 'googleapis'

async function getSubscribedChannelIds(yt) {
  const channelIds = []
  let pageToken = undefined
  do {
    const res = await yt.subscriptions.list({
      part: ['snippet'],
      mine: true,
      maxResults: 50,
      pageToken,
    })
    for (const item of res.data.items) {
      channelIds.push(item.snippet.resourceId.channelId)
    }
    pageToken = res.data.nextPageToken
  } while (pageToken)
  return channelIds
}

async function getVideoIdsByEventType(yt, channelId, eventType) {
  const res = await yt.search.list({
    part: ['id'],
    channelId,
    eventType,
    type: 'video',
    maxResults: 10,
  })
  return (res.data.items || []).map((item) => item.id.videoId)
}

async function getVideoDetails(yt, videoIds) {
  if (videoIds.length === 0) return []
  const res = await yt.videos.list({
    part: ['snippet', 'liveStreamingDetails'],
    id: videoIds.join(','),
  })
  return res.data.items || []
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
    channelUrl: `https://www.youtube.com/channel/${v.snippet.channelId}`,
  }
}

export async function fetchSchedule(authClient) {
  const yt = google.youtube({ version: 'v3', auth: authClient })
  const channelIds = await getSubscribedChannelIds(yt)

  const [upcomingIds, liveIds] = await Promise.all([
    Promise.all(channelIds.map((id) => getVideoIdsByEventType(yt, id, 'upcoming'))).then((a) => a.flat()),
    Promise.all(channelIds.map((id) => getVideoIdsByEventType(yt, id, 'live'))).then((a) => a.flat()),
  ])

  const allIds = [...new Set([...upcomingIds, ...liveIds])]
  const details = await getVideoDetails(yt, allIds)

  const liveIdSet = new Set(liveIds)
  const live = []
  const upcoming = []

  for (const v of details) {
    if (!v.liveStreamingDetails?.scheduledStartTime) continue
    if (liveIdSet.has(v.id)) {
      live.push(toScheduleItem(v, 'live'))
    } else {
      upcoming.push(toScheduleItem(v, 'upcoming'))
    }
  }

  upcoming.sort(
    (a, b) =>
      new Date(a.scheduledStartTime).getTime() -
      new Date(b.scheduledStartTime).getTime()
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
          videoId,
        },
      },
    },
  })
  return true
}

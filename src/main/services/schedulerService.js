import { deriveStatus } from './videoStatus.js'

const SUBS_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const RSS_PARALLEL = 10

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function toVideoRecord(v, now) {
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
    scheduledStartTime: ld.scheduledStartTime
      ? new Date(ld.scheduledStartTime).getTime()
      : null,
    actualStartTime: ld.actualStartTime ? new Date(ld.actualStartTime).getTime() : null,
    concurrentViewers: ld.concurrentViewers ? Number(ld.concurrentViewers) : null,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    firstSeenAt: now,
    lastCheckedAt: now
  }
}

export function createSchedulerService({
  videoRepo,
  channelRepo,
  rssLogRepo,
  metaRepo,
  subsFetcher,
  rssFetcher,
  playlistFetcher,
  videoFetcher,
  authClient,
  ytFactory
}) {
  let inFlight = null

  async function resolveChannels(yt, now) {
    const lastSync = channelRepo.getLastSyncTime()
    if (lastSync && now - lastSync < SUBS_CACHE_TTL_MS) {
      return channelRepo.listAll()
    }
    const fresh = await subsFetcher.fetch(yt)
    channelRepo.replaceAll(fresh, now)
    return fresh
  }

  async function collectVideoIds(yt, channels, now) {
    const collected = new Set()
    for (const batch of chunk(channels, RSS_PARALLEL)) {
      await Promise.all(
        batch.map(async (ch) => {
          const res = await rssFetcher.fetch(ch.id)
          rssLogRepo.record({
            channelId: ch.id,
            fetchedAt: now,
            success: res.success,
            httpStatus: res.httpStatus ?? null,
            errorMessage: res.success ? null : res.reason
          })
          if (res.success) {
            for (const id of res.videoIds) collected.add(id)
          } else {
            const fallback = await playlistFetcher.fetch(yt, ch.uploadsPlaylistId)
            for (const id of fallback) collected.add(id)
          }
        })
      )
    }
    return [...collected]
  }

  async function doRefresh({ forceFullRecheck = false } = {}) {
    const now = Date.now()
    const yt = ytFactory(authClient)

    const channels = await resolveChannels(yt, now)
    const channelIds = new Set(channels.map((c) => c.id))
    const videoIds = await collectVideoIds(yt, channels, now)

    const known = videoRepo.getByIds(videoIds)
    const knownIds = new Set(known.map((v) => v.id))
    const recheckIds = forceFullRecheck
      ? Array.from(knownIds)
      : known
          .filter(
            (v) =>
              v.status === 'live' ||
              v.status === 'upcoming' ||
              now - v.lastCheckedAt > 24 * 60 * 60 * 1000
          )
          .map((v) => v.id)
    const newIds = videoIds.filter((id) => !knownIds.has(id))
    const target = Array.from(new Set([...newIds, ...recheckIds]))

    const details = await videoFetcher.fetch(yt, target)
    for (const v of details) {
      if (!channelIds.has(v.snippet?.channelId)) continue
      videoRepo.upsert(toVideoRecord(v, now))
    }

    metaRepo.set('last_full_refresh_at', String(now), now)
  }

  return {
    async refresh(opts = {}) {
      if (inFlight) return inFlight
      inFlight = (async () => {
        try {
          await doRefresh(opts)
        } finally {
          inFlight = null
        }
      })()
      return inFlight
    }
  }
}

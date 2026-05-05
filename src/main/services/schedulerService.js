import { deriveStatus } from './videoStatus.js'

const SUBS_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const RSS_PARALLEL = 10
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000
const ENDED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const NOTIFY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const CLEANUP_META_KEY = 'last_cleanup_at'

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function isRssCapableChannel(channel) {
  return typeof channel.id === 'string' && channel.id.startsWith('UC')
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
    scheduledStartTime: ld.scheduledStartTime ? new Date(ld.scheduledStartTime).getTime() : null,
    actualStartTime: ld.actualStartTime ? new Date(ld.actualStartTime).getTime() : null,
    concurrentViewers: ld.concurrentViewers ? Number(ld.concurrentViewers) : null,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    firstSeenAt: now,
    lastCheckedAt: now,
    source: 'api'
  }
}

function toRssVideoRecord(entry, channel, now) {
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
    source: 'rss'
  }
}

const NOOP_LOGGER = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  async withTiming(_phase, fn) {
    return fn()
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
  ytFactory,
  logger = NOOP_LOGGER
}) {
  let inFlight = null

  async function resolveChannels(yt, now) {
    if (!authClient) {
      const manual = channelRepo.listAll().filter(isRssCapableChannel)
      logger.info('scheduler.resolveChannels.rssOnly', { count: manual.length })
      return manual
    }

    const lastSync = channelRepo.getLastSyncTime()
    if (lastSync && now - lastSync < SUBS_CACHE_TTL_MS) {
      const cached = channelRepo.listAll().filter(isRssCapableChannel)
      logger.info('scheduler.resolveChannels.cached', { count: cached.length })
      return cached
    }
    return logger.withTiming('scheduler.resolveChannels', async () => {
      const fresh = await subsFetcher.fetch(yt)
      channelRepo.syncSubscriptions(fresh, now)
      return channelRepo.listAll().filter(isRssCapableChannel)
    })
  }

  async function collectVideoIds(yt, channels, now) {
    return logger.withTiming(
      'scheduler.collectVideoIds',
      async () => {
        const collected = new Set()
        const rssEntries = new Map()
        let rssSuccess = 0
        let rssFailure = 0
        let fallbackAttempts = 0
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
                rssSuccess++
                const limited = (res.entries ?? []).slice(0, 10)
                for (const entry of limited) {
                  collected.add(entry.id)
                  rssEntries.set(entry.id, { ...entry, channel: ch })
                }
                for (const id of res.videoIds) {
                  if (!rssEntries.has(id)) collected.add(id)
                }
              } else {
                rssFailure++
                if (!authClient || !ch.uploadsPlaylistId) return
                fallbackAttempts++
                logger.warn('scheduler.rss.fallback', {
                  channelId: ch.id,
                  reason: res.reason,
                  httpStatus: res.httpStatus ?? null
                })
                const fallback = await playlistFetcher.fetch(yt, ch.uploadsPlaylistId)
                for (const id of fallback) collected.add(id)
              }
            })
          )
        }
        logger.info('scheduler.collectVideoIds.summary', {
          channels: channels.length,
          videoIds: collected.size,
          rssSuccess,
          rssFailure,
          fallbackAttempts
        })
        return { videoIds: [...collected], rssEntries }
      },
      { channels: channels.length }
    )
  }

  async function doRefresh({ forceFullRecheck = false } = {}) {
    const now = Date.now()
    const yt = ytFactory(authClient)

    const channels = await resolveChannels(yt, now)
    const channelIds = new Set(channels.map((c) => c.id))
    const { videoIds, rssEntries } = await collectVideoIds(yt, channels, now)

    const known = videoRepo.getByIds(videoIds)
    const knownIds = new Set(known.map((v) => v.id))
    const recheckIds = forceFullRecheck
      ? Array.from(knownIds)
      : known
          .filter(
            (v) =>
              v.status === 'live' ||
              v.status === 'upcoming' ||
              (v.status !== 'ended' && now - v.lastCheckedAt > 24 * 60 * 60 * 1000)
          )
          .map((v) => v.id)
    const newIds = videoIds.filter((id) => !knownIds.has(id))
    const target = Array.from(new Set([...newIds, ...recheckIds]))

    const details = authClient
      ? await logger.withTiming('scheduler.videoDetails', () => videoFetcher.fetch(yt, target), {
          target: target.length,
          newIds: newIds.length,
          recheckIds: recheckIds.length
        })
      : []
    const fetchedIds = new Set(details.map((v) => v.id))
    if (!authClient) {
      for (const entry of rssEntries.values()) {
        videoRepo.upsert(toRssVideoRecord(entry, entry.channel, now))
      }
      metaRepo.set('last_full_refresh_at', String(now), now)
      maybeCleanup(now)
      return
    }

    for (const v of details) {
      if (!channelIds.has(v.snippet?.channelId)) continue
      videoRepo.upsert(toVideoRecord(v, now))
      channelRepo.upsertSeen(v.snippet.channelId, v.snippet.channelTitle)
    }

    // RSS から消えた live/upcoming 動画を救済する
    // （メンバー限定化・削除されると RSS に返らず status が live のまま固まる）
    const rssIdSet = new Set(videoIds)
    const orphanIds = videoRepo
      .listVisible(now)
      .map((v) => v.id)
      .filter((id) => !rssIdSet.has(id) && !fetchedIds.has(id))
    if (orphanIds.length > 0) {
      await logger.withTiming(
        'scheduler.orphanCheck',
        async () => {
          const orphanDetails = await videoFetcher.fetch(yt, orphanIds)
          const orphanFetchedIds = new Set(orphanDetails.map((v) => v.id))
          for (const v of orphanDetails) {
            videoRepo.upsert(toVideoRecord(v, now))
          }
          let endedCount = 0
          for (const id of orphanIds) {
            if (!orphanFetchedIds.has(id)) {
              videoRepo.markEnded(id, now)
              endedCount++
            }
          }
          logger.info('scheduler.orphanCheck.summary', {
            candidates: orphanIds.length,
            recovered: orphanFetchedIds.size,
            markedEnded: endedCount
          })
        },
        { candidates: orphanIds.length }
      )
    }

    metaRepo.set('last_full_refresh_at', String(now), now)

    maybeCleanup(now)
  }

  function maybeCleanup(now) {
    const last = Number(metaRepo.get(CLEANUP_META_KEY) ?? 0)
    if (now - last < CLEANUP_INTERVAL_MS) return
    videoRepo.deleteExpiredEnded({
      defaultThreshold: now - ENDED_RETENTION_MS,
      notifyThreshold: now - NOTIFY_RETENTION_MS
    })
    metaRepo.set(CLEANUP_META_KEY, String(now), now)
  }

  return {
    async refresh(opts = {}) {
      if (inFlight) {
        logger.info('scheduler.refresh.deduplicated', {})
        return inFlight
      }
      inFlight = (async () => {
        const startedAt = Date.now()
        logger.info('scheduler.refresh.start', { forceFullRecheck: !!opts.forceFullRecheck })
        try {
          await doRefresh(opts)
          logger.info('scheduler.refresh.done', { durationMs: Date.now() - startedAt })
        } catch (err) {
          logger.error('scheduler.refresh.error', {
            durationMs: Date.now() - startedAt,
            error: err
          })
          throw err
        } finally {
          inFlight = null
        }
      })()
      return inFlight
    }
  }
}

import { buildWatchUrl } from './videoUrl.js'
import { deriveStatus } from './videoStatus.js'

const PLAYLIST_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000

const NOOP_LOGGER = {
  info() {},
  warn() {},
  error() {}
}

function toTimestamp(value) {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function bestThumbnail(thumbnails = {}) {
  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    ''
  )
}

function toVideoRecord(item, now, details = null) {
  const snippet = item.snippet ?? {}
  const liveStreamingDetails = details?.liveStreamingDetails ?? {}
  const videoId = item.videoId
  const channelId = snippet.videoOwnerChannelId ?? snippet.channelId ?? ''
  const channelTitle = snippet.videoOwnerChannelTitle ?? snippet.channelTitle ?? channelId
  return {
    id: videoId,
    channelId,
    channelTitle,
    title: snippet.title ?? '',
    description: snippet.description ?? '',
    thumbnail: bestThumbnail(snippet.thumbnails),
    status: details ? deriveStatus(details, now) : 'ended',
    scheduledStartTime: liveStreamingDetails.scheduledStartTime
      ? new Date(liveStreamingDetails.scheduledStartTime).getTime()
      : null,
    actualStartTime: liveStreamingDetails.actualStartTime
      ? new Date(liveStreamingDetails.actualStartTime).getTime()
      : null,
    concurrentViewers: liveStreamingDetails.concurrentViewers
      ? Number(liveStreamingDetails.concurrentViewers)
      : null,
    url: buildWatchUrl(videoId),
    firstSeenAt: toTimestamp(snippet.publishedAt) ?? now,
    lastCheckedAt: now,
    duration: null,
    publishedAt: toTimestamp(snippet.publishedAt),
    source: 'api'
  }
}

function diffPlaylist(currentIds, activeIds, removedIds) {
  const current = new Set(currentIds)
  const added = currentIds.filter((id) => !activeIds.has(id) && !removedIds.has(id))
  const removed = [...activeIds].filter((id) => !current.has(id))
  const restored = currentIds.filter((id) => removedIds.has(id))
  return { added, removed, restored }
}

export function createPlaylistSyncService({
  playlistRepo,
  videoRepo,
  channelRepo,
  playlistFetcher,
  videoDetailsFetcher,
  authClient,
  ytFactory,
  logger = NOOP_LOGGER,
  now = () => Date.now()
}) {
  let inFlight = null

  async function doRefresh() {
    const config = playlistRepo.getConfig()
    if (!config?.enabled || !config.playlistId) {
      return { skipped: true, reason: 'not-configured', added: 0, removed: 0, restored: 0 }
    }
    if (!authClient) {
      return { skipped: true, reason: 'not-authenticated', added: 0, removed: 0, restored: 0 }
    }

    const timestamp = now()
    const items = await playlistFetcher.fetchPlaylistItems(authClient, config.playlistId)
    const currentIds = []
    const details = videoDetailsFetcher
      ? await videoDetailsFetcher.fetch(
          ytFactory(authClient),
          items.map((item) => item.videoId).filter(Boolean)
        )
      : []
    const detailsById = new Map(details.map((item) => [item.id, item]))

    for (const item of items) {
      const record = toVideoRecord(item, timestamp, detailsById.get(item.videoId))
      if (!record.id) continue
      currentIds.push(record.id)
      if (record.channelId) {
        channelRepo.ensureChannel(record.channelId, record.channelTitle, timestamp)
      }
      videoRepo.upsert(record)
    }

    const activeIds = playlistRepo.getPlaylistVideoIds()
    const removedIds = playlistRepo.getRemovedPlaylistVideoIds()
    const diff = diffPlaylist([...new Set(currentIds)], activeIds, removedIds)
    playlistRepo.applyDiff(diff, timestamp)
    playlistRepo.updateLastSyncedAt(timestamp)
    logger.info('playlistSync.refresh.done', {
      playlistId: config.playlistId,
      added: diff.added.length,
      removed: diff.removed.length,
      restored: diff.restored.length
    })
    return {
      added: diff.added.length,
      removed: diff.removed.length,
      restored: diff.restored.length
    }
  }

  async function refresh() {
    if (inFlight) {
      logger.info('playlistSync.refresh.deduplicated', {})
      return inFlight
    }
    inFlight = doRefresh().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  async function refreshIfDue() {
    const config = playlistRepo.getConfig()
    if (!config?.enabled || !config.playlistId) {
      return { skipped: true, reason: 'not-configured', added: 0, removed: 0, restored: 0 }
    }
    if (config.lastSyncedAt && now() - config.lastSyncedAt < PLAYLIST_SYNC_INTERVAL_MS) {
      return { skipped: true, reason: 'fresh', added: 0, removed: 0, restored: 0 }
    }
    return refresh()
  }

  return {
    refresh,
    refreshIfDue
  }
}

export { PLAYLIST_SYNC_INTERVAL_MS }

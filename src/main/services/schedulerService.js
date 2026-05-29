import { parseDuration } from '../lib/parseDuration.js'
import { resolveVideoId } from '../lib/resolveVideoId.js'
import { isQuotaError } from '../lib/quotaReset.js'
import { createSchedulerMaintenance } from './schedulerMaintenance.js'
import { toRssVideoRecord, toVideoRecord } from './videoRecordMapper.js'

const SUBS_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const RSS_PARALLEL = 10
const ARCHIVE_BACKFILL_META_KEY = 'archive_backfill_done'
const RSS_FALLBACK_COOLDOWN_MS = 6 * 60 * 60 * 1000
const RSS_FALLBACK_MAX_PER_REFRESH = 20
const RSS_FALLBACK_META_PREFIX = 'rss_fallback_at:'

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function isRssCapableChannel(channel) {
  return typeof channel.id === 'string' && channel.id.startsWith('UC')
}

function getLastRssFallbackAt(metaRepo, channelId) {
  const raw = metaRepo.get(`${RSS_FALLBACK_META_PREFIX}${channelId}`)
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

function recordRssFallback(metaRepo, channelId, now) {
  metaRepo.set(`${RSS_FALLBACK_META_PREFIX}${channelId}`, String(now), now)
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
  playlistSyncService = null,
  videoFetcher,
  authClient,
  ytFactory,
  logger = NOOP_LOGGER
}) {
  let inFlight = null
  const maintenance = createSchedulerMaintenance({ videoRepo, metaRepo })

  async function resolveChannels(yt, now, { forceSubscriptionsResync = false } = {}) {
    if (!authClient) {
      const manual = channelRepo.listAll().filter(isRssCapableChannel)
      logger.info('scheduler.resolveChannels.rssOnly', { count: manual.length })
      return manual
    }

    const lastSync = channelRepo.getLastSyncTime()
    if (!forceSubscriptionsResync && lastSync && now - lastSync < SUBS_CACHE_TTL_MS) {
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
        let fallbackSkippedByCooldown = 0
        let fallbackSkippedByLimit = 0
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
                if (fallbackAttempts >= RSS_FALLBACK_MAX_PER_REFRESH) {
                  fallbackSkippedByLimit++
                  logger.warn('scheduler.rss.fallbackSkipped', {
                    channelId: ch.id,
                    reason: 'limit',
                    maxPerRefresh: RSS_FALLBACK_MAX_PER_REFRESH
                  })
                  return
                }
                const lastFallbackAt = getLastRssFallbackAt(metaRepo, ch.id)
                if (now - lastFallbackAt < RSS_FALLBACK_COOLDOWN_MS) {
                  fallbackSkippedByCooldown++
                  logger.warn('scheduler.rss.fallbackSkipped', {
                    channelId: ch.id,
                    reason: 'cooldown',
                    lastFallbackAt,
                    cooldownMs: RSS_FALLBACK_COOLDOWN_MS
                  })
                  return
                }
                fallbackAttempts++
                recordRssFallback(metaRepo, ch.id, now)
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
          fallbackAttempts,
          fallbackSkippedByCooldown,
          fallbackSkippedByLimit
        })
        return { videoIds: [...collected], rssEntries }
      },
      { channels: channels.length }
    )
  }

  async function doRefresh({ forceFullRecheck = false, forceSubscriptionsResync = false } = {}) {
    const now = Date.now()
    const yt = ytFactory(authClient)

    const channels = await resolveChannels(yt, now, { forceSubscriptionsResync })
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
    // 手動登録動画は RSS に出ないため、明示的に再チェック対象へ加える
    const manualIds = videoRepo.listManualTrackingIds()
    const target = Array.from(new Set([...newIds, ...recheckIds, ...manualIds]))

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
      maintenance.maybeCleanup(now)
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

    maintenance.maybeCleanup(now)
  }

  // 既存アーカイブの duration / published_at を一度だけ補完する。
  // migration 008/009 より前に ended 化した動画はこれらが NULL のため、
  // videos.list（1ユニット/50件）でまとめて取得して埋める。
  async function backfillArchiveMeta() {
    if (metaRepo.get(ARCHIVE_BACKFILL_META_KEY)) {
      return { skipped: 'already-done' }
    }
    if (!authClient) {
      return { skipped: 'no-auth' }
    }
    const ids = videoRepo.listBackfillTargetIds()
    if (ids.length === 0) {
      metaRepo.set(ARCHIVE_BACKFILL_META_KEY, '1')
      return { skipped: 'nothing-to-backfill' }
    }
    const yt = ytFactory(authClient)
    let updated = 0
    try {
      for (const batch of chunk(ids, 50)) {
        const details = await videoFetcher.fetch(yt, batch)
        for (const v of details) {
          videoRepo.backfillMeta(v.id, {
            duration: parseDuration(v.contentDetails?.duration),
            publishedAt: v.snippet?.publishedAt ? new Date(v.snippet.publishedAt).getTime() : null
          })
          updated += 1
        }
      }
    } catch (err) {
      // クォータ超過・タイムアウト等。フラグは立てず次回再開する
      logger.error('scheduler.backfill.error', { candidates: ids.length, updated, error: err })
      return { aborted: true, updated }
    }
    metaRepo.set(ARCHIVE_BACKFILL_META_KEY, '1')
    logger.info('scheduler.backfill.done', { candidates: ids.length, updated })
    return { done: true, candidates: ids.length, updated }
  }

  // URL/ID で指定された動画を手動登録する。メンバー限定配信など
  // RSS・購読 API で自動検出できない動画を追跡対象に加えるために使う。
  async function addManualVideo(input) {
    const videoId = resolveVideoId(input)
    if (!videoId) {
      return { ok: false, error: 'INVALID_INPUT' }
    }
    if (!authClient) {
      return { ok: false, error: 'NOT_AUTHENTICATED' }
    }
    const yt = ytFactory(authClient)
    let details
    try {
      details = await videoFetcher.fetch(yt, [videoId])
    } catch (err) {
      logger.error('scheduler.addManualVideo.error', { videoId, error: err })
      return { ok: false, error: 'FETCH_FAILED' }
    }
    const item = details.find((v) => v.id === videoId)
    if (!item) {
      // 動画が存在しない / 非公開 / メンバーでないため取得不可
      return { ok: false, error: 'NOT_FOUND' }
    }
    const now = Date.now()
    const record = {
      ...toVideoRecord(item, now),
      isMembershipOnly: true,
      source: 'manual'
    }
    videoRepo.upsert(record)
    logger.info('scheduler.addManualVideo.done', { videoId, status: record.status })
    return { ok: true, video: videoRepo.getById(videoId) }
  }

  // クォータ超過の状態を返す。発生時刻を metaRepo から読み、その直後の
  // リセット時刻をまだ過ぎていなければ exceeded=true とする。
  function getQuotaStatus() {
    return maintenance.getQuotaStatus()
  }

  return {
    backfillArchiveMeta,
    addManualVideo,
    getQuotaStatus,
    refreshPlaylist() {
      return (
        playlistSyncService?.refresh() ?? Promise.resolve({ skipped: true, reason: 'disabled' })
      )
    },
    refreshPlaylistIfDue() {
      return (
        playlistSyncService?.refreshIfDue() ??
        Promise.resolve({ skipped: true, reason: 'disabled' })
      )
    },
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
          // 取得成功＝クォータ回復。記録済みの超過フラグがあれば消す。
          maintenance.clearQuotaExceeded()
          logger.info('scheduler.refresh.done', { durationMs: Date.now() - startedAt })
        } catch (err) {
          if (isQuotaError(err)) {
            // クォータ超過は想定内の運用状態。例外として投げ直さず、発生時刻を
            // 記録してバナー表示（getQuotaStatus）で案内する。巨大な GaxiosError
            // スタックトレースはコンソールに出さない。
            maintenance.recordQuotaExceeded()
            logger.warn('scheduler.refresh.quotaExceeded', {
              durationMs: Date.now() - startedAt
            })
            return
          }
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

import { isQuotaError } from '../lib/quotaReset.js'
import { toVideoRecord } from './videoRecordMapper.js'

// 配信開始直前の動画と現在 live の動画だけを短い間隔で videos.list に再問い合わせて
// upcoming → live → ended の遷移を即時検出する軽量ポーラー。
// SchedulerService の 30 分ポーリングだけでは「ライブ開始」通知が最大 30 分遅延するため、
// この高頻度ポーラーで status 遷移を補完する。
//
// クォータ:
//   videos.list は 50 件まで 1 ユニット。対象ゼロのときは API を呼ばない。
//   1 分間隔・対象 1 バッチ想定で最大 1,440 ユニット/日。
export const IMMINENT_POLL_INTERVAL_MS = 60 * 1000
export const IMMINENT_BEFORE_MS = 5 * 60 * 1000
export const IMMINENT_AFTER_MS = 20 * 60 * 1000

const NOOP_LOGGER = {
  info() {},
  warn() {},
  error() {},
  debug() {}
}

function selectImminentIds(videos, now) {
  const lowerBound = now - IMMINENT_BEFORE_MS
  const upperBound = now + IMMINENT_AFTER_MS
  const ids = []
  for (const v of videos) {
    if (v.status === 'live') {
      ids.push(v.id)
      continue
    }
    if (v.status === 'upcoming') {
      const sst = v.scheduledStartTime
      if (typeof sst === 'number' && sst >= lowerBound && sst <= upperBound) {
        ids.push(v.id)
      }
    }
  }
  return ids
}

export function createImminentPoller({
  videoRepo,
  videoFetcher,
  getAuthClient,
  ytFactory,
  onUpdated = () => {},
  logger = NOOP_LOGGER
}) {
  let timer = null
  let inFlight = false

  async function tick(nowOverride) {
    if (inFlight) {
      logger.debug('imminentPoller.tick.skip', { reason: 'inFlight' })
      return { skipped: 'inFlight' }
    }
    const authClient = getAuthClient?.()
    if (!authClient) {
      return { skipped: 'no-auth' }
    }
    const now = nowOverride ?? Date.now()
    const visible = videoRepo.listVisible(now)
    const ids = selectImminentIds(visible, now)
    if (ids.length === 0) {
      return { skipped: 'no-targets' }
    }
    inFlight = true
    try {
      const yt = ytFactory(authClient)
      let details
      try {
        details = await videoFetcher.fetch(yt, ids)
      } catch (err) {
        if (isQuotaError(err)) {
          logger.warn('imminentPoller.tick.quotaExceeded', { ids: ids.length })
          return { skipped: 'quota-exceeded' }
        }
        logger.error('imminentPoller.tick.error', { ids: ids.length, error: err })
        return { error: 'FETCH_FAILED' }
      }
      const prevById = new Map(visible.map((v) => [v.id, v]))
      const fetchedIds = new Set(details.map((v) => v.id))
      let changed = 0
      for (const detail of details) {
        const record = toVideoRecord(detail, now)
        const prev = prevById.get(detail.id)
        if (!prev || prev.status !== record.status) changed += 1
        videoRepo.upsert(record)
      }
      // 取得結果に含まれない動画は YouTube 側で削除・非公開化された可能性がある。
      // ここでは ended 化を main の orphan check に任せ、ログだけ残す。
      const missing = ids.filter((id) => !fetchedIds.has(id))
      if (missing.length > 0) {
        logger.info('imminentPoller.tick.missing', { count: missing.length })
      }
      if (changed > 0) {
        logger.info('imminentPoller.tick.changed', { changed, ids: ids.length })
        try {
          onUpdated()
        } catch (err) {
          logger.error('imminentPoller.onUpdated.error', { error: err })
        }
      }
      return { processed: ids.length, changed }
    } finally {
      inFlight = false
    }
  }

  function start(intervalMs = IMMINENT_POLL_INTERVAL_MS) {
    stop()
    timer = setInterval(() => {
      tick().catch((err) => logger.error('imminentPoller.tick.unhandled', { error: err }))
    }, intervalMs)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  return { tick, start, stop }
}

export { selectImminentIds }

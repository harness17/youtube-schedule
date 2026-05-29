import { nextQuotaReset } from '../lib/quotaReset.js'

export const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000
export const ENDED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
export const NOTIFY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
export const CLEANUP_META_KEY = 'last_cleanup_at'
export const QUOTA_EXCEEDED_META_KEY = 'quota_exceeded_at'

export function createSchedulerMaintenance({
  videoRepo,
  metaRepo,
  nowProvider = () => Date.now()
}) {
  function maybeCleanup(now) {
    const last = Number(metaRepo.get(CLEANUP_META_KEY) ?? 0)
    if (now - last < CLEANUP_INTERVAL_MS) return 0
    const deleted = videoRepo.deleteExpiredEnded({
      defaultThreshold: now - ENDED_RETENTION_MS,
      notifyThreshold: now - NOTIFY_RETENTION_MS
    })
    metaRepo.set(CLEANUP_META_KEY, String(now), now)
    return deleted
  }

  function recordQuotaExceeded(now = nowProvider()) {
    metaRepo.set(QUOTA_EXCEEDED_META_KEY, String(now), now)
  }

  function clearQuotaExceeded(now = nowProvider()) {
    if (metaRepo.get(QUOTA_EXCEEDED_META_KEY)) {
      metaRepo.set(QUOTA_EXCEEDED_META_KEY, '', now)
      return true
    }
    return false
  }

  function getQuotaStatus(now = nowProvider()) {
    const raw = metaRepo.get(QUOTA_EXCEEDED_META_KEY)
    const exceededAt = Number(raw)
    if (!raw || !Number.isFinite(exceededAt) || exceededAt <= 0) {
      return { exceeded: false, resetAt: null }
    }
    const resetAt = nextQuotaReset(exceededAt)
    if (now >= resetAt) {
      return { exceeded: false, resetAt: null }
    }
    return { exceeded: true, resetAt }
  }

  return {
    clearQuotaExceeded,
    getQuotaStatus,
    maybeCleanup,
    recordQuotaExceeded
  }
}

import { describe, it, expect, vi } from 'vitest'
import {
  CLEANUP_INTERVAL_MS,
  createSchedulerMaintenance
} from '../../../src/main/services/schedulerMaintenance'
import { nextQuotaReset } from '../../../src/main/lib/quotaReset'

function createRepos(meta = {}) {
  const store = new Map(Object.entries(meta))
  return {
    videoRepo: {
      deleteExpiredEnded: vi.fn().mockReturnValue(3)
    },
    metaRepo: {
      get: vi.fn((key) => store.get(key)),
      set: vi.fn((key, value) => store.set(key, value))
    }
  }
}

describe('schedulerMaintenance', () => {
  it('runs cleanup when no previous cleanup timestamp exists', () => {
    const now = 1_700_000_000_000
    const repos = createRepos()
    const maintenance = createSchedulerMaintenance(repos)

    expect(maintenance.maybeCleanup(now)).toBe(3)
    expect(repos.videoRepo.deleteExpiredEnded).toHaveBeenCalledWith({
      defaultThreshold: now - 30 * 24 * 60 * 60 * 1000,
      notifyThreshold: now - 90 * 24 * 60 * 60 * 1000
    })
    expect(repos.metaRepo.set).toHaveBeenCalledWith('last_cleanup_at', String(now), now)
  })

  it('skips cleanup while the cleanup interval has not elapsed', () => {
    const now = 1_700_000_000_000
    const repos = createRepos({ last_cleanup_at: String(now - CLEANUP_INTERVAL_MS + 1) })
    const maintenance = createSchedulerMaintenance(repos)

    expect(maintenance.maybeCleanup(now)).toBe(0)
    expect(repos.videoRepo.deleteExpiredEnded).not.toHaveBeenCalled()
  })

  it('records and clears quota exceeded state', () => {
    const now = 1_700_000_000_000
    const repos = createRepos()
    const maintenance = createSchedulerMaintenance(repos)

    maintenance.recordQuotaExceeded(now)
    expect(repos.metaRepo.set).toHaveBeenCalledWith('quota_exceeded_at', String(now), now)
    expect(maintenance.clearQuotaExceeded(now + 1000)).toBe(true)
    expect(repos.metaRepo.set).toHaveBeenCalledWith('quota_exceeded_at', '', now + 1000)
  })

  it('returns quota exceeded until the next quota reset timestamp', () => {
    const exceededAt = Date.parse('2026-05-28T12:00:00.000Z')
    const resetAt = nextQuotaReset(exceededAt)
    const repos = createRepos({ quota_exceeded_at: String(exceededAt) })
    const maintenance = createSchedulerMaintenance(repos)

    expect(maintenance.getQuotaStatus(resetAt - 1)).toEqual({ exceeded: true, resetAt })
    expect(maintenance.getQuotaStatus(resetAt)).toEqual({ exceeded: false, resetAt: null })
  })

  it('ignores missing or invalid quota metadata', () => {
    const repos = createRepos({ quota_exceeded_at: 'not-a-number' })
    const maintenance = createSchedulerMaintenance(repos)

    expect(maintenance.getQuotaStatus()).toEqual({ exceeded: false, resetAt: null })
  })
})

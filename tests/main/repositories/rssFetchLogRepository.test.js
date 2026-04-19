import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createRssFetchLogRepository } from '../../../src/main/repositories/rssFetchLogRepository'

describe('RssFetchLogRepository', () => {
  let db, repo

  beforeEach(() => {
    db = openDatabase(':memory:')
    runMigrations(db)
    repo = createRssFetchLogRepository(db)
  })
  afterEach(() => closeDatabase(db))

  it('records a success entry', () => {
    repo.record({ channelId: 'UC1', fetchedAt: 1, success: true, httpStatus: 200 })
    const rate = repo.getFailureRateSince(0)
    expect(rate).toBe(0)
  })

  it('computes failure rate across recent records', () => {
    const now = 1_000_000
    repo.record({ channelId: 'UC1', fetchedAt: now, success: false, httpStatus: 404 })
    repo.record({ channelId: 'UC2', fetchedAt: now, success: false, httpStatus: 404 })
    repo.record({ channelId: 'UC3', fetchedAt: now, success: true, httpStatus: 200 })
    const rate = repo.getFailureRateSince(now - 1)
    expect(rate).toBeCloseTo(2 / 3, 5)
  })

  it('getFailureRateSince returns 0 when there are no records', () => {
    expect(repo.getFailureRateSince(0)).toBe(0)
  })

  it('pruneOlderThan deletes old entries', () => {
    repo.record({ channelId: 'UC1', fetchedAt: 100, success: true })
    repo.record({ channelId: 'UC1', fetchedAt: 300, success: true })
    const removed = repo.pruneOlderThan(200)
    expect(removed).toBe(1)
  })
})

import { describe, it, expect } from 'vitest'
import { isQuotaError, nextQuotaReset } from '../../src/main/lib/quotaReset'

describe('isQuotaError', () => {
  it('returns true for a 403 error whose message mentions quota', () => {
    expect(
      isQuotaError({
        code: 403,
        message: 'The request cannot be completed because you have exceeded your quota.'
      })
    ).toBe(true)
  })

  it('returns true for a 403 error whose errors[].reason is quotaExceeded', () => {
    expect(isQuotaError({ code: 403, errors: [{ reason: 'quotaExceeded' }] })).toBe(true)
  })

  it('detects quota info nested under cause (GaxiosError shape)', () => {
    expect(isQuotaError({ code: 403, cause: { message: 'exceeded your quota' } })).toBe(true)
  })

  it('returns false for a non-quota 403 (e.g. plain forbidden)', () => {
    expect(isQuotaError({ code: 403, message: 'forbidden' })).toBe(false)
  })

  it('returns false for non-403 errors even if they mention quota', () => {
    expect(isQuotaError({ code: 404, message: 'quota' })).toBe(false)
  })

  it('returns false for null / undefined', () => {
    expect(isQuotaError(null)).toBe(false)
    expect(isQuotaError(undefined)).toBe(false)
  })
})

describe('nextQuotaReset', () => {
  it('returns the same-day 08:00 UTC when called before it', () => {
    const from = Date.UTC(2026, 0, 1, 5, 0, 0)
    expect(nextQuotaReset(from)).toBe(Date.UTC(2026, 0, 1, 8, 0, 0))
  })

  it('returns the next-day 08:00 UTC when called after it', () => {
    const from = Date.UTC(2026, 0, 1, 10, 0, 0)
    expect(nextQuotaReset(from)).toBe(Date.UTC(2026, 0, 2, 8, 0, 0))
  })

  it('returns the next-day reset when called exactly at 08:00 UTC', () => {
    const from = Date.UTC(2026, 0, 1, 8, 0, 0)
    expect(nextQuotaReset(from)).toBe(Date.UTC(2026, 0, 2, 8, 0, 0))
  })

  it('always returns a time strictly after the input', () => {
    const now = Date.now()
    expect(nextQuotaReset(now)).toBeGreaterThan(now)
  })
})

import { describe, it, expect } from 'vitest'
import { deriveStatus } from '../../../src/main/services/videoStatus'

const NOW = 1_700_000_000_000

function v({ actualEnd, actualStart, scheduled, bc } = {}) {
  return {
    liveStreamingDetails: {
      actualEndTime: actualEnd,
      actualStartTime: actualStart,
      scheduledStartTime: scheduled
    },
    snippet: { liveBroadcastContent: bc }
  }
}

describe('deriveStatus', () => {
  it('returns "ended" when actualEndTime is set', () => {
    expect(deriveStatus(v({ actualEnd: new Date(NOW - 1000).toISOString() }), NOW)).toBe('ended')
  })

  it('returns "live" for active stream started less than 24h ago', () => {
    expect(
      deriveStatus(v({ actualStart: new Date(NOW - 3600_000).toISOString() }), NOW)
    ).toBe('live')
  })

  it('returns "ended" for stream that started over 24h ago without actualEnd', () => {
    expect(
      deriveStatus(v({ actualStart: new Date(NOW - 25 * 3600_000).toISOString() }), NOW)
    ).toBe('ended')
  })

  it('returns "upcoming" when liveBroadcastContent=upcoming and scheduled is future', () => {
    expect(
      deriveStatus(
        v({ bc: 'upcoming', scheduled: new Date(NOW + 3600_000).toISOString() }),
        NOW
      )
    ).toBe('upcoming')
  })

  it('returns "ended" when upcoming is scheduled over 2h in the past', () => {
    expect(
      deriveStatus(
        v({ bc: 'upcoming', scheduled: new Date(NOW - 3 * 3600_000).toISOString() }),
        NOW
      )
    ).toBe('ended')
  })

  it('returns "ended" for regular videos (no liveBroadcastContent)', () => {
    expect(deriveStatus(v({}), NOW)).toBe('ended')
  })

  it('returns "upcoming" when scheduledStartTime is missing but bc=upcoming', () => {
    expect(deriveStatus(v({ bc: 'upcoming' }), NOW)).toBe('upcoming')
  })
})

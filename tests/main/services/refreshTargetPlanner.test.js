import { describe, it, expect } from 'vitest'
import {
  RECHECK_STALE_MS,
  planRefreshTargets
} from '../../../src/main/services/refreshTargetPlanner'

const NOW = 1_700_000_000_000

function knownVideo(id, overrides = {}) {
  return {
    id,
    status: 'ended',
    lastCheckedAt: NOW,
    ...overrides
  }
}

describe('planRefreshTargets', () => {
  it('uses all known ids as recheck ids when forceFullRecheck is true', () => {
    const result = planRefreshTargets({
      videoIds: ['A', 'B', 'C'],
      known: [knownVideo('B'), knownVideo('A')],
      manualIds: ['M', 'B'],
      forceFullRecheck: true,
      now: NOW
    })

    expect(result.newIds).toEqual(['C'])
    expect(result.recheckIds).toEqual(['B', 'A'])
    expect(result.target).toEqual(['C', 'B', 'A', 'M'])
  })

  it('rechecks live, upcoming, and stale non-ended videos', () => {
    const result = planRefreshTargets({
      videoIds: ['LIVE', 'UPCOMING', 'STALE', 'FRESH', 'ENDED_STALE'],
      known: [
        knownVideo('LIVE', { status: 'live' }),
        knownVideo('UPCOMING', { status: 'upcoming' }),
        knownVideo('STALE', {
          status: 'none',
          lastCheckedAt: NOW - RECHECK_STALE_MS - 1
        }),
        knownVideo('FRESH', {
          status: 'none',
          lastCheckedAt: NOW - RECHECK_STALE_MS
        }),
        knownVideo('ENDED_STALE', {
          status: 'ended',
          lastCheckedAt: NOW - RECHECK_STALE_MS - 1
        })
      ],
      manualIds: [],
      forceFullRecheck: false,
      now: NOW
    })

    expect(result.newIds).toEqual([])
    expect(result.recheckIds).toEqual(['LIVE', 'UPCOMING', 'STALE'])
    expect(result.target).toEqual(['LIVE', 'UPCOMING', 'STALE'])
  })

  it('extracts new ids in the same order as collected video ids', () => {
    const result = planRefreshTargets({
      videoIds: ['NEW_1', 'KNOWN', 'NEW_2'],
      known: [knownVideo('KNOWN')],
      manualIds: [],
      forceFullRecheck: false,
      now: NOW
    })

    expect(result.newIds).toEqual(['NEW_1', 'NEW_2'])
    expect(result.recheckIds).toEqual([])
    expect(result.target).toEqual(['NEW_1', 'NEW_2'])
  })

  it('merges manual ids after new and recheck ids while removing duplicates', () => {
    const result = planRefreshTargets({
      videoIds: ['NEW', 'LIVE'],
      known: [knownVideo('LIVE', { status: 'live' })],
      manualIds: ['MANUAL', 'NEW', 'LIVE'],
      forceFullRecheck: false,
      now: NOW
    })

    expect(result.newIds).toEqual(['NEW'])
    expect(result.recheckIds).toEqual(['LIVE'])
    expect(result.target).toEqual(['NEW', 'LIVE', 'MANUAL'])
  })
})

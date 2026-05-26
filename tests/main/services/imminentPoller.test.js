import { describe, it, expect, vi } from 'vitest'
import {
  createImminentPoller,
  selectImminentIds,
  IMMINENT_BEFORE_MS,
  IMMINENT_AFTER_MS
} from '../../../src/main/services/imminentPoller'

const NOW = 1_700_000_000_000

function video(overrides = {}) {
  return {
    id: 'V1',
    channelId: 'UC1',
    channelTitle: 'C',
    status: 'upcoming',
    scheduledStartTime: NOW + 5 * 60 * 1000,
    actualStartTime: null,
    ...overrides
  }
}

function videoDetail(id, status, overrides = {}) {
  const ld = overrides.liveStreamingDetails || {}
  return {
    id,
    snippet: {
      title: `t-${id}`,
      channelTitle: 'C',
      channelId: 'UC1',
      description: '',
      thumbnails: { high: { url: 'u' } },
      liveBroadcastContent: status === 'live' ? 'live' : status === 'ended' ? 'none' : 'upcoming'
    },
    liveStreamingDetails:
      status === 'live'
        ? {
            scheduledStartTime: new Date(NOW - 60_000).toISOString(),
            actualStartTime: new Date(NOW).toISOString(),
            ...ld
          }
        : status === 'ended'
          ? {
              scheduledStartTime: new Date(NOW - 60_000).toISOString(),
              actualStartTime: new Date(NOW - 3600_000).toISOString(),
              actualEndTime: new Date(NOW).toISOString(),
              ...ld
            }
          : {
              scheduledStartTime: new Date(NOW + 5 * 60 * 1000).toISOString(),
              ...ld
            }
  }
}

describe('selectImminentIds', () => {
  it('現在ライブの動画を対象に含める', () => {
    const ids = selectImminentIds([video({ id: 'L1', status: 'live' })], NOW)
    expect(ids).toEqual(['L1'])
  })

  it('開始時刻が -5min ～ +20min の upcoming を含める', () => {
    const ids = selectImminentIds(
      [
        video({ id: 'A', status: 'upcoming', scheduledStartTime: NOW + 10 * 60 * 1000 }),
        video({ id: 'B', status: 'upcoming', scheduledStartTime: NOW - 3 * 60 * 1000 })
      ],
      NOW
    )
    expect(ids.sort()).toEqual(['A', 'B'])
  })

  it('開始時刻が遠すぎる upcoming は除外する', () => {
    const ids = selectImminentIds(
      [video({ id: 'F', status: 'upcoming', scheduledStartTime: NOW + 60 * 60 * 1000 })],
      NOW
    )
    expect(ids).toEqual([])
  })

  it('境界値: -5min ちょうど・+20min ちょうどは含む', () => {
    const ids = selectImminentIds(
      [
        video({ id: 'E1', status: 'upcoming', scheduledStartTime: NOW - IMMINENT_BEFORE_MS }),
        video({ id: 'E2', status: 'upcoming', scheduledStartTime: NOW + IMMINENT_AFTER_MS })
      ],
      NOW
    )
    expect(ids.sort()).toEqual(['E1', 'E2'])
  })

  it('scheduledStartTime が null の upcoming は除外する', () => {
    const ids = selectImminentIds(
      [video({ id: 'N', status: 'upcoming', scheduledStartTime: null })],
      NOW
    )
    expect(ids).toEqual([])
  })

  it('ended は対象外', () => {
    const ids = selectImminentIds([video({ id: 'X', status: 'ended' })], NOW)
    expect(ids).toEqual([])
  })
})

function createMocks(visible = []) {
  return {
    videoRepo: {
      upsert: vi.fn(),
      listVisible: vi.fn(() => visible)
    },
    videoFetcher: {
      fetch: vi.fn().mockResolvedValue([])
    },
    getAuthClient: vi.fn(() => ({})),
    ytFactory: vi.fn(() => ({})),
    onUpdated: vi.fn(),
    logger: { info() {}, warn() {}, error() {}, debug() {} }
  }
}

describe('createImminentPoller.tick', () => {
  it('認証クライアントがなければ skip する', async () => {
    const m = createMocks([video()])
    m.getAuthClient = vi.fn(() => null)
    const poller = createImminentPoller(m)
    const res = await poller.tick(NOW)
    expect(res).toEqual({ skipped: 'no-auth' })
    expect(m.videoFetcher.fetch).not.toHaveBeenCalled()
  })

  it('対象がゼロなら API を呼ばない', async () => {
    const m = createMocks([])
    const poller = createImminentPoller(m)
    const res = await poller.tick(NOW)
    expect(res).toEqual({ skipped: 'no-targets' })
    expect(m.videoFetcher.fetch).not.toHaveBeenCalled()
  })

  it('upcoming が live に遷移したら upsert + onUpdated を呼ぶ', async () => {
    const m = createMocks([video({ id: 'V1', status: 'upcoming' })])
    m.videoFetcher.fetch = vi.fn().mockResolvedValue([videoDetail('V1', 'live')])
    const poller = createImminentPoller(m)
    const res = await poller.tick(NOW)
    expect(res.processed).toBe(1)
    expect(res.changed).toBe(1)
    expect(m.videoRepo.upsert).toHaveBeenCalledTimes(1)
    expect(m.videoRepo.upsert.mock.calls[0][0].status).toBe('live')
    expect(m.onUpdated).toHaveBeenCalledTimes(1)
  })

  it('status が変わらなければ onUpdated を呼ばない', async () => {
    const m = createMocks([video({ id: 'V1', status: 'upcoming' })])
    m.videoFetcher.fetch = vi.fn().mockResolvedValue([videoDetail('V1', 'upcoming')])
    const poller = createImminentPoller(m)
    const res = await poller.tick(NOW)
    expect(res.changed).toBe(0)
    expect(m.onUpdated).not.toHaveBeenCalled()
  })

  it('クォータ超過エラーは握り潰す', async () => {
    const m = createMocks([video({ id: 'V1', status: 'live' })])
    const quotaErr = Object.assign(new Error('quotaExceeded'), {
      code: 403,
      errors: [{ reason: 'quotaExceeded' }]
    })
    m.videoFetcher.fetch = vi.fn().mockRejectedValue(quotaErr)
    const poller = createImminentPoller(m)
    const res = await poller.tick(NOW)
    expect(res).toEqual({ skipped: 'quota-exceeded' })
    expect(m.videoRepo.upsert).not.toHaveBeenCalled()
  })

  it('実行中の tick が完了するまで二重実行をブロックする', async () => {
    const m = createMocks([video({ id: 'V1', status: 'live' })])
    let resolveFetch
    m.videoFetcher.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = () => resolve([videoDetail('V1', 'live')])
        })
    )
    const poller = createImminentPoller(m)
    const first = poller.tick(NOW)
    const second = await poller.tick(NOW)
    expect(second).toEqual({ skipped: 'inFlight' })
    resolveFetch()
    await first
  })
})

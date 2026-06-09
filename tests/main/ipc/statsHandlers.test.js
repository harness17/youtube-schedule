import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, ipcMainHandle } = vi.hoisted(() => {
  const handlers = new Map()
  return {
    handlers,
    ipcMainHandle: vi.fn((channel, handler) => handlers.set(channel, handler))
  }
})

vi.mock('electron', () => ({
  ipcMain: { handle: ipcMainHandle }
}))

const { registerStatsHandlers } = await import('../../../src/main/ipc/statsHandlers')

function invoke(channel, ...args) {
  return handlers.get(channel)({}, ...args)
}

describe('statsHandlers', () => {
  let statsRepo
  let dbBroken

  beforeEach(() => {
    handlers.clear()
    ipcMainHandle.mockClear()
    statsRepo = {
      getChannelActivity: vi.fn().mockReturnValue({
        unwatchedPinned: [{ id: 'UC1' }],
        silentChannels: [],
        frequencyRanking: [],
        viewedRates: [{ channelId: 'UC1', viewedRate: 50 }],
        unviewedBacklog: [{ channelId: 'UC1', unviewedCount: 2 }],
        favoriteChannels: [{ channelId: 'UC1', favoriteCount: 1 }]
      })
    }
    dbBroken = false
    registerStatsHandlers({
      getStatsRepo: () => statsRepo,
      getDbBroken: () => dbBroken
    })
  })

  it('registers stats:channelActivity', () => {
    expect([...handlers.keys()]).toEqual(['stats:channelActivity'])
  })

  it('stats:channelActivity returns channel activity from the stats repository', () => {
    expect(invoke('stats:channelActivity')).toEqual({
      unwatchedPinned: [{ id: 'UC1' }],
      silentChannels: [],
      frequencyRanking: [],
      viewedRates: [{ channelId: 'UC1', viewedRate: 50 }],
      unviewedBacklog: [{ channelId: 'UC1', unviewedCount: 2 }],
      favoriteChannels: [{ channelId: 'UC1', favoriteCount: 1 }]
    })
  })

  it('stats:channelActivity reports dbBroken before reading the repository', () => {
    dbBroken = true

    expect(invoke('stats:channelActivity')).toEqual({
      unwatchedPinned: [],
      silentChannels: [],
      frequencyRanking: [],
      viewedRates: [],
      unviewedBacklog: [],
      favoriteChannels: [],
      dbBroken: true
    })
    expect(statsRepo.getChannelActivity).not.toHaveBeenCalled()
  })

  it('stats:channelActivity returns NOT_INITIALIZED when the stats repository is missing', () => {
    registerStatsHandlers({
      getStatsRepo: () => null,
      getDbBroken: () => false
    })

    expect(invoke('stats:channelActivity')).toEqual({ error: 'NOT_INITIALIZED' })
  })
})

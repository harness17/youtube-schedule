import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyFavoriteReorder,
  buildTabChannelList,
  groupFavoritesBySection,
  groupMissedBySection,
  resolvePeriod
} from '../../src/renderer/src/tabStateHelpers.js'

const fixedNow = new Date('2026-06-04T00:00:00Z')
const dayMs = 24 * 60 * 60 * 1000

describe('resolvePeriod', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(fixedNow)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('all period returns no bounds', () => {
    expect(resolvePeriod({ period: 'all' })).toEqual({ periodStart: null, periodEnd: null })
  })

  it.each([
    ['7d', 7],
    ['30d', 30],
    ['90d', 90]
  ])('%s period returns a start bound', (period, days) => {
    expect(resolvePeriod({ period })).toEqual({
      periodStart: fixedNow.getTime() - days * dayMs,
      periodEnd: null
    })
  })

  it('custom period returns custom bounds', () => {
    expect(resolvePeriod({ period: 'custom', customStart: 1000, customEnd: 2000 })).toEqual({
      periodStart: 1000,
      periodEnd: 2000
    })
  })
})

describe('groupFavoritesBySection', () => {
  it('groups favorites by viewing state and status', () => {
    const upcoming = { id: 'upcoming', status: 'upcoming', viewedAt: null }
    const live = { id: 'live', status: 'live', viewedAt: null }
    const ended = { id: 'ended', status: 'ended', viewedAt: null }
    const viewed = { id: 'viewed', status: 'ended', viewedAt: 1000 }

    expect(groupFavoritesBySection([upcoming, live, ended, viewed])).toEqual({
      upcomingFavs: [upcoming, live],
      normalFavs: [ended],
      viewedFavs: [viewed]
    })
  })

  it('returns empty sections for an empty list', () => {
    expect(groupFavoritesBySection([])).toEqual({
      upcomingFavs: [],
      normalFavs: [],
      viewedFavs: []
    })
  })
})

describe('groupMissedBySection', () => {
  it('groups missed videos by status', () => {
    const upcoming = { id: 'upcoming', status: 'upcoming' }
    const live = { id: 'live', status: 'live' }
    const ended = { id: 'ended', status: 'ended' }

    expect(groupMissedBySection([upcoming, live, ended])).toEqual({
      upcomingMissed: [upcoming, live],
      endedMissed: [ended]
    })
  })

  it('returns empty sections for an empty list', () => {
    expect(groupMissedBySection([])).toEqual({
      upcomingMissed: [],
      endedMissed: []
    })
  })
})

describe('buildTabChannelList', () => {
  const pinnedChannelIds = new Set(['pinned'])
  const allDbChannels = [
    { id: 'other', title: 'Other' },
    { id: 'pinned', title: 'Pinned' },
    { id: 'missing', title: 'Missing' }
  ]

  it('builds archive channels from all database channels', () => {
    const result = buildTabChannelList({
      activeTab: 'archive',
      live: [],
      upcoming: [],
      missedVideos: [],
      favoriteVideos: [],
      pinnedChannelIds,
      allDbChannels,
      selectedChannel: 'all'
    })

    expect(result).toEqual([
      { id: 'pinned', title: 'Pinned', isPinned: true },
      { id: 'missing', title: 'Missing', isPinned: false },
      { id: 'other', title: 'Other', isPinned: false }
    ])
  })

  it('builds schedule channels from live and upcoming items', () => {
    const result = buildTabChannelList({
      activeTab: 'schedule',
      live: [
        { id: 'live-1', channelId: 'other', channelTitle: 'Other' },
        { id: 'live-2', channelId: 'other', channelTitle: 'Other duplicate' }
      ],
      upcoming: [{ id: 'upcoming-1', channelId: 'pinned', channelTitle: 'Pinned' }],
      missedVideos: [],
      favoriteVideos: [],
      pinnedChannelIds,
      allDbChannels,
      selectedChannel: 'all'
    })

    expect(result).toEqual([
      { id: 'pinned', title: 'Pinned', isPinned: true },
      { id: 'other', title: 'Other', isPinned: false }
    ])
  })

  it('builds favorite channels from favorite videos', () => {
    const result = buildTabChannelList({
      activeTab: 'favorites',
      live: [],
      upcoming: [],
      missedVideos: [],
      favoriteVideos: [
        { id: 'favorite-1', channelId: 'other', channelTitle: 'Other' },
        { id: 'favorite-2', channelId: 'pinned', channelTitle: 'Pinned' }
      ],
      pinnedChannelIds,
      allDbChannels,
      selectedChannel: 'all'
    })

    expect(result.map((channel) => channel.id)).toEqual(['pinned', 'other'])
  })

  it('builds missed channels from missed videos', () => {
    const result = buildTabChannelList({
      activeTab: 'missed',
      live: [],
      upcoming: [],
      missedVideos: [{ id: 'missed-1', channelId: 'other', channelTitle: 'Other' }],
      favoriteVideos: [],
      pinnedChannelIds,
      allDbChannels,
      selectedChannel: 'all'
    })

    expect(result).toEqual([{ id: 'other', title: 'Other', isPinned: false }])
  })

  it('prepends selected channel from database when it is not in the current tab data', () => {
    const result = buildTabChannelList({
      activeTab: 'schedule',
      live: [],
      upcoming: [],
      missedVideos: [],
      favoriteVideos: [],
      pinnedChannelIds,
      allDbChannels,
      selectedChannel: 'missing'
    })

    expect(result[0]).toEqual({ id: 'missing', title: 'Missing', isPinned: false })
  })

  it('does not prepend a selected channel when all channels are selected', () => {
    const result = buildTabChannelList({
      activeTab: 'schedule',
      live: [],
      upcoming: [],
      missedVideos: [],
      favoriteVideos: [],
      pinnedChannelIds,
      allDbChannels,
      selectedChannel: 'all'
    })

    expect(result).toEqual([])
  })
})

describe('applyFavoriteReorder', () => {
  const favorites = [
    { id: 'a', title: 'A' },
    { id: 'b', title: 'B' },
    { id: 'c', title: 'C' },
    { id: 'd', title: 'D' }
  ]

  it('reorders the whole list when scopeIds is null', () => {
    expect(applyFavoriteReorder(favorites, 'a', 'c').map((item) => item.id)).toEqual([
      'b',
      'c',
      'a',
      'd'
    ])
  })

  it('reorders only the specified scope', () => {
    expect(applyFavoriteReorder(favorites, 'b', 'd', ['b', 'd']).map((item) => item.id)).toEqual([
      'a',
      'd',
      'c',
      'b'
    ])
  })

  it('returns the previous list when activeId is missing', () => {
    expect(applyFavoriteReorder(favorites, 'missing', 'c')).toBe(favorites)
  })

  it('returns the previous list when overId is missing', () => {
    expect(applyFavoriteReorder(favorites, 'a', 'missing')).toBe(favorites)
  })
})

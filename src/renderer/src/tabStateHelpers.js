import { arrayMove } from '@dnd-kit/sortable'
import { sortSettingsChannels } from './settingsModalModel.js'

export function resolvePeriod(filters) {
  const dayMs = 24 * 60 * 60 * 1000
  if (filters.period === 'custom') {
    return { periodStart: filters.customStart, periodEnd: filters.customEnd }
  }
  const presets = { '7d': 7, '30d': 30, '90d': 90 }
  const days = presets[filters.period]
  if (!days) return { periodStart: null, periodEnd: null }
  return { periodStart: Date.now() - days * dayMs, periodEnd: null }
}

export function groupFavoritesBySection(items) {
  return items.reduce(
    (acc, item) => {
      if (item.viewedAt != null) {
        acc.viewedFavs.push(item)
      } else if (item.status === 'ended') {
        acc.normalFavs.push(item)
      } else {
        acc.upcomingFavs.push(item)
      }
      return acc
    },
    { upcomingFavs: [], normalFavs: [], viewedFavs: [] }
  )
}

export function groupMissedBySection(items) {
  return items.reduce(
    (acc, item) => {
      if (item.status === 'ended') acc.endedMissed.push(item)
      else acc.upcomingMissed.push(item)
      return acc
    },
    { upcomingMissed: [], endedMissed: [] }
  )
}

export function buildTabChannelList({
  activeTab,
  live,
  upcoming,
  missedVideos,
  favoriteVideos,
  pinnedChannelIds,
  allDbChannels,
  selectedChannel
}) {
  let channels
  if (activeTab === 'archive') {
    channels = sortSettingsChannels(
      allDbChannels.map((c) => ({
        id: c.id,
        title: c.title,
        isPinned: pinnedChannelIds.has(c.id)
      }))
    )
  } else {
    let source
    if (activeTab === 'schedule') source = [...live, ...upcoming]
    else if (activeTab === 'missed') source = missedVideos
    else if (activeTab === 'favorites') source = favoriteVideos
    else source = []
    const map = new Map()
    for (const item of source) {
      if (!map.has(item.channelId)) map.set(item.channelId, item.channelTitle)
    }
    channels = sortSettingsChannels(
      [...map.entries()].map(([id, title]) => ({
        id,
        title,
        isPinned: pinnedChannelIds.has(id)
      }))
    )
  }
  if (selectedChannel !== 'all' && !channels.some((c) => c.id === selectedChannel)) {
    const dbCh = allDbChannels.find((c) => c.id === selectedChannel)
    if (dbCh) {
      channels = [
        { id: dbCh.id, title: dbCh.title, isPinned: pinnedChannelIds.has(dbCh.id) },
        ...channels
      ]
    }
  }
  return channels
}

export function applyFavoriteReorder(prev, activeId, overId, scopeIds = null) {
  const ids = Array.isArray(scopeIds) ? scopeIds : prev.map((v) => v.id)
  const oldIndex = ids.indexOf(activeId)
  const newIndex = ids.indexOf(overId)
  if (oldIndex < 0 || newIndex < 0) return prev
  const newScopeIds = arrayMove(ids, oldIndex, newIndex)
  const scopedIndices = prev.reduce((acc, v, i) => {
    if (ids.includes(v.id)) acc.push(i)
    return acc
  }, [])
  const result = [...prev]
  newScopeIds.forEach((id, i) => {
    result[scopedIndices[i]] = prev.find((v) => v.id === id)
  })
  return result
}

import PropTypes from 'prop-types'
import ScheduleCard from './ScheduleCard.jsx'

const TZ = 'Asia/Tokyo'

function getDateKey(isoString) {
  if (!isoString) return '時刻未取得'
  const d = new Date(isoString)
  return d.toLocaleDateString('ja-JP', {
    timeZone: TZ,
    month: 'long',
    day: 'numeric',
    weekday: 'short'
  })
}

function groupByDate(items) {
  const groups = {}
  for (const item of items) {
    const key = getDateKey(item.scheduledStartTime)
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return groups
}

function getSortedGroupEntries(groups, items) {
  const seen = []
  for (const item of items) {
    const key = getDateKey(item.scheduledStartTime)
    if (!seen.includes(key)) seen.push(key)
  }
  return seen.map((key) => [key, groups[key]])
}

function toAnchorId(label) {
  return 'section-' + label.replace(/\s/g, '-')
}

function scrollToSection(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function getStartTime(item) {
  const raw = item.actualStartTime ?? item.scheduledStartTime ?? item.lastCheckedAt ?? 0
  const time = raw instanceof Date ? raw.getTime() : new Date(raw).getTime()
  return Number.isNaN(time) ? 0 : time
}

function getSortBlock(item, pinnedChannelIds) {
  if (item.isNotify || item.isFavorite) return 0
  if (pinnedChannelIds.has(item.channelId)) return 1
  return 2
}

function compareByPriorityThenTime(a, b, pinnedChannelIds, { descending = false } = {}) {
  const blockDiff = getSortBlock(a, pinnedChannelIds) - getSortBlock(b, pinnedChannelIds)
  if (blockDiff !== 0) return blockDiff

  const timeDiff = getStartTime(a) - getStartTime(b)
  if (timeDiff !== 0) return descending ? -timeDiff : timeDiff

  return String(a.id).localeCompare(String(b.id))
}

function isPickupItem(item, pinnedChannelIds) {
  return Boolean(item.isFavorite || item.isNotify || pinnedChannelIds.has(item.channelId))
}

export default function ScheduleList({
  live = [],
  upcoming = [],
  darkMode = false,
  pinnedChannelIds = new Set(),
  pickupOnly = false,
  onToggleWatch,
  onToggleFavorite,
  onTogglePin,
  onFilterChannel,
  isChannelFiltered = () => false
}) {
  const displayLive = pickupOnly
    ? live.filter((item) => isPickupItem(item, pinnedChannelIds))
    : live
  const displayUpcoming = pickupOnly
    ? upcoming.filter((item) => isPickupItem(item, pinnedChannelIds))
    : upcoming
  const isEmpty = displayLive.length === 0 && displayUpcoming.length === 0

  if (isEmpty) {
    return (
      <div
        style={{ textAlign: 'center', color: darkMode ? '#7878a0' : '#6060a0', marginTop: '48px' }}
      >
        {pickupOnly ? 'ピックアップ対象の予定・ライブはありません' : '予定された配信はありません'}
      </div>
    )
  }

  const sortedLive = [...displayLive].sort((a, b) =>
    compareByPriorityThenTime(a, b, pinnedChannelIds)
  )

  const scheduledUpcoming = displayUpcoming.filter((item) => item.scheduledStartTime)
  const feedItems = displayUpcoming.filter((item) => !item.scheduledStartTime)
  const sortedFeedItems = [...feedItems].sort((a, b) => {
    return compareByPriorityThenTime(a, b, pinnedChannelIds, { descending: true })
  })

  const groups = groupByDate(scheduledUpcoming)
  const sortedEntries = getSortedGroupEntries(groups, scheduledUpcoming).map(
    ([dateLabel, items]) => [
      dateLabel,
      [...items].sort((a, b) => compareByPriorityThenTime(a, b, pinnedChannelIds))
    ]
  )

  const navItems = [
    ...(displayLive.length > 0
      ? [{ label: 'ライブ配信中', id: 'section-live', isLive: true }]
      : []),
    ...sortedEntries.map(([dateLabel]) => ({
      label: dateLabel,
      id: toAnchorId(dateLabel),
      isLive: false
    })),
    ...(sortedFeedItems.length > 0
      ? [{ label: '時刻未取得', id: 'section-feed', isLive: false }]
      : [])
  ]

  return (
    <div>
      {navItems.length > 1 && (
        <nav className="yt-nav">
          {navItems.map(({ label, id, isLive }) => (
            <button
              key={id}
              onClick={() => scrollToSection(id)}
              className={`yt-nav-btn${isLive ? ' yt-nav-btn--live' : ''}`}
            >
              {isLive ? '🔴 ' : ''}
              {label}
            </button>
          ))}
        </nav>
      )}

      {displayLive.length > 0 && (
        <div id="section-live" style={{ marginBottom: '24px' }}>
          <div className="yt-section-label" style={{ color: darkMode ? '#ff4466' : '#e8001c' }}>
            🔴 ライブ配信中
          </div>
          {sortedLive.map((item) => (
            <ScheduleCard
              key={item.id}
              item={item}
              darkMode={darkMode}
              watched={item.isNotify}
              isPinned={pinnedChannelIds.has(item.channelId)}
              onToggleWatch={onToggleWatch}
              onToggleFavorite={onToggleFavorite}
              onTogglePin={onTogglePin}
              onFilterChannel={onFilterChannel}
              isChannelFiltered={isChannelFiltered(item.channelId)}
            />
          ))}
        </div>
      )}

      {sortedEntries.map(([dateLabel, groupItems]) => (
        <div key={dateLabel} id={toAnchorId(dateLabel)} style={{ marginBottom: '24px' }}>
          <div className="yt-section-label">📅 {dateLabel}</div>
          {groupItems.map((item) => (
            <ScheduleCard
              key={item.id}
              item={item}
              darkMode={darkMode}
              watched={item.isNotify}
              isPinned={pinnedChannelIds.has(item.channelId)}
              onToggleWatch={onToggleWatch}
              onToggleFavorite={onToggleFavorite}
              onTogglePin={onTogglePin}
              onFilterChannel={onFilterChannel}
              isChannelFiltered={isChannelFiltered(item.channelId)}
            />
          ))}
        </div>
      ))}

      {sortedFeedItems.length > 0 && (
        <div id="section-feed" style={{ marginBottom: '24px' }}>
          <div className="yt-section-label">📡 時刻未取得</div>
          {sortedFeedItems.map((item) => (
            <ScheduleCard
              key={item.id}
              item={item}
              darkMode={darkMode}
              watched={item.isNotify}
              isPinned={pinnedChannelIds.has(item.channelId)}
              onToggleWatch={onToggleWatch}
              onToggleFavorite={onToggleFavorite}
              onTogglePin={onTogglePin}
              onFilterChannel={onFilterChannel}
              isChannelFiltered={isChannelFiltered(item.channelId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

ScheduleList.propTypes = {
  live: PropTypes.array,
  upcoming: PropTypes.array,
  darkMode: PropTypes.bool,
  pinnedChannelIds: PropTypes.instanceOf(Set),
  pickupOnly: PropTypes.bool,
  onToggleWatch: PropTypes.func,
  onToggleFavorite: PropTypes.func,
  onTogglePin: PropTypes.func,
  onFilterChannel: PropTypes.func,
  isChannelFiltered: PropTypes.func
}

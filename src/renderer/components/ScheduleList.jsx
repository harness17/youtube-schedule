import PropTypes from 'prop-types'
import ScheduleCard from './ScheduleCard.jsx'

const TZ = 'Asia/Tokyo'

function getDateKey(isoString) {
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

export default function ScheduleList({
  live = [],
  upcoming = [],
  darkMode = false,
  pinnedChannelIds = new Set(),
  onToggleWatch,
  onToggleFavorite,
  onTogglePin
}) {
  const isEmpty = live.length === 0 && upcoming.length === 0

  if (isEmpty) {
    return (
      <div
        style={{ textAlign: 'center', color: darkMode ? '#7878a0' : '#6060a0', marginTop: '48px' }}
      >
        予定された配信はありません
      </div>
    )
  }

  const sortedLive = [...live].sort((a, b) => {
    const ap = pinnedChannelIds.has(a.channelId) ? 0 : 1
    const bp = pinnedChannelIds.has(b.channelId) ? 0 : 1
    if (ap !== bp) return ap - bp
    return (
      (a.actualStartTime ?? a.scheduledStartTime ?? 0) -
      (b.actualStartTime ?? b.scheduledStartTime ?? 0)
    )
  })

  const groups = groupByDate(upcoming)
  const sortedEntries = getSortedGroupEntries(groups, upcoming).map(([dateLabel, items]) => [
    dateLabel,
    [...items].sort((a, b) => {
      const ap = pinnedChannelIds.has(a.channelId) ? 0 : 1
      const bp = pinnedChannelIds.has(b.channelId) ? 0 : 1
      if (ap !== bp) return ap - bp
      return (a.scheduledStartTime ?? 0) - (b.scheduledStartTime ?? 0)
    })
  ])

  const navItems = [
    ...(live.length > 0 ? [{ label: 'ライブ配信中', id: 'section-live', isLive: true }] : []),
    ...sortedEntries.map(([dateLabel]) => ({
      label: dateLabel,
      id: toAnchorId(dateLabel),
      isLive: false
    }))
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

      {live.length > 0 && (
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
            />
          ))}
        </div>
      ))}
    </div>
  )
}

ScheduleList.propTypes = {
  live: PropTypes.array,
  upcoming: PropTypes.array,
  darkMode: PropTypes.bool,
  pinnedChannelIds: PropTypes.instanceOf(Set),
  onToggleWatch: PropTypes.func,
  onToggleFavorite: PropTypes.func,
  onTogglePin: PropTypes.func
}

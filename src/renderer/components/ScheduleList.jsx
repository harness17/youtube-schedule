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
    // 1. お知らせ・お気に入りフラグ優先
    const af = a.isNotify || a.isFavorite ? 0 : 1
    const bf = b.isNotify || b.isFavorite ? 0 : 1
    if (af !== bf) return af - bf
    // 2. ピン済みチャンネル優先
    const ap = pinnedChannelIds.has(a.channelId) ? 0 : 1
    const bp = pinnedChannelIds.has(b.channelId) ? 0 : 1
    if (ap !== bp) return ap - bp
    // 3. 開始時刻昇順
    return (
      (a.actualStartTime ?? a.scheduledStartTime ?? 0) -
      (b.actualStartTime ?? b.scheduledStartTime ?? 0)
    )
  })

  const scheduledUpcoming = upcoming.filter((item) => item.scheduledStartTime)
  const feedItems = upcoming.filter((item) => !item.scheduledStartTime)
  const sortedFeedItems = [...feedItems].sort((a, b) => {
    const af = a.isNotify || a.isFavorite ? 0 : 1
    const bf = b.isNotify || b.isFavorite ? 0 : 1
    if (af !== bf) return af - bf
    const ap = pinnedChannelIds.has(a.channelId) ? 0 : 1
    const bp = pinnedChannelIds.has(b.channelId) ? 0 : 1
    if (ap !== bp) return ap - bp
    return (b.lastCheckedAt ?? 0) - (a.lastCheckedAt ?? 0)
  })

  const groups = groupByDate(scheduledUpcoming)
  const sortedEntries = getSortedGroupEntries(groups, scheduledUpcoming).map(
    ([dateLabel, items]) => [
      dateLabel,
      [...items].sort((a, b) => {
        // 1. お知らせ・お気に入りフラグ優先
        const af = a.isNotify || a.isFavorite ? 0 : 1
        const bf = b.isNotify || b.isFavorite ? 0 : 1
        if (af !== bf) return af - bf
        // 2. ピン済みチャンネル優先
        const ap = pinnedChannelIds.has(a.channelId) ? 0 : 1
        const bp = pinnedChannelIds.has(b.channelId) ? 0 : 1
        if (ap !== bp) return ap - bp
        // 3. 開始時刻昇順
        return (a.scheduledStartTime ?? 0) - (b.scheduledStartTime ?? 0)
      })
    ]
  )

  const navItems = [
    ...(live.length > 0 ? [{ label: 'ライブ配信中', id: 'section-live', isLive: true }] : []),
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
  onToggleWatch: PropTypes.func,
  onToggleFavorite: PropTypes.func,
  onTogglePin: PropTypes.func
}

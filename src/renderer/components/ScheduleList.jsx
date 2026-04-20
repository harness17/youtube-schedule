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
  onToggleFavorite
}) {
  const isEmpty = live.length === 0 && upcoming.length === 0

  if (isEmpty) {
    return (
      <div style={{ textAlign: 'center', color: darkMode ? '#888' : '#888', marginTop: '48px' }}>
        予定された配信はありません
      </div>
    )
  }

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

  const navBg = darkMode ? '#2a2a2e' : '#fff'
  const navBtnBg = darkMode ? '#3a3a3e' : '#f0f0f0'
  const navBtnColor = darkMode ? '#ccc' : '#333'
  const headingColor = darkMode ? '#f0f0f0' : '#333'
  const dividerColor = darkMode ? '#444' : '#ccc'

  return (
    <div>
      {navItems.length > 1 && (
        <nav
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '20px',
            padding: '10px 12px',
            background: navBg,
            borderRadius: '8px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
          }}
        >
          {navItems.map(({ label, id, isLive }) => (
            <button
              key={id}
              onClick={() => scrollToSection(id)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                background: isLive ? '#FF0000' : navBtnBg,
                color: isLive ? '#fff' : navBtnColor,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      {live.length > 0 && (
        <div id="section-live" style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#FF0000',
              padding: '4px 0',
              marginBottom: '8px',
              borderBottom: '2px solid #FF0000'
            }}
          >
            ライブ配信中
          </h2>
          {live.map((item) => (
            <ScheduleCard
              key={item.id}
              item={item}
              darkMode={darkMode}
              watched={item.isNotify}
              isPinned={pinnedChannelIds.has(item.channelId)}
              onToggleWatch={onToggleWatch}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}

      {sortedEntries.map(([dateLabel, groupItems]) => (
        <div key={dateLabel} id={toAnchorId(dateLabel)} style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: headingColor,
              padding: '4px 0',
              marginBottom: '8px',
              borderBottom: `2px solid ${dividerColor}`
            }}
          >
            {dateLabel}
          </h2>
          {groupItems.map((item) => (
            <ScheduleCard
              key={item.id}
              item={item}
              darkMode={darkMode}
              watched={item.isNotify}
              isPinned={pinnedChannelIds.has(item.channelId)}
              onToggleWatch={onToggleWatch}
              onToggleFavorite={onToggleFavorite}
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
  onToggleFavorite: PropTypes.func
}

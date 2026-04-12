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
  // items は scheduledStartTime 昇順でソート済みなので、
  // 最初に出現した順でグループキーを並べる
  const seen = []
  for (const item of items) {
    const key = getDateKey(item.scheduledStartTime)
    if (!seen.includes(key)) seen.push(key)
  }
  return seen.map((key) => [key, groups[key]])
}

export default function ScheduleList({ live = [], upcoming = [] }) {
  const isEmpty = live.length === 0 && upcoming.length === 0

  if (isEmpty) {
    return (
      <div style={{ textAlign: 'center', color: '#888', marginTop: '48px' }}>
        予定された配信はありません
      </div>
    )
  }

  const groups = groupByDate(upcoming)
  const sortedEntries = getSortedGroupEntries(groups, upcoming)

  return (
    <div>
      {live.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
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
            <ScheduleCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {sortedEntries.map(([dateLabel, groupItems]) => (
        <div key={dateLabel} style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#333',
              padding: '4px 0',
              marginBottom: '8px',
              borderBottom: '2px solid #ccc'
            }}
          >
            {dateLabel}
          </h2>
          {groupItems.map((item) => (
            <ScheduleCard key={item.id} item={item} />
          ))}
        </div>
      ))}
    </div>
  )
}

ScheduleList.propTypes = {
  live: PropTypes.array,
  upcoming: PropTypes.array
}

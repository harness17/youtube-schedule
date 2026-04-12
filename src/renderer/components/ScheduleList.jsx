import ScheduleCard from './ScheduleCard.jsx'

function groupByDate(items) {
  const groups = {}
  for (const item of items) {
    const date = new Date(item.scheduledStartTime)
    const key = date.toLocaleDateString('ja-JP', {
      month: 'long', day: 'numeric', weekday: 'short',
      timeZone: 'UTC',
    })
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return groups
}

export default function ScheduleList({ live, upcoming }) {
  const isEmpty = live.length === 0 && upcoming.length === 0

  if (isEmpty) {
    return (
      <div style={{ textAlign: 'center', color: '#888', marginTop: '48px' }}>
        予定された配信はありません
      </div>
    )
  }

  const groups = groupByDate(upcoming)

  return (
    <div>
      {live.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{
            fontSize: '14px', fontWeight: 'bold', color: '#FF0000',
            padding: '4px 0', marginBottom: '8px',
            borderBottom: '2px solid #FF0000',
          }}>
            ライブ配信中
          </h2>
          {live.map((item) => (
            <ScheduleCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {Object.entries(groups).map(([dateLabel, groupItems]) => (
        <div key={dateLabel} style={{ marginBottom: '24px' }}>
          <h2 style={{
            fontSize: '14px', fontWeight: 'bold', color: '#333',
            padding: '4px 0', marginBottom: '8px',
            borderBottom: '2px solid #ccc',
          }}>
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

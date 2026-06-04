import PropTypes from 'prop-types'
import TabCard from './TabCard.jsx'

export default function AppTabMissed({
  tabLoading,
  filteredMissed,
  hasMissed,
  searchQuery,
  selectedChannel,
  subColor,
  missedSections,
  cardCtx
}) {
  if (tabLoading) {
    return (
      <div style={{ textAlign: 'center', color: subColor, marginTop: '48px' }}>読み込み中...</div>
    )
  }

  if (filteredMissed.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: subColor, marginTop: '48px' }}>
        {(searchQuery.trim() || selectedChannel !== 'all') && hasMissed
          ? selectedChannel !== 'all' && !searchQuery.trim()
            ? 'このチャンネルの配信はありません'
            : '検索結果がありません'
          : '見逃した配信はありません 🎉'}
      </div>
    )
  }

  const { upcomingMissed, endedMissed } = missedSections

  return (
    <>
      {upcomingMissed.length > 0 && (
        <>
          <div id="missed-upcoming" className="yt-section-label" style={{ color: subColor }}>
            📅 予定・配信中
          </div>
          {upcomingMissed.map((item) => (
            <TabCard
              key={item.id}
              item={item}
              cardCtx={cardCtx}
              extraProps={{ showStatusBadge: true, showViewedButton: false }}
            />
          ))}
        </>
      )}
      {endedMissed.length > 0 && (
        <>
          <div
            id="missed-ended"
            className="yt-section-label"
            style={{ color: subColor, marginTop: upcomingMissed.length > 0 ? '16px' : 0 }}
          >
            📋 見逃し
          </div>
          {endedMissed.map((item) => (
            <TabCard
              key={item.id}
              item={item}
              cardCtx={cardCtx}
              extraProps={{ showStatusBadge: false, showViewedButton: true }}
            />
          ))}
        </>
      )}
    </>
  )
}

AppTabMissed.propTypes = {
  tabLoading: PropTypes.bool.isRequired,
  filteredMissed: PropTypes.arrayOf(PropTypes.object).isRequired,
  hasMissed: PropTypes.bool.isRequired,
  searchQuery: PropTypes.string.isRequired,
  selectedChannel: PropTypes.string.isRequired,
  subColor: PropTypes.string.isRequired,
  missedSections: PropTypes.shape({
    upcomingMissed: PropTypes.arrayOf(PropTypes.object).isRequired,
    endedMissed: PropTypes.arrayOf(PropTypes.object).isRequired
  }).isRequired,
  cardCtx: PropTypes.object.isRequired
}

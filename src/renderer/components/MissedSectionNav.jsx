import PropTypes from 'prop-types'

export default function MissedSectionNav({ filteredMissed, missedSections }) {
  if (filteredMissed.length === 0) return null

  const { upcomingMissed, endedMissed } = missedSections
  if (upcomingMissed.length === 0 || endedMissed.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: '4px', paddingTop: '4px', flexShrink: 0 }}>
      <button
        className="yt-nav-btn"
        onClick={() =>
          document
            .getElementById('missed-upcoming')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      >
        📅 予定・配信中
      </button>
      <button
        className="yt-nav-btn"
        onClick={() =>
          document
            .getElementById('missed-ended')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      >
        📋 見逃し
      </button>
    </div>
  )
}

MissedSectionNav.propTypes = {
  filteredMissed: PropTypes.arrayOf(PropTypes.object).isRequired,
  missedSections: PropTypes.shape({
    upcomingMissed: PropTypes.arrayOf(PropTypes.object).isRequired,
    endedMissed: PropTypes.arrayOf(PropTypes.object).isRequired
  }).isRequired
}

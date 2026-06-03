import PropTypes from 'prop-types'

export default function FavoritesSectionNav({ filteredFavorites, favoriteSections }) {
  if (filteredFavorites.length === 0) return null

  const { normalFavs, upcomingFavs, viewedFavs } = favoriteSections
  const sectionCount = [normalFavs, upcomingFavs, viewedFavs].filter((s) => s.length > 0).length
  if (sectionCount < 2) return null

  return (
    <div style={{ display: 'flex', gap: '4px', paddingTop: '4px', flexShrink: 0 }}>
      {upcomingFavs.length > 0 && (
        <button
          className="yt-nav-btn"
          onClick={() =>
            document
              .getElementById('fav-upcoming')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          📅 予定・配信中
        </button>
      )}
      {normalFavs.length > 0 && (
        <button
          className="yt-nav-btn"
          onClick={() =>
            document
              .getElementById('fav-normal')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          📋 通常
        </button>
      )}
      {viewedFavs.length > 0 && (
        <button
          className="yt-nav-btn"
          onClick={() =>
            document
              .getElementById('fav-viewed')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          ✅ 視聴済み
        </button>
      )}
    </div>
  )
}

FavoritesSectionNav.propTypes = {
  filteredFavorites: PropTypes.arrayOf(PropTypes.object).isRequired,
  favoriteSections: PropTypes.shape({
    normalFavs: PropTypes.arrayOf(PropTypes.object).isRequired,
    upcomingFavs: PropTypes.arrayOf(PropTypes.object).isRequired,
    viewedFavs: PropTypes.arrayOf(PropTypes.object).isRequired
  }).isRequired
}

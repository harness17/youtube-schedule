import PropTypes from 'prop-types'
import { FavoriteSection } from './TabCard.jsx'

export default function AppTabFavorites({
  tabLoading,
  filteredFavorites,
  hasFavorites,
  searchQuery,
  selectedChannel,
  subColor,
  favoriteSections,
  favoriteCardCtx,
  sensors,
  reorderFavorites
}) {
  if (tabLoading) {
    return (
      <div style={{ textAlign: 'center', color: subColor, marginTop: '48px' }}>読み込み中...</div>
    )
  }

  if (filteredFavorites.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: subColor, marginTop: '48px' }}>
        {(searchQuery.trim() || selectedChannel !== 'all') && hasFavorites
          ? selectedChannel !== 'all' && !searchQuery.trim()
            ? 'このチャンネルの配信はありません'
            : '検索結果がありません'
          : 'お気に入りはまだありません'}
      </div>
    )
  }

  const { normalFavs, upcomingFavs, viewedFavs } = favoriteSections
  const hasAbove = (i) => [upcomingFavs, normalFavs].slice(0, i).some((s) => s.length > 0)

  return (
    <>
      {upcomingFavs.length > 0 && (
        <>
          <div id="fav-upcoming" className="yt-section-label" style={{ color: subColor }}>
            📅 予定・配信中
          </div>
          <FavoriteSection
            sectionItems={upcomingFavs}
            cardCtx={favoriteCardCtx}
            sensors={sensors}
            onDragEnd={({ active, over }) => {
              if (over && active.id !== over.id) {
                reorderFavorites(
                  active.id,
                  over.id,
                  upcomingFavs.map((v) => v.id)
                )
              }
            }}
          />
        </>
      )}
      {normalFavs.length > 0 && (
        <>
          <div
            id="fav-normal"
            className="yt-section-label"
            style={{ color: subColor, marginTop: hasAbove(1) ? '16px' : 0 }}
          >
            📋 通常
          </div>
          <FavoriteSection
            sectionItems={normalFavs}
            cardCtx={favoriteCardCtx}
            sensors={sensors}
            onDragEnd={({ active, over }) => {
              if (over && active.id !== over.id) {
                reorderFavorites(
                  active.id,
                  over.id,
                  normalFavs.map((v) => v.id)
                )
              }
            }}
          />
        </>
      )}
      {viewedFavs.length > 0 && (
        <>
          <div
            id="fav-viewed"
            className="yt-section-label"
            style={{ color: subColor, marginTop: hasAbove(2) ? '16px' : 0 }}
          >
            ✅ 視聴済み
          </div>
          <FavoriteSection
            sectionItems={viewedFavs}
            cardCtx={favoriteCardCtx}
            sensors={sensors}
            onDragEnd={({ active, over }) => {
              if (over && active.id !== over.id) {
                reorderFavorites(
                  active.id,
                  over.id,
                  viewedFavs.map((v) => v.id)
                )
              }
            }}
          />
        </>
      )}
    </>
  )
}

AppTabFavorites.propTypes = {
  tabLoading: PropTypes.bool.isRequired,
  filteredFavorites: PropTypes.arrayOf(PropTypes.object).isRequired,
  hasFavorites: PropTypes.bool.isRequired,
  searchQuery: PropTypes.string.isRequired,
  selectedChannel: PropTypes.string.isRequired,
  subColor: PropTypes.string.isRequired,
  favoriteSections: PropTypes.shape({
    upcomingFavs: PropTypes.arrayOf(PropTypes.object).isRequired,
    normalFavs: PropTypes.arrayOf(PropTypes.object).isRequired,
    viewedFavs: PropTypes.arrayOf(PropTypes.object).isRequired
  }).isRequired,
  favoriteCardCtx: PropTypes.object.isRequired,
  sensors: PropTypes.object.isRequired,
  reorderFavorites: PropTypes.func.isRequired
}

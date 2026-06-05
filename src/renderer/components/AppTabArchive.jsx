import PropTypes from 'prop-types'
import TabCard from './TabCard.jsx'

export default function AppTabArchive({
  filteredArchive,
  tabLoading,
  archiveHasMore,
  archiveLoadingMore,
  archiveSentinelRef,
  archiveHasActiveFilters,
  searchQuery,
  subColor,
  cardCtx
}) {
  if (tabLoading) {
    return (
      <div style={{ textAlign: 'center', color: subColor, marginTop: '32px' }}>読み込み中...</div>
    )
  }

  if (filteredArchive.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: subColor, marginTop: '32px' }}>
        {archiveHasActiveFilters && !searchQuery.trim()
          ? '条件に一致するアーカイブはありません'
          : searchQuery.trim() || archiveHasActiveFilters
            ? '検索結果がありません'
            : 'アーカイブがありません'}
      </div>
    )
  }

  return (
    <>
      {filteredArchive.map((item) => (
        <TabCard key={item.id} item={item} cardCtx={cardCtx} />
      ))}
      {archiveHasMore && <div ref={archiveSentinelRef} style={{ height: '1px' }} />}
      {archiveLoadingMore && (
        <div style={{ textAlign: 'center', color: subColor, padding: '16px' }}>読み込み中...</div>
      )}
      {!archiveHasMore && filteredArchive.length > 0 && (
        <div
          style={{
            textAlign: 'center',
            color: subColor,
            fontSize: '12px',
            padding: '16px'
          }}
        >
          すべて表示しました
        </div>
      )}
    </>
  )
}

AppTabArchive.propTypes = {
  filteredArchive: PropTypes.arrayOf(PropTypes.object).isRequired,
  tabLoading: PropTypes.bool.isRequired,
  archiveHasMore: PropTypes.bool.isRequired,
  archiveLoadingMore: PropTypes.bool.isRequired,
  archiveSentinelRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) })
  ]).isRequired,
  archiveHasActiveFilters: PropTypes.bool.isRequired,
  searchQuery: PropTypes.string.isRequired,
  subColor: PropTypes.string.isRequired,
  cardCtx: PropTypes.object.isRequired
}

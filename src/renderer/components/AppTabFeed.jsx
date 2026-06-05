import PropTypes from 'prop-types'
import SimpleModeBanner from './SimpleModeBanner.jsx'
import SimpleModeEmptyScreen from './SimpleModeEmptyScreen.jsx'
import TabCard from './TabCard.jsx'

export default function AppTabFeed({
  feedVideos,
  allDbChannels,
  loading,
  darkMode,
  subColor,
  onOpenSettings,
  cardCtx
}) {
  return (
    <>
      {allDbChannels.length > 0 && (
        <SimpleModeBanner darkMode={darkMode} onOpenSettings={() => onOpenSettings('connection')} />
      )}
      {loading ? (
        <div style={{ textAlign: 'center', color: subColor, marginTop: '48px' }}>読み込み中...</div>
      ) : allDbChannels.length === 0 ? (
        <SimpleModeEmptyScreen
          darkMode={darkMode}
          onOpenSettings={() => onOpenSettings('channels')}
        />
      ) : feedVideos.length === 0 ? (
        <div style={{ textAlign: 'center', color: subColor, marginTop: '48px' }}>
          新着動画はまだありません
        </div>
      ) : (
        feedVideos.map((item) => (
          <TabCard
            key={item.id}
            item={item}
            cardCtx={cardCtx}
            extraProps={{
              showStatusBadge: false,
              showViewedButton: false,
              onFilterChannel: undefined
            }}
          />
        ))
      )}
    </>
  )
}

AppTabFeed.propTypes = {
  feedVideos: PropTypes.arrayOf(PropTypes.object).isRequired,
  allDbChannels: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  darkMode: PropTypes.bool.isRequired,
  subColor: PropTypes.string.isRequired,
  onOpenSettings: PropTypes.func.isRequired,
  cardCtx: PropTypes.object.isRequired
}

import PropTypes from 'prop-types'

export default function UpdateBanner({ status, onInstall }) {
  if (!status) return null
  const isDownloading = status === 'downloading'
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2000,
        background: isDownloading ? '#555' : '#1a73e8',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '8px 16px',
        fontSize: '13px'
      }}
    >
      {isDownloading ? (
        <span>更新をダウンロード中...</span>
      ) : (
        <>
          <span>新しいバージョンの準備ができました</span>
          <button
            onClick={onInstall}
            style={{
              padding: '4px 14px',
              background: '#fff',
              color: '#1a73e8',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '12px'
            }}
          >
            再起動して更新
          </button>
        </>
      )}
    </div>
  )
}

UpdateBanner.propTypes = {
  status: PropTypes.oneOf(['downloading', 'ready', null]),
  onInstall: PropTypes.func.isRequired
}

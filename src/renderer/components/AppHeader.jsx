import PropTypes from 'prop-types'
import youtomLogo from '../src/assets/youtom-logo.svg'

export default function AppHeader({
  appVersion,
  isAuthenticated,
  loading,
  textColor,
  subColor,
  onRefresh,
  onOpenSettings
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '10px',
        flexWrap: 'wrap'
      }}
    >
      <div className="yt-brand" style={{ flex: 1 }}>
        <img src={youtomLogo} alt="" className="yt-brand-logo" />
        <div>
          <h1 className="yt-display yt-brand-title" style={{ color: textColor }}>
            Youtom
            {appVersion && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 'normal',
                  color: subColor,
                  fontFamily: 'inherit',
                  letterSpacing: 0
                }}
              >
                v{appVersion}
              </span>
            )}
          </h1>
          <div className="yt-brand-subtitle" style={{ color: subColor }}>
            YouTube 配信予定ビューア
          </div>
        </div>
      </div>
      <span
        onClick={!isAuthenticated ? () => onOpenSettings('connection') : undefined}
        className={`yt-header-mode${isAuthenticated ? ' yt-header-mode--auth' : ' yt-header-mode--clickable'}`}
      >
        {isAuthenticated ? 'フルモード' : '簡易モード'}
      </span>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="yt-header-btn yt-header-btn--refresh"
      >
        {loading ? '更新中...' : '↺ 更新'}
      </button>
      <button
        onClick={() => onOpenSettings('display')}
        title="設定"
        className="yt-header-btn yt-header-btn--icon"
      >
        ⚙️
      </button>
    </div>
  )
}

AppHeader.propTypes = {
  appVersion: PropTypes.string,
  isAuthenticated: PropTypes.bool.isRequired,
  loading: PropTypes.bool.isRequired,
  textColor: PropTypes.string.isRequired,
  subColor: PropTypes.string.isRequired,
  onRefresh: PropTypes.func.isRequired,
  onOpenSettings: PropTypes.func.isRequired
}

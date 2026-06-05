import PropTypes from 'prop-types'

export default function SettingsTabAbout({
  darkMode,
  appVersion,
  autoDownload,
  updateChecking,
  styles,
  onCheckUpdate,
  onAutoDownloadToggle,
  onOpenExternal
}) {
  const { textColor, subColor, rowStyle, btnStyle, descStyle, sectionLabelStyle } = styles

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <div style={sectionLabelStyle}>アップデート確認</div>
        <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: textColor, fontSize: '13px' }}>最新バージョンを確認する</div>
            <div style={descStyle}>
              現在: v{appVersion}
              {updateChecking ? '　確認中...' : ''}
            </div>
          </div>
          <button
            style={btnStyle('primary', { disabled: updateChecking })}
            onClick={onCheckUpdate}
            disabled={updateChecking}
          >
            🔍 今すぐ確認
          </button>
        </div>
      </div>
      <div>
        <div style={sectionLabelStyle}>自動アップデート</div>
        <div style={rowStyle}>
          <div>
            <div style={{ color: textColor, fontSize: '13px' }}>起動時に自動でダウンロード</div>
            <div style={descStyle}>
              新しいバージョンが見つかると自動でダウンロードします
              <br />
              <span style={{ color: darkMode ? '#5555a0' : '#aaaacc' }}>
                ※ 変更は次回起動時に反映されます
              </span>
            </div>
          </div>
          <button
            onClick={onAutoDownloadToggle}
            style={{
              padding: '4px 14px',
              fontSize: '11px',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: autoDownload ? '#6060c0' : '#ddd',
              color: autoDownload ? 'white' : '#666'
            }}
          >
            {autoDownload ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      <div>
        <div style={sectionLabelStyle}>バージョン情報</div>
        <div style={{ ...rowStyle, flexDirection: 'column', gap: '4px' }}>
          {[
            ['アプリ名', 'Youtom'],
            ['説明', 'YouTube 配信予定ビューア'],
            ['バージョン', `v${appVersion}`]
          ].map(([label, value]) => (
            <div
              key={label}
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}
            >
              <span style={{ color: subColor }}>{label}</span>
              <span style={{ color: textColor }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={sectionLabelStyle}>ライセンス</div>
        <div style={{ ...rowStyle, flexDirection: 'column', gap: '2px' }}>
          <div style={{ color: textColor, fontSize: '13px' }}>MIT License</div>
          <div style={descStyle}>Copyright © 2026 harness17</div>
        </div>
      </div>
      <div>
        <div style={sectionLabelStyle}>リンク</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            style={btnStyle('secondary')}
            onClick={() => onOpenExternal('https://github.com/harness17/youtube-schedule')}
          >
            GitHub ↗
          </button>
          <button
            style={btnStyle('secondary')}
            onClick={() => onOpenExternal('https://github.com/harness17/youtube-schedule/issues')}
          >
            バグ報告 ↗
          </button>
        </div>
      </div>
    </div>
  )
}

const stylesPropType = PropTypes.shape({
  textColor: PropTypes.string.isRequired,
  subColor: PropTypes.string.isRequired,
  rowStyle: PropTypes.object.isRequired,
  btnStyle: PropTypes.func.isRequired,
  descStyle: PropTypes.object.isRequired,
  sectionLabelStyle: PropTypes.object.isRequired
})

SettingsTabAbout.propTypes = {
  darkMode: PropTypes.bool.isRequired,
  appVersion: PropTypes.string.isRequired,
  autoDownload: PropTypes.bool.isRequired,
  updateChecking: PropTypes.bool.isRequired,
  styles: stylesPropType.isRequired,
  onCheckUpdate: PropTypes.func.isRequired,
  onAutoDownloadToggle: PropTypes.func.isRequired,
  onOpenExternal: PropTypes.func.isRequired
}

import PropTypes from 'prop-types'

export default function SettingsTabDisplay({
  darkMode,
  reminderMinutes,
  hideMembershipVideos,
  styles,
  onDarkModeChange,
  onReminderMinutesChange,
  onHideMembershipVideosChange
}) {
  const { textColor, subColor, bgColor, inputBorder, sectionLabelStyle, rowStyle, descStyle } =
    styles

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <div style={sectionLabelStyle}>テーマ</div>
        <div style={rowStyle}>
          <div>
            <div style={{ color: textColor, fontSize: '13px' }}>ダークモード</div>
            <div style={descStyle}>画面の配色を暗くします</div>
          </div>
          <button
            onClick={() => onDarkModeChange(!darkMode)}
            style={{
              padding: '4px 14px',
              fontSize: '11px',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: darkMode ? '#6060c0' : '#ddd',
              color: darkMode ? 'white' : '#666'
            }}
          >
            {darkMode ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      <div>
        <div style={sectionLabelStyle}>通知</div>
        <div style={rowStyle}>
          <div>
            <div style={{ color: textColor, fontSize: '13px' }}>配信開始前の通知</div>
            <div style={descStyle}>🔔 登録した配信の何分前に通知するかを指定します</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input
              type="number"
              min="1"
              max="1440"
              step="1"
              value={reminderMinutes}
              onChange={(e) => onReminderMinutesChange(e.target.value)}
              style={{
                width: '72px',
                padding: '6px 8px',
                fontSize: '12px',
                background: bgColor,
                color: textColor,
                border: `1px solid ${inputBorder}`,
                borderRadius: '6px',
                outline: 'none',
                fontFamily: 'inherit',
                textAlign: 'right'
              }}
            />
            <span style={{ color: subColor, fontSize: '12px' }}>分前</span>
          </div>
        </div>
      </div>
      <div>
        <div style={sectionLabelStyle}>メンバー限定動画</div>
        <div style={rowStyle}>
          <div>
            <div style={{ color: textColor, fontSize: '13px' }}>メン限動画を一覧に表示しない</div>
            <div style={descStyle}>
              🔒 メンバー限定の動画を予定・見逃し・アーカイブ・お気に入りから隠します
            </div>
          </div>
          <button
            onClick={() => onHideMembershipVideosChange?.(!hideMembershipVideos)}
            style={{
              padding: '4px 14px',
              fontSize: '11px',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: hideMembershipVideos ? '#6060c0' : '#ddd',
              color: hideMembershipVideos ? 'white' : '#666'
            }}
          >
            {hideMembershipVideos ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </div>
  )
}

const stylesPropType = PropTypes.shape({
  textColor: PropTypes.string.isRequired,
  subColor: PropTypes.string.isRequired,
  bgColor: PropTypes.string.isRequired,
  inputBorder: PropTypes.string.isRequired,
  sectionLabelStyle: PropTypes.object.isRequired,
  rowStyle: PropTypes.object.isRequired,
  descStyle: PropTypes.object.isRequired
})

SettingsTabDisplay.propTypes = {
  darkMode: PropTypes.bool.isRequired,
  reminderMinutes: PropTypes.number.isRequired,
  hideMembershipVideos: PropTypes.bool.isRequired,
  styles: stylesPropType.isRequired,
  onDarkModeChange: PropTypes.func.isRequired,
  onReminderMinutesChange: PropTypes.func.isRequired,
  onHideMembershipVideosChange: PropTypes.func
}

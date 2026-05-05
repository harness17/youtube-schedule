import PropTypes from 'prop-types'

export default function SimpleModeEmptyScreen({ darkMode = false, onOpenSettings }) {
  const textColor = darkMode ? '#e8e8f0' : '#111120'
  const subColor = darkMode ? '#7878a0' : '#6060a0'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        gap: '16px',
        textAlign: 'center',
        padding: '32px'
      }}
    >
      <div style={{ fontSize: '48px' }}>📡</div>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: textColor, margin: 0 }}>
        チャンネルを追加しよう
      </h2>
      <p style={{ fontSize: '14px', color: subColor, margin: 0 }}>
        登録チャンネルの新着動画がここに表示されます
      </p>
      <button
        onClick={onOpenSettings}
        style={{
          padding: '10px 20px',
          background: darkMode ? 'rgba(255,34,68,0.18)' : 'rgba(220,0,20,0.1)',
          color: darkMode ? '#ff4466' : '#cc001a',
          border: `1px solid ${darkMode ? 'rgba(255,34,68,0.4)' : 'rgba(220,0,20,0.3)'}`,
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: '600',
          fontFamily: 'inherit'
        }}
      >
        ⚙️ チャンネルを追加する
      </button>
    </div>
  )
}

SimpleModeEmptyScreen.propTypes = {
  darkMode: PropTypes.bool,
  onOpenSettings: PropTypes.func.isRequired
}

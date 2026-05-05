import PropTypes from 'prop-types'

export default function SimpleModeBanner({ darkMode = false, onOpenSettings }) {
  const bg = darkMode ? 'rgba(255,200,50,0.08)' : 'rgba(200,150,0,0.06)'
  const color = darkMode ? '#c0a840' : '#7a6000'
  const border = darkMode ? 'rgba(200,160,50,0.2)' : 'rgba(180,140,0,0.15)'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: '6px',
        marginBottom: '12px',
        fontSize: '12px',
        color
      }}
    >
      <span>📅 配信予定時刻・ライブ検出はフルモードで</span>
      <button
        onClick={onOpenSettings}
        style={{
          marginLeft: 'auto',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '12px',
          color,
          fontFamily: 'inherit',
          fontWeight: '600',
          padding: '0 4px'
        }}
      >
        有効にする →
      </button>
    </div>
  )
}

SimpleModeBanner.propTypes = {
  darkMode: PropTypes.bool,
  onOpenSettings: PropTypes.func.isRequired
}

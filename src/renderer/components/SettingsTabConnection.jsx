import PropTypes from 'prop-types'

export default function SettingsTabConnection({
  darkMode,
  isAuthenticated,
  credentialsMissing,
  credentialsPath,
  authError,
  styles,
  onImportCredentials,
  onLogin,
  onLogout,
  onOpenExternal
}) {
  const {
    textColor,
    subColor,
    inputBorder,
    subBtnBg,
    rowStyle,
    btnStyle,
    descStyle,
    sectionLabelStyle
  } = styles

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <div style={sectionLabelStyle}>動作モード</div>
        <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: textColor, fontSize: '13px' }}>
              {isAuthenticated ? 'フルモードで動作中' : '簡易モードで動作中'}
            </div>
            <div style={descStyle}>
              簡易モードはOAuthなしで手動追加チャンネルをRSS取得します。フルモードはGoogle連携で登録チャンネルを同期します。
            </div>
            <button
              onClick={() =>
                onOpenExternal(
                  'https://github.com/harness17/youtube-schedule#3-%E3%83%95%E3%83%AB%E3%83%A2%E3%83%BC%E3%83%89%E3%81%A7%E4%BD%BF%E3%81%86%E4%BB%BB%E6%84%8F'
                )
              }
              style={{
                marginTop: '6px',
                padding: 0,
                background: 'none',
                border: 'none',
                color: darkMode ? '#8aa8ff' : '#1a73e8',
                cursor: 'pointer',
                fontSize: '11px',
                fontFamily: 'inherit',
                textDecoration: 'underline'
              }}
            >
              簡易モード / フルモードの違いとGoogle認証の注意点を見る ↗
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
            {(() => {
              // credentials.json の状態を3段階でバッジ表示。詳細エラーは別行に折り返す
              let label, color, bg, border, dot
              if (credentialsMissing) {
                label = 'credentials.json: 未配置'
                color = subColor
                bg = subBtnBg
                border = inputBorder
                dot = '○'
              } else if (authError) {
                label = 'credentials.json: 読み込みエラー'
                color = '#cc2222'
                bg = darkMode ? 'rgba(200,30,30,0.12)' : '#fff0f0'
                border = '#f0c0c0'
                dot = '⚠'
              } else {
                label = 'credentials.json: 読み込み済み'
                color = darkMode ? '#9ee6b8' : '#148a3b'
                bg = darkMode ? 'rgba(60,180,100,0.12)' : 'rgba(60,180,100,0.08)'
                border = darkMode ? 'rgba(60,180,100,0.35)' : 'rgba(60,180,100,0.25)'
                dot = '●'
              }
              return (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    color,
                    background: bg,
                    border: `1px solid ${border}`,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {dot} {label}
                </span>
              )
            })()}
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                color: isAuthenticated ? (darkMode ? '#9ee6b8' : '#148a3b') : subColor,
                background: isAuthenticated
                  ? darkMode
                    ? 'rgba(60,180,100,0.12)'
                    : 'rgba(60,180,100,0.08)'
                  : subBtnBg,
                border: `1px solid ${
                  isAuthenticated
                    ? darkMode
                      ? 'rgba(60,180,100,0.35)'
                      : 'rgba(60,180,100,0.25)'
                    : inputBorder
                }`,
                whiteSpace: 'nowrap'
              }}
            >
              {isAuthenticated ? '● Google連携: 認証済み' : '○ Google連携: 未認証'}
            </span>
          </div>
          {!credentialsMissing && authError && (
            <div
              style={{
                ...descStyle,
                color: '#cc2222',
                whiteSpace: 'normal',
                wordBreak: 'break-word'
              }}
            >
              {authError}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button style={btnStyle('secondary')} onClick={onImportCredentials}>
              credentials.json を読み込み
            </button>
            <button
              style={btnStyle('primary', { disabled: credentialsMissing || isAuthenticated })}
              onClick={onLogin}
              disabled={credentialsMissing || isAuthenticated}
            >
              Google連携
            </button>
          </div>
          {credentialsPath && (
            <div style={descStyle}>
              配置先: <code>{credentialsPath}</code>
            </div>
          )}
        </div>
      </div>
      <div>
        <div style={sectionLabelStyle}>アカウント</div>
        <div style={rowStyle}>
          <div>
            <div style={{ color: textColor, fontSize: '13px' }}>
              Google アカウントからログアウト
            </div>
            <div style={descStyle}>再ログインが必要になります</div>
          </div>
          <button
            style={btnStyle('danger', { disabled: !isAuthenticated })}
            disabled={!isAuthenticated}
            onClick={onLogout}
          >
            ログアウト
          </button>
        </div>
      </div>
    </div>
  )
}

const stylesPropType = PropTypes.shape({
  textColor: PropTypes.string.isRequired,
  subColor: PropTypes.string.isRequired,
  inputBorder: PropTypes.string.isRequired,
  subBtnBg: PropTypes.string.isRequired,
  rowStyle: PropTypes.object.isRequired,
  btnStyle: PropTypes.func.isRequired,
  descStyle: PropTypes.object.isRequired,
  sectionLabelStyle: PropTypes.object.isRequired
})

SettingsTabConnection.propTypes = {
  darkMode: PropTypes.bool.isRequired,
  isAuthenticated: PropTypes.bool.isRequired,
  credentialsMissing: PropTypes.bool.isRequired,
  credentialsPath: PropTypes.string,
  authError: PropTypes.string,
  styles: stylesPropType.isRequired,
  onImportCredentials: PropTypes.func.isRequired,
  onLogin: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  onOpenExternal: PropTypes.func.isRequired
}

import PropTypes from 'prop-types'

export default function SettingsTabData({
  styles,
  onExportSettings,
  onImportSettings,
  onExportFavorites,
  onImportFavorites,
  onResetDatabase
}) {
  const { textColor, rowStyle, btnStyle, descStyle, sectionLabelStyle } = styles

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <div style={sectionLabelStyle}>設定のエクスポート / インポート</div>
        <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: textColor, fontSize: '13px' }}>
              アプリ設定を JSON で保存・読み込み
            </div>
            <div style={descStyle}>含まれる内容: 優先チャンネル（📌）・テーマ設定</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={btnStyle('primary')} onClick={onExportSettings}>
              ⬇ エクスポート
            </button>
            <button style={btnStyle('secondary')} onClick={onImportSettings}>
              ⬆ インポート
            </button>
          </div>
        </div>
      </div>
      <div>
        <div style={sectionLabelStyle}>お気に入りのエクスポート / インポート</div>
        <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: textColor, fontSize: '13px' }}>
              ⭐ お気に入り動画を JSON で保存・復元
            </div>
            <div style={descStyle}>
              動画IDとタイトルを保存。件数が多い場合はファイルサイズに注意
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={btnStyle('primary')} onClick={onExportFavorites}>
              ⬇ エクスポート
            </button>
            <button style={btnStyle('secondary')} onClick={onImportFavorites}>
              ⬆ インポート
            </button>
          </div>
        </div>
      </div>
      <div>
        <div style={sectionLabelStyle}>データベース</div>
        <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: textColor, fontSize: '13px' }}>⚠️ データベースをリセット</div>
            <div style={descStyle}>
              すべての動画・チャンネルデータが削除されます（設定は残ります）
            </div>
          </div>
          <button style={btnStyle('danger')} onClick={onResetDatabase}>
            🗑 リセット
          </button>
        </div>
      </div>
    </div>
  )
}

const stylesPropType = PropTypes.shape({
  textColor: PropTypes.string.isRequired,
  rowStyle: PropTypes.object.isRequired,
  btnStyle: PropTypes.func.isRequired,
  descStyle: PropTypes.object.isRequired,
  sectionLabelStyle: PropTypes.object.isRequired
})

SettingsTabData.propTypes = {
  styles: stylesPropType.isRequired,
  onExportSettings: PropTypes.func.isRequired,
  onImportSettings: PropTypes.func.isRequired,
  onExportFavorites: PropTypes.func.isRequired,
  onImportFavorites: PropTypes.func.isRequired,
  onResetDatabase: PropTypes.func.isRequired
}

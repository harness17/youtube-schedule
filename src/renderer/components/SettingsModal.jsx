import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

const TABS = [
  { key: 'general', label: '⚙️ 基本' },
  { key: 'channels', label: '📌 チャンネル' },
  { key: 'data', label: '📦 データ管理' }
]

export default function SettingsModal({
  open,
  onClose,
  darkMode,
  onDarkModeChange,
  onLogout,
  onPinnedChannelsUpdated,
  onToast,
  appVersion
}) {
  const [activeTab, setActiveTab] = useState('general')
  const [autoDownload, setAutoDownload] = useState(true)
  const [updateChecking, setUpdateChecking] = useState(false)
  const [channelManagerQuery, setChannelManagerQuery] = useState('')
  const [channels, setChannels] = useState([])

  function sortChannels(list) {
    return [...list].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return (a.title ?? '').localeCompare(b.title ?? '', 'ja')
    })
  }

  useEffect(() => {
    if (!open) return
    window.api.getSetting('autoDownload', true).then(setAutoDownload)
    window.api.listAllChannels?.().then((chs) => {
      setChannels(sortChannels(chs ?? []))
    })
  }, [open])

  if (!open) return null

  const textColor = darkMode ? '#e8e8f0' : '#111120'
  const subColor = darkMode ? '#7878a0' : '#6060a0'
  const bgColor = darkMode ? '#16161e' : '#ffffff'
  const inputBg = darkMode ? '#1e1e28' : '#f4f4fb'
  const inputBorder = darkMode ? '#2a2a38' : '#dddde8'
  const subBtnBg = darkMode ? '#1e1e2c' : '#ebebf5'
  const subBtnColor = darkMode ? '#8888b0' : '#555570'

  const sectionLabelStyle = {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: subColor,
    fontWeight: 'bold',
    marginBottom: '6px'
  }
  const rowStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: inputBg,
    borderRadius: '8px',
    gap: '12px'
  }
  const btnStyle = (variant = 'primary') => ({
    padding: '7px 14px',
    fontSize: '12px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
    ...(variant === 'primary'
      ? { background: '#6060c0', color: 'white' }
      : variant === 'secondary'
        ? { background: subBtnBg, color: subBtnColor, border: `1px solid ${inputBorder}` }
        : {
            background: darkMode ? 'rgba(200,30,30,0.15)' : '#fff0f0',
            color: '#cc2222',
            border: '1px solid #f0c0c0'
          })
  })
  const descStyle = { fontSize: '11px', color: subColor, marginTop: '3px' }

  async function handleAutoDownloadToggle() {
    const next = !autoDownload
    setAutoDownload(next)
    await window.api.setSetting('autoDownload', next)
  }

  async function handleExportSettings() {
    const result = await window.api.exportSettings()
    if (result?.canceled) return
    if (result?.error) {
      onToast(`エクスポート失敗: ${result.error}`)
      return
    }
    onToast('設定をエクスポートしました')
  }

  async function handleImportSettings() {
    const result = await window.api.importSettings()
    if (result?.canceled) return
    if (result?.error) {
      onToast(`インポート失敗: ${result.error}`)
      return
    }
    if (result?.darkMode != null) onDarkModeChange(result.darkMode)
    onPinnedChannelsUpdated()
    onToast('設定を読み込みました')
  }

  async function handleExportFavorites() {
    const result = await window.api.exportFavorites()
    if (result?.canceled) return
    if (result?.error) {
      onToast(`エクスポート失敗: ${result.error}`)
      return
    }
    onToast(`お気に入りをエクスポートしました（${result.count}件）`)
  }

  async function handleImportFavorites() {
    const result = await window.api.importFavorites()
    if (result?.canceled) return
    if (result?.error) {
      onToast(`インポート失敗: ${result.error}`)
      return
    }
    onToast(
      `お気に入りを読み込みました（適用: ${result.applied}件 / スキップ: ${result.skipped}件）`
    )
  }

  async function handleCheckUpdate() {
    setUpdateChecking(true)
    await window.api.checkUpdateNow()
    setTimeout(() => setUpdateChecking(false), 3000)
  }

  async function handleTogglePin(channelId) {
    const nextValue = await window.api.togglePin?.(channelId)
    if (nextValue === null || nextValue === undefined) return

    setChannels((prev) =>
      sortChannels(
        prev.map((channel) =>
          channel.id === channelId ? { ...channel, isPinned: nextValue } : channel
        )
      )
    )
    onPinnedChannelsUpdated()
  }

  function renderGeneral() {
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
              style={btnStyle('primary')}
              onClick={handleCheckUpdate}
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
              onClick={handleAutoDownloadToggle}
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
              ['アプリ名', 'YouTube Schedule'],
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
              onClick={() =>
                window.api.openExternal('https://github.com/harness17/youtube-schedule')
              }
            >
              GitHub ↗
            </button>
            <button
              style={btnStyle('secondary')}
              onClick={() =>
                window.api.openExternal('https://github.com/harness17/youtube-schedule/issues')
              }
            >
              バグ報告 ↗
            </button>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${inputBorder}`, paddingTop: '14px' }}>
          <div style={sectionLabelStyle}>アカウント</div>
          <div style={rowStyle}>
            <div>
              <div style={{ color: textColor, fontSize: '13px' }}>
                Google アカウントからログアウト
              </div>
              <div style={descStyle}>再ログインが必要になります</div>
            </div>
            <button
              style={btnStyle('danger')}
              onClick={() => {
                onClose()
                onLogout()
              }}
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
    )
  }

  function renderChannels() {
    const filteredChannels = channels.filter(
      ({ title }) =>
        channelManagerQuery === '' ||
        (title ?? '').toLowerCase().includes(channelManagerQuery.toLowerCase())
    )

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={sectionLabelStyle}>優先チャンネル</div>
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
            <div>
              <div style={{ color: textColor, fontSize: '13px' }}>
                予定・ライブ一覧の上部に表示するチャンネルを管理
              </div>
              <div style={descStyle}>
                配信カードの 📌 ボタンと同じ設定です。ここからまとめて見直せます。
              </div>
            </div>
            <input
              type="text"
              placeholder="チャンネル名で絞り込み"
              value={channelManagerQuery}
              onChange={(e) => setChannelManagerQuery(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                background: inputBg,
                color: textColor,
                border: `1px solid ${inputBorder}`,
                borderRadius: '8px',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                maxHeight: '320px',
                overflowY: 'auto'
              }}
            >
              {filteredChannels.length > 0 ? (
                filteredChannels.map(({ id, title, isPinned }) => (
                  <div
                    key={id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '9px 10px',
                      background: isPinned
                        ? darkMode
                          ? 'rgba(255,201,64,0.08)'
                          : 'rgba(212,144,10,0.06)'
                        : bgColor,
                      border: `1px solid ${
                        isPinned
                          ? darkMode
                            ? 'rgba(255,201,64,0.24)'
                            : 'rgba(212,144,10,0.22)'
                          : inputBorder
                      }`,
                      borderRadius: '8px'
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: '13px',
                        color: isPinned ? (darkMode ? '#ffc940' : '#d4900a') : textColor,
                        fontWeight: isPinned ? '600' : 'normal',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={title}
                    >
                      {isPinned && <span style={{ marginRight: '5px' }}>📌</span>}
                      {title}
                    </div>
                    <button
                      onClick={() => handleTogglePin(id)}
                      title={isPinned ? '優先解除' : '優先に設定'}
                      style={{
                        ...btnStyle('secondary'),
                        padding: '5px 12px',
                        background: isPinned
                          ? darkMode
                            ? 'rgba(255,201,64,0.18)'
                            : 'rgba(212,144,10,0.12)'
                          : subBtnBg,
                        color: isPinned ? (darkMode ? '#ffc940' : '#d4900a') : subBtnColor,
                        border: `1px solid ${
                          isPinned
                            ? darkMode
                              ? 'rgba(255,201,64,0.4)'
                              : 'rgba(212,144,10,0.35)'
                            : inputBorder
                        }`,
                        fontWeight: isPinned ? '600' : 'normal'
                      }}
                    >
                      {isPinned ? '優先中' : '優先'}
                    </button>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: bgColor,
                    border: `1px dashed ${inputBorder}`,
                    color: subColor,
                    fontSize: '12px',
                    textAlign: 'center'
                  }}
                >
                  該当するチャンネルがありません
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderData() {
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
              <button style={btnStyle('primary')} onClick={handleExportSettings}>
                ⬇ エクスポート
              </button>
              <button style={btnStyle('secondary')} onClick={handleImportSettings}>
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
              <button style={btnStyle('primary')} onClick={handleExportFavorites}>
                ⬇ エクスポート
              </button>
              <button style={btnStyle('secondary')} onClick={handleImportFavorites}>
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
            <button
              style={btnStyle('danger')}
              onClick={async () => {
                if (!window.confirm('データベースをリセットしますか？この操作は取り消せません。')) {
                  return
                }
                await window.api.resetDatabase()
                onToast('データベースをリセットしました')
                onClose()
              }}
            >
              🗑 リセット
            </button>
          </div>
        </div>
      </div>
    )
  }

  const tabContent = {
    general: renderGeneral,
    channels: renderChannels,
    data: renderData
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: bgColor,
          color: textColor,
          borderRadius: '14px',
          width: '560px',
          maxWidth: '92vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          border: `1px solid ${inputBorder}`,
          boxShadow: darkMode ? '0 20px 60px rgba(0,0,0,0.7)' : '0 12px 40px rgba(0,0,0,0.15)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: `1px solid ${inputBorder}`,
            background: darkMode ? '#1a1a24' : '#f4f4f8'
          }}
        >
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: textColor }}>
            ⚙️ 設定
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: subBtnBg,
              border: `1px solid ${inputBorder}`,
              borderRadius: '7px',
              fontSize: '13px',
              cursor: 'pointer',
              color: subColor,
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))`,
            gap: '8px',
            padding: '10px 12px',
            borderBottom: `1px solid ${inputBorder}`,
            background: darkMode ? '#18181f' : '#fafafa',
            alignItems: 'stretch'
          }}
        >
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '10px 12px',
                minWidth: 0,
                fontSize: '12px',
                cursor: 'pointer',
                border: `1px solid ${
                  activeTab === key ? '#6060c0' : darkMode ? '#232331' : '#e4e4ef'
                }`,
                borderRadius: '9px',
                background: activeTab === key ? bgColor : darkMode ? '#1b1b25' : '#f4f4f8',
                color: activeTab === key ? '#6060c0' : subColor,
                fontWeight: activeTab === key ? 'bold' : 'normal',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                lineHeight: 1.2,
                boxShadow:
                  activeTab === key
                    ? darkMode
                      ? 'inset 0 0 0 1px rgba(96,96,192,0.15)'
                      : '0 1px 2px rgba(0,0,0,0.04)'
                    : 'none'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: '18px', overflowY: 'auto', flex: 1 }}>
          {tabContent[activeTab]?.()}
        </div>
      </div>
    </div>
  )
}

SettingsModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  darkMode: PropTypes.bool.isRequired,
  onDarkModeChange: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  onPinnedChannelsUpdated: PropTypes.func.isRequired,
  onToast: PropTypes.func.isRequired,
  appVersion: PropTypes.string.isRequired
}

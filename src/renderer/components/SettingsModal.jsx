import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import {
  SETTINGS_TAB_KEYS,
  SETTINGS_TABS,
  getSettingsChannelGroups,
  manualVideoErrorMessage,
  manualVideoSuccessMessage,
  sortSettingsChannels
} from '../src/settingsModalModel.js'

export default function SettingsModal({
  open,
  onClose,
  darkMode,
  onDarkModeChange,
  reminderMinutes,
  onReminderMinutesChange,
  onLogout,
  onPinnedChannelsUpdated,
  onChannelsUpdated,
  onToast,
  appVersion,
  isAuthenticated,
  credentialsMissing,
  credentialsPath,
  authError,
  onLogin,
  onImportCredentials,
  hideMembershipVideos = false,
  onHideMembershipVideosChange,
  initialTab = 'display',
  onSyncChannelsNow,
  isSyncingChannels = false
}) {
  const [activeTab, setActiveTab] = useState(initialTab)
  const [autoDownload, setAutoDownload] = useState(true)
  const [updateChecking, setUpdateChecking] = useState(false)
  const [channelManagerQuery, setChannelManagerQuery] = useState('')
  const [channels, setChannels] = useState([])
  const [manualChannelInput, setManualChannelInput] = useState('')
  const [manualChannelTitle, setManualChannelTitle] = useState('')
  const [manualChannelSaving, setManualChannelSaving] = useState(false)
  const [manualVideoInput, setManualVideoInput] = useState('')
  const [manualVideoSaving, setManualVideoSaving] = useState(false)
  const [manualVideoMessage, setManualVideoMessage] = useState(null)

  useEffect(() => {
    if (!open) return
    window.api.getSetting('autoDownload', true).then(setAutoDownload)
    window.api.listAllChannels?.().then((chs) => {
      setChannels(sortSettingsChannels(chs ?? []))
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
  const btnStyle = (variant = 'primary', { disabled = false } = {}) => ({
    padding: '7px 14px',
    fontSize: '12px',
    border: 'none',
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
    opacity: disabled ? 0.5 : 1,
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

    // sortChannels を呼ばずに isPinned だけ更新する。
    // モーダルを開いた時点のスナップショット順（優先中が上部）を維持するため、
    // トグルで並び替えが発生しないようにする
    setChannels((prev) =>
      prev.map((channel) =>
        channel.id === channelId ? { ...channel, isPinned: nextValue } : channel
      )
    )
    onPinnedChannelsUpdated()
  }

  async function reloadChannels() {
    const chs = await window.api.listAllChannels?.()
    setChannels(sortSettingsChannels(chs ?? []))
    onChannelsUpdated?.()
  }

  async function handleAddManualChannel() {
    setManualChannelSaving(true)
    const result = await window.api.addManualChannel?.({
      input: manualChannelInput,
      title: manualChannelTitle
    })
    setManualChannelSaving(false)
    if (result?.error) {
      onToast(`チャンネル追加失敗: ${result.error}`)
      return
    }
    setManualChannelInput('')
    setManualChannelTitle('')
    await reloadChannels()
    onToast('チャンネルを追加しました')
  }

  async function handleDeleteChannel(channelId, channelTitle) {
    if (!window.confirm(`「${channelTitle ?? channelId}」を一覧から削除しますか？`)) return
    const ok = await window.api.deleteChannel?.(channelId)
    if (!ok) {
      onToast('チャンネルの削除に失敗しました')
      return
    }
    await reloadChannels()
    onPinnedChannelsUpdated()
    onToast('チャンネルを削除しました')
  }

  async function handleImportCredentials() {
    const result = await onImportCredentials()
    if (result?.canceled) return
    if (result?.error) {
      onToast(`credentials.json の読み込み失敗: ${result.error}`)
      return
    }
    onToast('credentials.json を読み込みました')
  }

  async function handleLogin() {
    const result = await onLogin()
    if (result?.error) {
      onToast(`Google連携失敗: ${result.error}`)
    }
  }

  async function handleAddManualVideo() {
    const input = manualVideoInput.trim()
    if (!input || manualVideoSaving) return
    setManualVideoSaving(true)
    setManualVideoMessage(null)
    try {
      const result = await window.api.addManualVideo(input)
      if (result?.ok) {
        setManualVideoMessage({
          type: 'success',
          text: manualVideoSuccessMessage(result.video)
        })
        setManualVideoInput('')
        onChannelsUpdated?.()
      } else {
        setManualVideoMessage({ type: 'error', text: manualVideoErrorMessage(result?.error) })
      }
    } finally {
      setManualVideoSaving(false)
    }
  }

  function renderConnection() {
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
                  window.api.openExternal(
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
              <button style={btnStyle('secondary')} onClick={handleImportCredentials}>
                credentials.json を読み込み
              </button>
              <button
                style={btnStyle('primary', { disabled: credentialsMissing || isAuthenticated })}
                onClick={handleLogin}
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

  function renderDisplay() {
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

  // チャンネル1行。優先チャンネルリストと手動追加チャンネルリストで共有する。
  // showDelete=true のときだけ🗑削除ボタンを出す（手動追加チャンネル用）。
  function renderChannelRow(channel, showDelete) {
    const { id, title, isPinned } = channel
    return (
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
            isPinned ? (darkMode ? 'rgba(255,201,64,0.24)' : 'rgba(212,144,10,0.22)') : inputBorder
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
              isPinned ? (darkMode ? 'rgba(255,201,64,0.4)' : 'rgba(212,144,10,0.35)') : inputBorder
            }`,
            fontWeight: isPinned ? '600' : 'normal'
          }}
        >
          {isPinned ? '優先中' : '優先'}
        </button>
        {showDelete && (
          <button
            onClick={() => handleDeleteChannel(id, title)}
            title="一覧から削除"
            style={{ ...btnStyle('danger'), padding: '5px 10px' }}
          >
            🗑
          </button>
        )}
      </div>
    )
  }

  function renderChannels() {
    const { subscriptionChannels, manualChannels } = getSettingsChannelGroups(
      channels,
      channelManagerQuery
    )
    const listContainerStyle = {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      maxHeight: '320px',
      overflowY: 'auto'
    }
    const emptyBox = (text) => (
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
        {text}
      </div>
    )

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={sectionLabelStyle}>メン限動画の手動追加</div>
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
            <div>
              <div style={{ color: textColor, fontSize: '13px' }}>
                自動取得できない動画を追加して追跡
              </div>
              <div style={descStyle}>
                メンバー限定配信など、RSS・購読では取得できない動画を URL または動画 ID
                で追加できます。追加にはその動画を視聴できる Google
                アカウントでのログインが必要です。
              </div>
            </div>
            <input
              type="text"
              placeholder="https://www.youtube.com/watch?v=... または 動画ID"
              value={manualVideoInput}
              onChange={(e) => setManualVideoInput(e.target.value)}
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
            <button
              style={btnStyle('primary', { disabled: manualVideoSaving })}
              disabled={manualVideoSaving}
              onClick={handleAddManualVideo}
            >
              {manualVideoSaving ? '追加中...' : '追加'}
            </button>
            {manualVideoMessage && (
              <div
                style={{
                  fontSize: '12px',
                  color: manualVideoMessage.type === 'success' ? '#1e9e54' : '#e8001c'
                }}
              >
                {manualVideoMessage.text}
              </div>
            )}
          </div>
        </div>
        <div>
          <div style={sectionLabelStyle}>優先チャンネル</div>
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
            <div>
              <div style={{ color: textColor, fontSize: '13px' }}>
                予定・ライブ一覧の上部に表示するチャンネルを管理
              </div>
              <div style={descStyle}>
                Google 連携で同期した購読チャンネルの一覧です。配信カードの 📌
                ボタンと同じ設定で、ここからまとめて見直せます。
              </div>
              {onSyncChannelsNow && (
                <div style={{ marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={onSyncChannelsNow}
                    disabled={isSyncingChannels || !isAuthenticated}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      background: inputBg,
                      color: textColor,
                      border: `1px solid ${inputBorder}`,
                      borderRadius: '6px',
                      cursor: isSyncingChannels || !isAuthenticated ? 'not-allowed' : 'pointer',
                      opacity: isSyncingChannels || !isAuthenticated ? 0.5 : 1
                    }}
                    title="購読チャンネルを今すぐ再同期（通常は 24h キャッシュ）"
                  >
                    {isSyncingChannels ? '同期中…' : '🔄 今すぐ同期'}
                  </button>
                  <span style={{ ...descStyle, marginLeft: '8px' }}>
                    通常は24時間ごとに自動同期されます
                  </span>
                </div>
              )}
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
            <div style={listContainerStyle}>
              {subscriptionChannels.length > 0
                ? subscriptionChannels.map((ch) => renderChannelRow(ch, false))
                : emptyBox('該当するチャンネルがありません')}
            </div>
          </div>
        </div>
        <div>
          <div style={sectionLabelStyle}>手動追加チャンネル</div>
          <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
            <div>
              <div style={{ color: textColor, fontSize: '13px' }}>
                Google 連携なしで追加・管理するチャンネル
              </div>
              <div style={descStyle}>
                チャンネルページの URL、または @ハンドル名を入力してください。ここで追加した
                チャンネルは購読同期では消えず、🗑 ボタンで削除できます。
              </div>
            </div>
            <input
              type="text"
              placeholder="https://www.youtube.com/@example または @example"
              value={manualChannelInput}
              onChange={(e) => setManualChannelInput(e.target.value)}
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
            <input
              type="text"
              placeholder="表示名（任意）"
              value={manualChannelTitle}
              onChange={(e) => setManualChannelTitle(e.target.value)}
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
            <button
              style={btnStyle('primary', { disabled: manualChannelSaving })}
              disabled={manualChannelSaving}
              onClick={handleAddManualChannel}
            >
              {manualChannelSaving ? '追加中...' : '追加'}
            </button>
            <div style={listContainerStyle}>
              {manualChannels.length > 0
                ? manualChannels.map((ch) => renderChannelRow(ch, true))
                : emptyBox('手動追加したチャンネルはまだありません')}
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

  function renderAbout() {
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
      </div>
    )
  }

  const tabContent = {
    connection: renderConnection,
    display: renderDisplay,
    channels: renderChannels,
    data: renderData,
    about: renderAbout
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
            gridTemplateColumns: `repeat(${SETTINGS_TABS.length}, minmax(0, 1fr))`,
            gap: '8px',
            padding: '10px 12px',
            borderBottom: `1px solid ${inputBorder}`,
            background: darkMode ? '#18181f' : '#fafafa',
            alignItems: 'stretch'
          }}
        >
          {SETTINGS_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '10px 8px',
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
  reminderMinutes: PropTypes.number.isRequired,
  onReminderMinutesChange: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  onPinnedChannelsUpdated: PropTypes.func.isRequired,
  onChannelsUpdated: PropTypes.func,
  onToast: PropTypes.func.isRequired,
  appVersion: PropTypes.string.isRequired,
  isAuthenticated: PropTypes.bool.isRequired,
  credentialsMissing: PropTypes.bool.isRequired,
  credentialsPath: PropTypes.string,
  authError: PropTypes.string,
  onLogin: PropTypes.func.isRequired,
  onImportCredentials: PropTypes.func.isRequired,
  hideMembershipVideos: PropTypes.bool,
  onHideMembershipVideosChange: PropTypes.func,
  initialTab: PropTypes.oneOf(SETTINGS_TAB_KEYS),
  onSyncChannelsNow: PropTypes.func,
  isSyncingChannels: PropTypes.bool
}

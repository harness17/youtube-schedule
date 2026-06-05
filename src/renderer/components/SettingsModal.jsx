import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import {
  SETTINGS_TAB_KEYS,
  SETTINGS_TABS,
  manualVideoErrorMessage,
  manualVideoSuccessMessage,
  sortSettingsChannels
} from '../src/settingsModalModel.js'
import SettingsTabAbout from './SettingsTabAbout.jsx'
import SettingsTabChannels from './SettingsTabChannels.jsx'
import SettingsTabConnection from './SettingsTabConnection.jsx'
import SettingsTabData from './SettingsTabData.jsx'
import SettingsTabDisplay from './SettingsTabDisplay.jsx'

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
  const styles = {
    textColor,
    subColor,
    bgColor,
    inputBg,
    inputBorder,
    subBtnBg,
    subBtnColor,
    sectionLabelStyle,
    rowStyle,
    btnStyle,
    descStyle
  }

  async function handleOpenExternal(url) {
    window.api.openExternal(url)
  }

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

  async function handleResetDatabase() {
    if (!window.confirm('データベースをリセットしますか？この操作は取り消せません。')) {
      return
    }
    await window.api.resetDatabase()
    onToast('データベースをリセットしました')
    onClose()
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

  function handleLogout() {
    onClose()
    onLogout()
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

  const tabContent = {
    connection: () => (
      <SettingsTabConnection
        darkMode={darkMode}
        isAuthenticated={isAuthenticated}
        credentialsMissing={credentialsMissing}
        credentialsPath={credentialsPath}
        authError={authError}
        styles={styles}
        onImportCredentials={handleImportCredentials}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onOpenExternal={handleOpenExternal}
      />
    ),
    display: () => (
      <SettingsTabDisplay
        darkMode={darkMode}
        reminderMinutes={reminderMinutes}
        hideMembershipVideos={hideMembershipVideos}
        styles={styles}
        onDarkModeChange={onDarkModeChange}
        onReminderMinutesChange={onReminderMinutesChange}
        onHideMembershipVideosChange={onHideMembershipVideosChange}
      />
    ),
    channels: () => (
      <SettingsTabChannels
        darkMode={darkMode}
        channels={channels}
        channelManagerQuery={channelManagerQuery}
        manualChannelInput={manualChannelInput}
        manualChannelTitle={manualChannelTitle}
        manualChannelSaving={manualChannelSaving}
        manualVideoInput={manualVideoInput}
        manualVideoSaving={manualVideoSaving}
        manualVideoMessage={manualVideoMessage}
        isAuthenticated={isAuthenticated}
        isSyncingChannels={isSyncingChannels}
        styles={styles}
        onChannelManagerQueryChange={setChannelManagerQuery}
        onManualChannelInputChange={setManualChannelInput}
        onManualChannelTitleChange={setManualChannelTitle}
        onManualVideoInputChange={setManualVideoInput}
        onAddManualChannel={handleAddManualChannel}
        onAddManualVideo={handleAddManualVideo}
        onTogglePin={handleTogglePin}
        onDeleteChannel={handleDeleteChannel}
        onSyncChannelsNow={onSyncChannelsNow}
      />
    ),
    data: () => (
      <SettingsTabData
        styles={styles}
        onExportSettings={handleExportSettings}
        onImportSettings={handleImportSettings}
        onExportFavorites={handleExportFavorites}
        onImportFavorites={handleImportFavorites}
        onResetDatabase={handleResetDatabase}
      />
    ),
    about: () => (
      <SettingsTabAbout
        darkMode={darkMode}
        appVersion={appVersion}
        autoDownload={autoDownload}
        updateChecking={updateChecking}
        styles={styles}
        onCheckUpdate={handleCheckUpdate}
        onAutoDownloadToggle={handleAutoDownloadToggle}
        onOpenExternal={handleOpenExternal}
      />
    )
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

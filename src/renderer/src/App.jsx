import { useState, useEffect, useCallback, useRef } from 'react'
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { ErrorBoundary } from '../components/ErrorBoundary.jsx'
import ScheduleList from '../components/ScheduleList.jsx'
import StatsTab from '../components/StatsTab.jsx'
import PlaylistTab from '../components/PlaylistTab.jsx'
import StatusBanners from '../components/StatusBanners.jsx'
import SettingsModal from '../components/SettingsModal.jsx'
import Toast from '../components/Toast.jsx'
import BackToTop from '../components/BackToTop.jsx'
import UpdateBanner from '../components/UpdateBanner.jsx'
import AppHeader from '../components/AppHeader.jsx'
import MissedSectionNav from '../components/MissedSectionNav.jsx'
import FavoritesSectionNav from '../components/FavoritesSectionNav.jsx'
import AppTabFeed from '../components/AppTabFeed.jsx'
import AppTabArchive from '../components/AppTabArchive.jsx'
import AppTabMissed from '../components/AppTabMissed.jsx'
import AppTabFavorites from '../components/AppTabFavorites.jsx'
import { ArchiveFilterBar } from '../components/ArchiveFilterBar.jsx'
import { updaterErrorMessage } from './updaterMessages.js'
import { APP_TABS, getVisibleTabs } from './appTabsModel.js'
import {
  isArchiveChannelOnly,
  isSelectedChannelOnly,
  toggleArchiveChannelOnly
} from './channelFilter.js'
import { useSchedule } from '../hooks/useSchedule.js'
import { useStats } from '../hooks/useStats.js'
import { useDarkMode } from '../hooks/useDarkMode.js'
import { useNotificationCheck } from '../hooks/useNotificationCheck.js'
import { useAuth } from '../hooks/useAuth.js'
import { useTabState } from '../hooks/useTabState.js'
import {
  DEFAULT_REMINDER_MINUTES,
  REMINDER_SETTING_KEY,
  normalizeReminderMinutes
} from '../constants/notificationSettings.js'

// main.jsx が { ErrorBoundary } を App.jsx からインポートしているため再エクスポート
export { ErrorBoundary }

export default function App() {
  // ===== アプリ全体の UI 状態 ==================================================
  const [toast, setToast] = useState(null)
  const [updateStatus, setUpdateStatus] = useState(null)
  const [appVersion, setAppVersion] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState('display')
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [reminderMinutes, setReminderMinutes] = useState(DEFAULT_REMINDER_MINUTES)
  const [pickupMode, setPickupMode] = useState(false)
  const [isSyncingChannels, setIsSyncingChannels] = useState(false)

  useEffect(() => {
    window.api.getVersion().then((v) => setAppVersion(v))
    window.api
      .getSetting(REMINDER_SETTING_KEY, DEFAULT_REMINDER_MINUTES)
      .then((value) => setReminderMinutes(normalizeReminderMinutes(value)))
  }, [])

  // オフライン検知
  useEffect(() => {
    const onOnline = () => setIsOffline(false)
    const onOffline = () => setIsOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // ===== コアフック ===========================================================
  const {
    live,
    upcoming,
    feedVideos,
    loading,
    error,
    dbBroken,
    initialLoaded,
    refresh,
    updateVideo
  } = useSchedule()
  const {
    isAuthenticated,
    authLoading,
    loginSuccess,
    credentialsMissing,
    credentialsPath,
    authError,
    handleLogin,
    handleLogout,
    handleImportCredentials
  } = useAuth({ onAuthenticated: refresh })
  const { darkMode, setDarkMode } = useDarkMode()
  useNotificationCheck({
    upcoming,
    live,
    isAuthenticated,
    initialLoaded,
    reminderMinutes
  })

  async function handleReminderMinutesChange(value) {
    const next = normalizeReminderMinutes(value)
    setReminderMinutes(next)
    await window.api.setSetting(REMINDER_SETTING_KEY, next)
  }

  function openSettings(tab = 'display') {
    setSettingsInitialTab(tab)
    setShowSettings(true)
  }

  // ===== タブ状態 ==============================================================
  const {
    activeTab,
    missedVideos,
    archiveHasMore,
    archiveLoadingMore,
    favoriteVideos,
    tabLoading,
    archiveSentinelRef,
    searchQuery,
    selectedChannel,
    setSelectedChannel,
    archiveFilters,
    setArchiveFilters,
    archiveSort,
    setArchiveSort,
    resetArchiveFilters,
    hideMembershipVideos,
    toggleHideMembershipVideos,
    favoriteReorderMode,
    setFavoriteReorderMode,
    favoriteOrderDirty,
    favoriteOrderSaving,
    pinnedChannelIds,
    allDbChannels,
    loadAllDbChannels,
    tabChannels,
    filteredLive,
    filteredUpcoming,
    filteredMissed,
    missedBadgeCount,
    filteredArchive,
    filteredFavorites,
    favoriteSections,
    missedSections,
    handleTabChange,
    handleSearchQueryChange,
    handleMarkViewed,
    handleToggleFavorite,
    handleTogglePin,
    handleToggleNotify,
    reorderFavorites,
    saveFavoriteOrder
  } = useTabState({
    live,
    upcoming,
    updateVideo,
    initialTab: isAuthenticated ? 'schedule' : 'feed'
  })
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    reload: reloadStats
  } = useStats(activeTab === 'stats')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // ===== モード切り替え時の activeTab リセット =================================
  useEffect(() => {
    if (authLoading) return
    if (isAuthenticated && activeTab === 'feed') {
      handleTabChange('schedule')
    } else if (
      !isAuthenticated &&
      APP_TABS.filter((t) => t.mode === 'full')
        .map((t) => t.key)
        .includes(activeTab)
    ) {
      handleTabChange('feed')
    }
    // handleTabChange はタブごとのロードを含むため、モード境界だけで実行する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading])

  // ===== 自動アップデートイベント ==============================================
  useEffect(() => {
    window.api.onUpdateAvailable(() => setUpdateStatus('downloading'))
    window.api.onUpdateDownloaded(() => setUpdateStatus('ready'))
    window.api.onUpdaterError((msg) => {
      setUpdateStatus(null)
      setToast(updaterErrorMessage(msg))
    })
  }, [])

  // ===== 自動リフレッシュ（10 分ごと）=========================================
  // refresh が再生成されるたびにインターバルを張り直すのを避けるため ref 経由で参照する
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    const id = setInterval(() => refreshRef.current(), 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // ===== API クォータ超過トースト ==============================================
  useEffect(() => {
    if (error === 'QUOTA_EXCEEDED') {
      const id = setTimeout(() => setToast('本日の API 上限に達しました'), 0)
      return () => clearTimeout(id)
    }
  }, [error])

  const handleToastClose = useCallback(() => setToast(null), [])

  // ===== 認証前の早期 return ==================================================

  if (authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'sans-serif'
        }}
      >
        読み込み中...
      </div>
    )
  }

  if (loginSuccess) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '16px',
          fontFamily: 'sans-serif'
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            background: '#FF0000',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            color: 'white'
          }}
        >
          ✓
        </div>
        <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#111' }}>ログイン完了</p>
        <p style={{ fontSize: '13px', color: '#888' }}>配信スケジュールを読み込んでいます...</p>
      </div>
    )
  }

  // ===== テーマカラー ==========================================================
  const textColor = darkMode ? '#e8e8f0' : '#111120'
  const subColor = darkMode ? '#7878a0' : '#6060a0'
  const inputBg = darkMode ? '#16161e' : '#ffffff'
  const inputBorder = darkMode ? '#2a2a38' : '#dddde8'
  const archiveHasActiveFilters =
    archiveFilters.channelIds.length > 0 || archiveFilters.period !== 'all'

  // ===== チャンネル絞り込み（このチャンネルのみ）===============================
  /**
   * 配信カードの「このチャンネルのみ」ボタン押下時の絞り込み。
   * archive タブは archiveFilters.channelIds を単独置換トグル、
   * それ以外のタブは上部セレクトボックス（selectedChannel）を単独選択トグルする。
   */
  function handleFilterChannel(channelId) {
    if (!channelId) return
    if (activeTab === 'archive') {
      setArchiveFilters((f) => ({
        ...f,
        channelIds: toggleArchiveChannelOnly(f.channelIds, channelId)
      }))
    } else {
      setSelectedChannel((current) => (current === channelId ? 'all' : channelId))
    }
  }

  /** そのチャンネルだけに絞り込み中かどうか（ボタンのハイライト・ラベル切替用） */
  function isChannelFiltered(channelId) {
    if (activeTab === 'archive') {
      return isArchiveChannelOnly(archiveFilters.channelIds, channelId)
    }
    return isSelectedChannelOnly(selectedChannel, channelId)
  }

  // ===== 共通カード描画ハーネス =================================================
  const cardCtx = {
    darkMode,
    pinnedChannelIds,
    onToggleWatch: handleToggleNotify,
    onToggleFavorite: handleToggleFavorite,
    onMarkViewed: handleMarkViewed,
    onTogglePin: handleTogglePin,
    onFilterChannel: handleFilterChannel,
    isChannelFiltered
  }

  const favoriteCardCtx = {
    ...cardCtx,
    reorderMode: favoriteReorderMode
  }

  async function handleStatsTogglePin(channelId) {
    await handleTogglePin(channelId)
    reloadStats()
  }

  async function handleStatsDeleteChannel(channelId) {
    const ok = await window.api.deleteChannel?.(channelId)
    if (ok) {
      loadAllDbChannels()
      reloadStats()
      setToast('手動追加チャンネルを削除しました')
    }
  }

  async function handleSyncChannelsNow({ reloadStatsAfter = false } = {}) {
    if (isSyncingChannels) return
    setIsSyncingChannels(true)
    try {
      const result = await window.api.syncChannelsNow?.()
      if (result?.ok) {
        loadAllDbChannels()
        if (reloadStatsAfter) reloadStats()
        setToast('チャンネルを同期しました')
      } else {
        setToast(
          result?.error === 'SYNC_FAILED'
            ? '同期に失敗しました（クォータ超過の可能性）'
            : '同期できませんでした'
        )
      }
    } finally {
      setIsSyncingChannels(false)
    }
  }

  // ===== メイン UI =============================================================
  return (
    <div
      style={{
        maxWidth: '840px',
        margin: '0 auto',
        padding: updateStatus ? '48px 16px 24px' : '16px 16px 24px',
        color: textColor,
        minHeight: '100vh'
      }}
    >
      <UpdateBanner status={updateStatus} onInstall={() => window.api.quitAndInstall()} />
      <StatusBanners dbBroken={dbBroken} isOffline={isOffline} />

      {/* ── ヘッダー行 1: タイトル・更新ボタン・設定 ── */}
      <AppHeader
        appVersion={appVersion}
        isAuthenticated={isAuthenticated}
        loading={loading}
        textColor={textColor}
        subColor={subColor}
        onRefresh={refresh}
        onOpenSettings={openSettings}
      />

      {/* ── ヘッダー行 2: キーワード検索・チャンネルフィルター ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px', position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: subColor,
              fontSize: '13px',
              pointerEvents: 'none',
              lineHeight: 1
            }}
          >
            🔍
          </span>
          <input
            type="text"
            placeholder="キーワード検索（タイトル・チャンネル名）"
            value={searchQuery}
            onChange={(e) => handleSearchQueryChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px 8px 30px',
              fontSize: '13px',
              background: inputBg,
              color: textColor,
              border: `1px solid ${inputBorder}`,
              borderRadius: '8px',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
        </div>
        {activeTab !== 'archive' && tabChannels.length > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              border: `1px solid ${
                selectedChannel !== 'all'
                  ? darkMode
                    ? 'rgba(0,194,255,0.5)'
                    : 'rgba(0,150,200,0.45)'
                  : inputBorder
              }`,
              borderRadius: '8px',
              background: inputBg,
              overflow: 'hidden'
            }}
          >
            <span
              style={{
                padding: '7px 8px 7px 10px',
                fontSize: '11px',
                color: selectedChannel !== 'all' ? (darkMode ? '#00c2ff' : '#0099cc') : subColor,
                whiteSpace: 'nowrap',
                userSelect: 'none',
                borderRight: `1px solid ${
                  selectedChannel !== 'all'
                    ? darkMode
                      ? 'rgba(0,194,255,0.3)'
                      : 'rgba(0,150,200,0.3)'
                    : inputBorder
                }`,
                fontWeight: selectedChannel !== 'all' ? '600' : 'normal'
              }}
            >
              チャンネル
            </span>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              style={{
                padding: '7px 8px',
                fontSize: '13px',
                background: inputBg,
                color: textColor,
                border: 'none',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '160px',
                fontFamily: 'inherit',
                colorScheme: darkMode ? 'dark' : 'light'
              }}
            >
              <option value="all">すべて</option>
              {tabChannels.map(({ id, title, isPinned }) => (
                <option key={id} value={id}>
                  {isPinned ? '📌 ' : ''}
                  {title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ── タブバー（ピル型）+ お気に入りセクションナビ ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          flexWrap: 'wrap',
          marginBottom: '16px'
        }}
      >
        <div className="yt-tabs" style={{ marginBottom: 0 }}>
          {getVisibleTabs(isAuthenticated).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`yt-tab${activeTab === key ? ' yt-tab--active' : ''}`}
            >
              {label}
              {key === 'missed' && missedBadgeCount > 0 && (
                <span className="yt-tab-badge">{missedBadgeCount}</span>
              )}
            </button>
          ))}
        </div>
        {activeTab === 'schedule' && (
          <button
            className={`yt-nav-btn${pickupMode ? ' yt-nav-btn--pickup' : ''}`}
            title="お気に入り・お知らせ・優先チャンネルだけを表示"
            onClick={() => setPickupMode((value) => !value)}
            style={{ marginTop: '4px' }}
          >
            {pickupMode ? 'ピックアップ中' : 'ピックアップ'}
          </button>
        )}
        {activeTab === 'archive' && (
          <div style={{ paddingTop: '4px', flexShrink: 0 }}>
            <ArchiveFilterBar
              channels={tabChannels}
              filters={archiveFilters}
              sort={archiveSort}
              onChangeFilters={setArchiveFilters}
              onChangeSort={setArchiveSort}
              onReset={resetArchiveFilters}
            />
          </div>
        )}
        {activeTab === 'missed' && (
          <MissedSectionNav filteredMissed={filteredMissed} missedSections={missedSections} />
        )}
        {activeTab === 'favorites' && (
          <FavoritesSectionNav
            filteredFavorites={filteredFavorites}
            favoriteSections={favoriteSections}
          />
        )}
        {activeTab === 'favorites' && favoriteVideos.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              paddingTop: '4px',
              flexShrink: 0,
              flexWrap: 'wrap'
            }}
          >
            <button
              className={`yt-nav-btn${favoriteReorderMode ? ' yt-nav-btn--live' : ''}`}
              disabled={Boolean(searchQuery.trim()) || selectedChannel !== 'all'}
              onClick={() => {
                setFavoriteReorderMode(!favoriteReorderMode)
              }}
            >
              ↕ 並び替え
            </button>
            {favoriteReorderMode && (
              <button
                className="yt-nav-btn yt-nav-btn--save"
                disabled={!favoriteOrderDirty || favoriteOrderSaving}
                onClick={async () => {
                  const ok = await saveFavoriteOrder()
                  setToast(ok ? 'お気に入りの並び順を保存しました' : '並び順の保存に失敗しました')
                }}
              >
                {favoriteOrderSaving ? '保存中...' : '保存'}
              </button>
            )}
            {(searchQuery.trim() || selectedChannel !== 'all') && (
              <span style={{ fontSize: '12px', color: subColor }}>
                並び替えは絞り込みを解除すると使えます
              </span>
            )}
            {favoriteReorderMode && favoriteOrderDirty && (
              <span style={{ fontSize: '12px', color: subColor }}>未保存の変更があります</span>
            )}
          </div>
        )}
      </div>

      {/* ── 新着動画タブ（簡易モード） ── */}
      {activeTab === 'feed' && (
        <AppTabFeed
          feedVideos={feedVideos}
          allDbChannels={allDbChannels}
          loading={loading}
          darkMode={darkMode}
          subColor={subColor}
          onOpenSettings={openSettings}
          cardCtx={cardCtx}
        />
      )}

      {/* ── 予定・ライブタブ ── */}
      {activeTab === 'schedule' && (
        <>
          {error && error !== 'QUOTA_EXCEEDED' && (
            <div className="banner banner--error" style={{ marginBottom: '12px' }}>
              {error === 'NOT_AUTHENTICATED' ? '認証が必要です' : 'データの取得に失敗しました'}
            </div>
          )}
          <ScheduleList
            live={filteredLive}
            upcoming={filteredUpcoming}
            darkMode={darkMode}
            pinnedChannelIds={pinnedChannelIds}
            pickupOnly={pickupMode}
            onToggleWatch={handleToggleNotify}
            onToggleFavorite={handleToggleFavorite}
            onTogglePin={handleTogglePin}
            onFilterChannel={handleFilterChannel}
            isChannelFiltered={isChannelFiltered}
          />
        </>
      )}

      {/* ── 見逃しタブ ── */}
      {activeTab === 'missed' && (
        <AppTabMissed
          tabLoading={tabLoading}
          filteredMissed={filteredMissed}
          hasMissed={missedVideos.length > 0}
          searchQuery={searchQuery}
          selectedChannel={selectedChannel}
          subColor={subColor}
          missedSections={missedSections}
          cardCtx={cardCtx}
        />
      )}

      {/* ── アーカイブタブ ── */}
      {activeTab === 'archive' && (
        <AppTabArchive
          filteredArchive={filteredArchive}
          tabLoading={tabLoading}
          archiveHasMore={archiveHasMore}
          archiveLoadingMore={archiveLoadingMore}
          archiveSentinelRef={archiveSentinelRef}
          archiveHasActiveFilters={archiveHasActiveFilters}
          searchQuery={searchQuery}
          subColor={subColor}
          cardCtx={cardCtx}
        />
      )}

      {/* ── 統計タブ ── */}
      {activeTab === 'stats' && (
        <StatsTab
          stats={stats}
          loading={statsLoading}
          error={statsError}
          darkMode={darkMode}
          onToggleNotify={handleToggleNotify}
          onToggleFavorite={handleToggleFavorite}
          onTogglePin={handleStatsTogglePin}
          onDeleteChannel={handleStatsDeleteChannel}
          onSyncNow={() => handleSyncChannelsNow({ reloadStatsAfter: true })}
          syncing={isSyncingChannels}
        />
      )}

      {/* ── お気に入りタブ（区分ごとに保存済みの任意順） ── */}
      {activeTab === 'favorites' && (
        <AppTabFavorites
          tabLoading={tabLoading}
          filteredFavorites={filteredFavorites}
          hasFavorites={favoriteVideos.length > 0}
          searchQuery={searchQuery}
          selectedChannel={selectedChannel}
          subColor={subColor}
          favoriteSections={favoriteSections}
          favoriteCardCtx={favoriteCardCtx}
          sensors={sensors}
          reorderFavorites={reorderFavorites}
        />
      )}

      {/* ── プレイリストタブ（YouTube から YouTom への取り込み専用） ── */}
      {activeTab === 'playlist' && (
        <PlaylistTab
          active={activeTab === 'playlist'}
          darkMode={darkMode}
          isAuthenticated={isAuthenticated}
          searchQuery={searchQuery}
          hideMembershipVideos={hideMembershipVideos}
          pinnedChannelIds={pinnedChannelIds}
          onToggleWatch={handleToggleNotify}
          onToggleFavorite={handleToggleFavorite}
          onMarkViewed={handleMarkViewed}
          onTogglePin={handleTogglePin}
          onToast={setToast}
        />
      )}

      {showSettings && (
        <SettingsModal
          open={showSettings}
          onClose={() => setShowSettings(false)}
          initialTab={settingsInitialTab}
          darkMode={darkMode}
          onDarkModeChange={(val) => setDarkMode(val)}
          reminderMinutes={reminderMinutes}
          onReminderMinutesChange={handleReminderMinutesChange}
          onLogout={handleLogout}
          onPinnedChannelsUpdated={loadAllDbChannels}
          onToast={setToast}
          appVersion={appVersion}
          isAuthenticated={isAuthenticated}
          credentialsMissing={credentialsMissing}
          credentialsPath={credentialsPath}
          authError={authError}
          onLogin={handleLogin}
          onImportCredentials={handleImportCredentials}
          onChannelsUpdated={() => {
            loadAllDbChannels()
            refresh()
          }}
          hideMembershipVideos={hideMembershipVideos}
          onHideMembershipVideosChange={toggleHideMembershipVideos}
          onSyncChannelsNow={() => handleSyncChannelsNow()}
          isSyncingChannels={isSyncingChannels}
        />
      )}
      {toast && <Toast message={toast} onClose={handleToastClose} />}
      <BackToTop />
    </div>
  )
}

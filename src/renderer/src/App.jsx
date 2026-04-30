import { useState, useEffect, useCallback, useRef } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary.jsx'
import AuthScreen from '../components/AuthScreen.jsx'
import ScheduleCard from '../components/ScheduleCard.jsx'
import ScheduleList from '../components/ScheduleList.jsx'
import StatusBanners from '../components/StatusBanners.jsx'
import SettingsModal from '../components/SettingsModal.jsx'
import Toast from '../components/Toast.jsx'
import BackToTop from '../components/BackToTop.jsx'
import CredentialsSetupScreen from '../components/CredentialsSetupScreen.jsx'
import UpdateBanner from '../components/UpdateBanner.jsx'
import { useSchedule } from '../hooks/useSchedule.js'
import { useDarkMode } from '../hooks/useDarkMode.js'
import { useNotificationCheck } from '../hooks/useNotificationCheck.js'
import { useAuth } from '../hooks/useAuth.js'
import { useTabState } from '../hooks/useTabState.js'

// main.jsx が { ErrorBoundary } を App.jsx からインポートしているため再エクスポート
export { ErrorBoundary }

export default function App() {
  // ===== アプリ全体の UI 状態 ==================================================
  const [toast, setToast] = useState(null)
  const [updateStatus, setUpdateStatus] = useState(null)
  const [appVersion, setAppVersion] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    window.api.getVersion().then((v) => setAppVersion(v))
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
  const { live, upcoming, loading, error, dbBroken, refresh, updateVideo } = useSchedule()
  const {
    isAuthenticated,
    authLoading,
    loginSuccess,
    credentialsMissing,
    credentialsPath,
    handleLogin,
    handleLogout
  } = useAuth({ onAuthenticated: refresh })
  const { darkMode, setDarkMode } = useDarkMode()
  useNotificationCheck({ upcoming, isAuthenticated })

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
    pinnedChannelIds,
    loadAllDbChannels,
    tabChannels,
    filteredLive,
    filteredUpcoming,
    filteredMissed,
    filteredArchive,
    filteredFavorites,
    favoriteSections,
    handleTabChange,
    handleSearchQueryChange,
    handleMarkViewed,
    handleToggleFavorite,
    handleTogglePin,
    handleToggleNotify
  } = useTabState({ live, upcoming, updateVideo })

  // ===== 自動アップデートイベント ==============================================
  useEffect(() => {
    window.api.onUpdateAvailable(() => setUpdateStatus('downloading'))
    window.api.onUpdateDownloaded(() => setUpdateStatus('ready'))
    window.api.onUpdaterError((msg) => {
      setUpdateStatus(null)
      setToast(`更新エラー: ${msg}`)
    })
  }, [])

  // ===== 自動リフレッシュ（10 分ごと）=========================================
  // refresh が再生成されるたびにインターバルを張り直すのを避けるため ref 経由で参照する
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    if (!isAuthenticated) return
    const id = setInterval(() => refreshRef.current(), 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [isAuthenticated])

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

  if (credentialsMissing) {
    return <CredentialsSetupScreen credentialsPath={credentialsPath} />
  }

  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} loading={authLoading} />
  }

  // ===== テーマカラー ==========================================================
  const textColor = darkMode ? '#e8e8f0' : '#111120'
  const subColor = darkMode ? '#7878a0' : '#6060a0'
  const inputBg = darkMode ? '#16161e' : '#ffffff'
  const inputBorder = darkMode ? '#2a2a38' : '#dddde8'
  const subBtnBg = darkMode ? '#1e1e2c' : '#ebebf5'
  const subBtnColor = darkMode ? '#8888b0' : '#555570'

  // ===== 共通カード描画ハーネス =================================================
  /**
   * アーカイブ・見逃し・お気に入りタブで共通の ScheduleCard を生成する。
   * 新しい prop を追加するときはこの関数のみ更新すれば全タブに反映される。
   */
  function renderTabCard(item, extraProps = {}) {
    return (
      <ScheduleCard
        key={item.id}
        item={item}
        darkMode={darkMode}
        watched={item.isNotify}
        isPinned={pinnedChannelIds.has(item.channelId)}
        onToggleWatch={handleToggleNotify}
        onToggleFavorite={handleToggleFavorite}
        onMarkViewed={handleMarkViewed}
        onTogglePin={handleTogglePin}
        showViewedButton={true}
        isViewed={item.viewedAt != null}
        {...extraProps}
      />
    )
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '10px',
          flexWrap: 'wrap'
        }}
      >
        <h1
          className="yt-display"
          style={{ fontSize: '26px', flex: 1, color: textColor, margin: 0, lineHeight: 1 }}
        >
          YouTube Schedule{' '}
          {appVersion && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 'normal',
                color: subColor,
                fontFamily: 'inherit',
                letterSpacing: 0
              }}
            >
              v{appVersion}
            </span>
          )}
        </h1>
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            padding: '7px 16px',
            background: darkMode ? 'rgba(255,34,68,0.18)' : 'rgba(220,0,20,0.1)',
            color: darkMode ? '#ff4466' : '#cc001a',
            border: `1px solid ${darkMode ? 'rgba(255,34,68,0.4)' : 'rgba(220,0,20,0.3)'}`,
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            fontSize: '12px',
            fontWeight: '600',
            fontFamily: 'inherit'
          }}
        >
          {loading ? '更新中...' : '↺ 更新'}
        </button>
        <button
          onClick={() => setShowSettings(true)}
          title="設定"
          style={{
            padding: '7px 10px',
            background: subBtnBg,
            color: subBtnColor,
            border: `1px solid ${inputBorder}`,
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            lineHeight: 1
          }}
        >
          ⚙️
        </button>
      </div>

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
        {tabChannels.length > 1 && (
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
          {[
            { key: 'schedule', label: '予定・ライブ' },
            { key: 'missed', label: '見逃し' },
            { key: 'archive', label: 'アーカイブ' },
            { key: 'favorites', label: '⭐ お気に入り' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`yt-tab${activeTab === key ? ' yt-tab--active' : ''}`}
            >
              {label}
              {key === 'missed' && missedVideos.length > 0 && (
                <span className="yt-tab-badge">{missedVideos.length}</span>
              )}
            </button>
          ))}
        </div>
        {activeTab === 'favorites' &&
          filteredFavorites.length > 0 &&
          (() => {
            const { normalFavs, upcomingFavs, viewedFavs } = favoriteSections
            const sectionCount = [normalFavs, upcomingFavs, viewedFavs].filter(
              (s) => s.length > 0
            ).length
            if (sectionCount < 2) return null
            return (
              <div style={{ display: 'flex', gap: '4px', paddingTop: '4px', flexShrink: 0 }}>
                {upcomingFavs.length > 0 && (
                  <button
                    className="yt-nav-btn"
                    onClick={() =>
                      document
                        .getElementById('fav-upcoming')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  >
                    📅 未配信
                  </button>
                )}
                {normalFavs.length > 0 && (
                  <button
                    className="yt-nav-btn"
                    onClick={() =>
                      document
                        .getElementById('fav-normal')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  >
                    📋 通常
                  </button>
                )}
                {viewedFavs.length > 0 && (
                  <button
                    className="yt-nav-btn"
                    onClick={() =>
                      document
                        .getElementById('fav-viewed')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  >
                    ✅ 視聴済み
                  </button>
                )}
              </div>
            )
          })()}
      </div>

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
            onToggleWatch={handleToggleNotify}
            onToggleFavorite={handleToggleFavorite}
            onTogglePin={handleTogglePin}
          />
        </>
      )}

      {/* ── 見逃しタブ ── */}
      {activeTab === 'missed' && (
        <div>
          {tabLoading ? (
            <div style={{ textAlign: 'center', color: subColor, marginTop: '48px' }}>
              読み込み中...
            </div>
          ) : filteredMissed.length === 0 ? (
            <div style={{ textAlign: 'center', color: subColor, marginTop: '48px' }}>
              {(searchQuery.trim() || selectedChannel !== 'all') && missedVideos.length > 0
                ? selectedChannel !== 'all' && !searchQuery.trim()
                  ? 'このチャンネルの配信はありません'
                  : '検索結果がありません'
                : '見逃した配信はありません 🎉'}
            </div>
          ) : (
            filteredMissed.map((item) => renderTabCard(item))
          )}
        </div>
      )}

      {/* ── アーカイブタブ ── */}
      {activeTab === 'archive' && (
        <div>
          {tabLoading ? (
            <div style={{ textAlign: 'center', color: subColor, marginTop: '32px' }}>
              読み込み中...
            </div>
          ) : filteredArchive.length === 0 ? (
            <div style={{ textAlign: 'center', color: subColor, marginTop: '32px' }}>
              {selectedChannel !== 'all' && !searchQuery.trim()
                ? 'このチャンネルの配信はありません'
                : searchQuery.trim() || selectedChannel !== 'all'
                  ? '検索結果がありません'
                  : 'アーカイブがありません'}
            </div>
          ) : (
            <>
              {filteredArchive.map((item) => renderTabCard(item))}
              {archiveHasMore && <div ref={archiveSentinelRef} style={{ height: '1px' }} />}
              {archiveLoadingMore && (
                <div style={{ textAlign: 'center', color: subColor, padding: '16px' }}>
                  読み込み中...
                </div>
              )}
              {!archiveHasMore && filteredArchive.length > 0 && !searchQuery.trim() && (
                <div
                  style={{
                    textAlign: 'center',
                    color: subColor,
                    fontSize: '12px',
                    padding: '16px'
                  }}
                >
                  すべて表示しました
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── お気に入りタブ（通常 → 未配信 → 視聴済みの 3 セクション） ── */}
      {activeTab === 'favorites' && (
        <div>
          {tabLoading ? (
            <div style={{ textAlign: 'center', color: subColor, marginTop: '48px' }}>
              読み込み中...
            </div>
          ) : filteredFavorites.length === 0 ? (
            <div style={{ textAlign: 'center', color: subColor, marginTop: '48px' }}>
              {(searchQuery.trim() || selectedChannel !== 'all') && favoriteVideos.length > 0
                ? selectedChannel !== 'all' && !searchQuery.trim()
                  ? 'このチャンネルの配信はありません'
                  : '検索結果がありません'
                : 'お気に入りはまだありません'}
            </div>
          ) : (
            (() => {
              const { normalFavs, upcomingFavs, viewedFavs } = favoriteSections
              // 表示順: 未配信 → 通常 → 視聴済み
              const hasAbove = (i) =>
                [upcomingFavs, normalFavs].slice(0, i).some((s) => s.length > 0)
              return (
                <>
                  {upcomingFavs.length > 0 && (
                    <>
                      <div
                        id="fav-upcoming"
                        className="yt-section-label"
                        style={{ color: subColor }}
                      >
                        📅 未配信
                      </div>
                      {upcomingFavs.map((item) =>
                        renderTabCard(item, { showStatusBadge: true, showViewedButton: false })
                      )}
                    </>
                  )}
                  {normalFavs.length > 0 && (
                    <>
                      <div
                        id="fav-normal"
                        className="yt-section-label"
                        style={{ color: subColor, marginTop: hasAbove(1) ? '16px' : 0 }}
                      >
                        📋 通常
                      </div>
                      {normalFavs.map((item) =>
                        renderTabCard(item, { showStatusBadge: false, showViewedButton: true })
                      )}
                    </>
                  )}
                  {viewedFavs.length > 0 && (
                    <>
                      <div
                        id="fav-viewed"
                        className="yt-section-label"
                        style={{ color: subColor, marginTop: hasAbove(2) ? '16px' : 0 }}
                      >
                        ✅ 視聴済み
                      </div>
                      {viewedFavs.map((item) =>
                        renderTabCard(item, {
                          showStatusBadge: true,
                          showViewedButton: item.status === 'ended'
                        })
                      )}
                    </>
                  )}
                </>
              )
            })()
          )}
        </div>
      )}

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        darkMode={darkMode}
        onDarkModeChange={(val) => setDarkMode(val)}
        onLogout={handleLogout}
        onPinnedChannelsUpdated={loadAllDbChannels}
        onToast={setToast}
        appVersion={appVersion}
      />
      {toast && <Toast message={toast} onClose={handleToastClose} />}
      <BackToTop />
    </div>
  )
}

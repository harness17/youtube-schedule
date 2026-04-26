import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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

export { ErrorBoundary }

export default function App() {
  const [toast, setToast] = useState(null)
  const [updateStatus, setUpdateStatus] = useState(null)
  const [appVersion, setAppVersion] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    window.api.getVersion().then((v) => setAppVersion(v))
  }, [])
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
  const handleToastClose = useCallback(() => setToast(null), [])

  const [isOffline, setIsOffline] = useState(!navigator.onLine)
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

  // タブ管理
  const [activeTab, setActiveTab] = useState('schedule')
  const [missedVideos, setMissedVideos] = useState([])
  const [archiveVideos, setArchiveVideos] = useState([])
  const [archiveHasMore, setArchiveHasMore] = useState(false)
  const [archiveLoadingMore, setArchiveLoadingMore] = useState(false)
  const archiveOffsetRef = useRef(0)
  const archiveLoadingMoreRef = useRef(false)
  const archiveSentinelRef = useRef(null)
  const loadMoreArchiveFnRef = useRef(null)
  const [favoriteVideos, setFavoriteVideos] = useState([])
  const [tabLoading, setTabLoading] = useState(false)
  const SEARCH_TARGETS = { title: true, channel: true, description: false }
  const ARCHIVE_LIMIT = 50
  const SEARCH_LIMIT = 200

  async function handleTabChange(tab) {
    setActiveTab(tab)
    setSelectedChannel('all')
    if (tab === 'missed') {
      setTabLoading(true)
      setMissedVideos((await window.api.listMissed?.()) ?? [])
      setTabLoading(false)
    } else if (tab === 'archive') {
      archiveOffsetRef.current = 0
      setArchiveHasMore(false)
      setTabLoading(true)
      const q = searchQuery.trim()
      let data, hasMore
      if (q) {
        data =
          (await window.api.searchByText?.(q, { ...SEARCH_TARGETS, limit: SEARCH_LIMIT })) ?? []
        hasMore = false
      } else {
        data = (await window.api.listArchive?.({ limit: ARCHIVE_LIMIT, offset: 0 })) ?? []
        hasMore = data.length === ARCHIVE_LIMIT
      }
      archiveOffsetRef.current = q ? 0 : data.length
      setArchiveVideos(data)
      setArchiveHasMore(hasMore)
      setTabLoading(false)
    } else if (tab === 'favorites') {
      setTabLoading(true)
      setFavoriteVideos((await window.api.listFavorites?.()) ?? [])
      setTabLoading(false)
    }
  }

  async function loadMoreArchive() {
    if (archiveLoadingMoreRef.current) return
    archiveLoadingMoreRef.current = true
    setArchiveLoadingMore(true)
    const offset = archiveOffsetRef.current
    const data = (await window.api.listArchive?.({ limit: ARCHIVE_LIMIT, offset })) ?? []
    archiveOffsetRef.current = offset + data.length
    setArchiveVideos((prev) => [...prev, ...data])
    setArchiveHasMore(data.length === ARCHIVE_LIMIT)
    archiveLoadingMoreRef.current = false
    setArchiveLoadingMore(false)
  }

  // eslint-disable-next-line react-hooks/refs -- stale closure 対策。IntersectionObserver コールバックが最新の loadMoreArchive を参照できるよう render 時に同期する
  loadMoreArchiveFnRef.current = loadMoreArchive

  useEffect(() => {
    if (activeTab !== 'archive' || !archiveHasMore) return
    const sentinel = archiveSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreArchiveFnRef.current?.()
      },
      { rootMargin: '300px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [activeTab, archiveHasMore, archiveVideos.length])

  const archiveSearchSeqRef = useRef(0)
  const archiveSearchTimerRef = useRef(null)

  function runArchiveSearch(query) {
    clearTimeout(archiveSearchTimerRef.current)
    archiveSearchTimerRef.current = setTimeout(async () => {
      const seq = ++archiveSearchSeqRef.current
      setTabLoading(true)
      let data, hasMore
      if (query.trim()) {
        data =
          (await window.api.searchByText?.(query, { ...SEARCH_TARGETS, limit: SEARCH_LIMIT })) ?? []
        hasMore = false
      } else {
        data = (await window.api.listArchive?.({ limit: ARCHIVE_LIMIT, offset: 0 })) ?? []
        hasMore = data.length === ARCHIVE_LIMIT
      }
      if (seq !== archiveSearchSeqRef.current) return
      archiveOffsetRef.current = query.trim() ? 0 : data.length
      setArchiveVideos(data)
      setArchiveHasMore(hasMore)
      setTabLoading(false)
    }, 300)
  }

  /**
   * アーカイブ・見逃し・お気に入りタブ共通のカード描画ハーネス。
   * ScheduleCard に渡す共通 props はここだけで管理する。
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

  async function handleMarkViewed(id, viewed) {
    if (viewed) {
      await window.api.markViewed?.(id)
    } else {
      await window.api.clearViewed?.(id)
    }
    const patch = { viewedAt: viewed ? Date.now() : null }
    setMissedVideos((prev) => (viewed ? prev.filter((v) => v.id !== id) : prev))
    setArchiveVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
    setFavoriteVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }

  // 検索・フィルター（scheduleタブ用）
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('all')

  // ピン済みチャンネル
  const [pinnedChannelIds, setPinnedChannelIds] = useState(new Set())

  const loadAllDbChannels = useCallback(() => {
    window.api.listAllChannels?.().then((chs) => {
      setPinnedChannelIds(new Set((chs ?? []).filter((c) => c.isPinned).map((c) => c.id)))
    })
  }, [])

  useEffect(() => {
    loadAllDbChannels()
  }, [loadAllDbChannels])

  async function handleToggleFavorite(id) {
    const newVal = await window.api.toggleFavorite?.(id)
    if (newVal !== null && newVal !== undefined) {
      updateVideo(id, { isFavorite: newVal })
      const patchFn = (v) => (v.id === id ? { ...v, isFavorite: newVal } : v)
      setMissedVideos((prev) => prev.map(patchFn))
      setArchiveVideos((prev) => prev.map(patchFn))
      setFavoriteVideos((prev) => prev.map(patchFn))
    }
  }

  async function handleTogglePin(channelId) {
    const newVal = await window.api.togglePin?.(channelId)
    if (newVal !== null && newVal !== undefined) {
      setPinnedChannelIds((prev) => {
        const next = new Set(prev)
        if (newVal) next.add(channelId)
        else next.delete(channelId)
        return next
      })
    }
  }

  async function handleToggleNotify(id) {
    const newVal = await window.api.toggleNotify?.(id)
    if (newVal !== null && newVal !== undefined) {
      updateVideo(id, { isNotify: newVal })
      const patchFn = (v) => (v.id === id ? { ...v, isNotify: newVal } : v)
      setMissedVideos((prev) => prev.map(patchFn))
      setArchiveVideos((prev) => prev.map(patchFn))
      setFavoriteVideos((prev) => prev.map(patchFn))
    }
  }

  // 自動アップデートイベントの購読
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    window.api.onUpdateAvailable(() => setUpdateStatus('downloading'))
    window.api.onUpdateDownloaded(() => setUpdateStatus('ready'))
    window.api.onUpdaterError((msg) => {
      setUpdateStatus(null)
      setToast(`更新エラー: ${msg}`)
    })
  }, [])

  // 自動リフレッシュ（10分ごと）
  useEffect(() => {
    if (!isAuthenticated) return
    const id = setInterval(() => refreshRef.current(), 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [isAuthenticated])

  useEffect(() => {
    if (error === 'QUOTA_EXCEEDED') {
      const id = setTimeout(() => setToast('本日の API 上限に達しました'), 0)
      return () => clearTimeout(id)
    }
  }, [error])

  // タブ別チャンネル一覧（ピン済みを先頭に・表示中データから動的生成）
  const tabChannels = useMemo(() => {
    let source
    if (activeTab === 'schedule') source = [...live, ...upcoming]
    else if (activeTab === 'missed') source = missedVideos
    else if (activeTab === 'archive') source = archiveVideos
    else if (activeTab === 'favorites') source = favoriteVideos
    else source = []
    const map = new Map()
    for (const item of source) {
      if (!map.has(item.channelId)) map.set(item.channelId, item.channelTitle)
    }
    return [...map.entries()]
      .map(([id, title]) => ({ id, title, isPinned: pinnedChannelIds.has(id) }))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return a.title.localeCompare(b.title)
      })
  }, [activeTab, live, upcoming, missedVideos, archiveVideos, favoriteVideos, pinnedChannelIds])

  // フィルタリング
  const matchesQuery = useCallback(
    (item) => {
      const q = searchQuery.trim().toLowerCase()
      if (!q) return true
      return (
        (item.title ?? '').toLowerCase().includes(q) ||
        (item.channelTitle ?? '').toLowerCase().includes(q)
      )
    },
    [searchQuery]
  )
  const filterItem = useCallback(
    (item) => {
      const matchesChannel = selectedChannel === 'all' || item.channelId === selectedChannel
      return matchesQuery(item) && matchesChannel
    },
    [matchesQuery, selectedChannel]
  )
  const filteredLive = useMemo(() => live.filter(filterItem), [live, filterItem])
  const filteredUpcoming = useMemo(() => upcoming.filter(filterItem), [upcoming, filterItem])
  const filteredMissed = useMemo(() => missedVideos.filter(filterItem), [missedVideos, filterItem])
  const filteredArchiveVideos = useMemo(
    () => archiveVideos.filter(filterItem),
    [archiveVideos, filterItem]
  )
  const filteredFavorites = useMemo(
    () =>
      favoriteVideos
        .filter(filterItem)
        .sort((a, b) => (a.viewedAt != null ? 1 : 0) - (b.viewedAt != null ? 1 : 0)),
    [favoriteVideos, filterItem]
  )

  function handleSearchQueryChange(v) {
    setSearchQuery(v)
    if (activeTab === 'archive') runArchiveSearch(v)
  }

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

  const textColor = darkMode ? '#e8e8f0' : '#111120'
  const subColor = darkMode ? '#7878a0' : '#6060a0'
  const inputBg = darkMode ? '#16161e' : '#ffffff'
  const inputBorder = darkMode ? '#2a2a38' : '#dddde8'
  const subBtnBg = darkMode ? '#1e1e2c' : '#ebebf5'
  const subBtnColor = darkMode ? '#8888b0' : '#555570'

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
      {/* ヘッダー行1 */}
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

      {/* ヘッダー行2: 共通検索・チャンネルフィルター */}
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
          <>
            {/* チャンネルフィルター（ラベル付きグループ） */}
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
          </>
        )}
      </div>

      {/* タブバー（ピル型） */}
      <div className="yt-tabs">
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

      {/* 予定・ライブタブ */}
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

      {/* 見逃しタブ */}
      {activeTab === 'missed' && (
        <div>
          {tabLoading ? (
            <div style={{ textAlign: 'center', color: subColor, marginTop: '48px' }}>
              読み込み中...
            </div>
          ) : filteredMissed.length === 0 ? (
            <div style={{ textAlign: 'center', color: subColor, marginTop: '48px' }}>
              {(searchQuery.trim() || selectedChannel !== 'all') && missedVideos.length > 0
                ? '検索結果がありません'
                : '見逃した配信はありません 🎉'}
            </div>
          ) : (
            filteredMissed.map((item) => renderTabCard(item))
          )}
        </div>
      )}

      {/* アーカイブタブ */}
      {activeTab === 'archive' && (
        <div>
          {tabLoading ? (
            <div style={{ textAlign: 'center', color: subColor, marginTop: '32px' }}>
              読み込み中...
            </div>
          ) : filteredArchiveVideos.length === 0 ? (
            <div style={{ textAlign: 'center', color: subColor, marginTop: '32px' }}>
              {searchQuery.trim() || selectedChannel !== 'all'
                ? '検索結果がありません'
                : 'アーカイブがありません'}
            </div>
          ) : (
            <>
              {filteredArchiveVideos.map((item) => renderTabCard(item))}
              {archiveHasMore && <div ref={archiveSentinelRef} style={{ height: '1px' }} />}
              {archiveLoadingMore && (
                <div style={{ textAlign: 'center', color: subColor, padding: '16px' }}>
                  読み込み中...
                </div>
              )}
              {!archiveHasMore && filteredArchiveVideos.length > 0 && !searchQuery.trim() && (
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

      {/* お気に入りタブ */}
      {activeTab === 'favorites' && (
        <div>
          {tabLoading ? (
            <div style={{ textAlign: 'center', color: subColor, marginTop: '48px' }}>
              読み込み中...
            </div>
          ) : filteredFavorites.length === 0 ? (
            <div style={{ textAlign: 'center', color: subColor, marginTop: '48px' }}>
              {(searchQuery.trim() || selectedChannel !== 'all') && favoriteVideos.length > 0
                ? '検索結果がありません'
                : 'お気に入りはまだありません'}
            </div>
          ) : (
            (() => {
              const unviewed = filteredFavorites.filter((item) => item.viewedAt == null)
              const viewed = filteredFavorites.filter((item) => item.viewedAt != null)
              return (
                <>
                  {unviewed.map((item) =>
                    renderTabCard(item, {
                      showStatusBadge: true,
                      showViewedButton: item.status === 'ended'
                    })
                  )}
                  {viewed.length > 0 && (
                    <>
                      <div
                        className="yt-section-label"
                        style={{ color: subColor, marginTop: unviewed.length > 0 ? '16px' : 0 }}
                      >
                        ✓ 視聴済み
                      </div>
                      {viewed.map((item) =>
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
        onDarkModeChange={(val) => {
          setDarkMode(val)
        }}
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

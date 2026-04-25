import { useState, useEffect, useCallback, useRef, useMemo, Component } from 'react'
import PropTypes from 'prop-types'
import AuthScreen from '../components/AuthScreen.jsx'
import ScheduleCard from '../components/ScheduleCard.jsx'
import ScheduleList from '../components/ScheduleList.jsx'
import StatusBanners from '../components/StatusBanners.jsx'
import SettingsModal from '../components/SettingsModal.jsx'
import { useSchedule } from '../hooks/useSchedule.js'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development'
      return (
        <div style={{ padding: 24, color: '#cc0000', fontFamily: 'monospace' }}>
          <h2>エラーが発生しました</h2>
          <pre>{this.state.error.message}</pre>
          {isDev && <pre>{this.state.error.stack}</pre>}
        </div>
      )
    }
    return this.props.children
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired
}

function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#333',
        color: 'white',
        padding: '10px 24px',
        borderRadius: '8px',
        fontSize: '14px',
        zIndex: 1000
      }}
    >
      {message}
    </div>
  )
}

Toast.propTypes = {
  message: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired
}

function BackToTop() {
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 200)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: hovered ? 'auto' : '40px',
        height: '40px',
        padding: hovered ? '0 16px' : '0',
        background: '#333',
        color: '#fff',
        border: 'none',
        borderRadius: '20px',
        cursor: 'pointer',
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'width 0.2s ease, padding 0.2s ease, background 0.15s ease',
        overflow: 'hidden',
        zIndex: 999
      }}
      title="トップへ戻る"
    >
      ↑{hovered && <span>トップへ</span>}
    </button>
  )
}

function CredentialsSetupScreen({ credentialsPath }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '32px 16px',
        fontFamily: 'sans-serif',
        background: '#f5f5f5'
      }}
    >
      <div
        style={{
          maxWidth: '560px',
          width: '100%',
          background: '#fff',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)'
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            background: '#fff3cd',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            marginBottom: '16px'
          }}
        >
          ⚠️
        </div>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111', marginBottom: '8px' }}>
          credentials.json が見つかりません
        </h1>
        <p style={{ fontSize: '13px', color: '#555', marginBottom: '20px', lineHeight: 1.6 }}>
          このアプリを使うには、Google Cloud Console で取得した OAuth
          認証ファイルを以下のパスに配置してください。
        </p>

        <div
          style={{
            background: '#f4f4f4',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#333',
            wordBreak: 'break-all',
            marginBottom: '8px'
          }}
        >
          {credentialsPath || '（パスを取得できませんでした）'}
        </div>

        {credentialsPath && (
          <button
            onClick={() => window.api.openFolder(credentialsPath)}
            style={{
              display: 'block',
              marginBottom: '24px',
              padding: '6px 14px',
              fontSize: '12px',
              background: '#e8f0fe',
              color: '#1a73e8',
              border: '1px solid #c5d8fb',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            フォルダを開く
          </button>
        )}

        <ol
          style={{
            fontSize: '13px',
            color: '#444',
            lineHeight: 2,
            paddingLeft: '20px',
            marginBottom: '24px'
          }}
        >
          <li>
            <button
              onClick={() => window.api.openExternal('https://console.cloud.google.com/')}
              style={{
                background: 'none',
                border: 'none',
                color: '#1a73e8',
                cursor: 'pointer',
                fontSize: '13px',
                padding: 0,
                textDecoration: 'underline'
              }}
            >
              Google Cloud Console
            </button>
            でプロジェクトを作成
          </li>
          <li>YouTube Data API v3 を有効化</li>
          <li>OAuth クライアント ID を作成（種類：デスクトップアプリ）</li>
          <li>
            JSON をダウンロードし、ファイル名を{' '}
            <code style={{ background: '#f4f4f4', padding: '1px 4px', borderRadius: '3px' }}>
              credentials.json
            </code>{' '}
            に変更
          </li>
          <li>上記のフォルダに配置してアプリを再起動</li>
        </ol>

        <button
          onClick={() => window.location.reload()}
          style={{
            width: '100%',
            padding: '10px',
            background: '#FF0000',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          再起動（配置後）
        </button>
      </div>
    </div>
  )
}

CredentialsSetupScreen.propTypes = {
  credentialsPath: PropTypes.string
}

function UpdateBanner({ status, onInstall }) {
  if (!status) return null
  const isDownloading = status === 'downloading'
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2000,
        background: isDownloading ? '#555' : '#1a73e8',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '8px 16px',
        fontSize: '13px'
      }}
    >
      {isDownloading ? (
        <span>更新をダウンロード中...</span>
      ) : (
        <>
          <span>新しいバージョンの準備ができました</span>
          <button
            onClick={onInstall}
            style={{
              padding: '4px 14px',
              background: '#fff',
              color: '#1a73e8',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '12px'
            }}
          >
            再起動して更新
          </button>
        </>
      )}
    </div>
  )
}

UpdateBanner.propTypes = {
  status: PropTypes.oneOf(['downloading', 'ready', null]),
  onInstall: PropTypes.func.isRequired
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [credentialsMissing, setCredentialsMissing] = useState(false)
  const [credentialsPath, setCredentialsPath] = useState('')
  const [toast, setToast] = useState(null)
  const [updateStatus, setUpdateStatus] = useState(null)
  const [appVersion, setAppVersion] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    window.api.getVersion().then((v) => setAppVersion(v))
  }, [])
  const { live, upcoming, loading, error, dbBroken, refresh, updateVideo } = useSchedule()
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

  // ダークモード（electron-store で永続化）
  const [darkMode, setDarkMode] = useState(false)
  const darkModeLoaded = useRef(false)
  useEffect(() => {
    window.api.getSetting('darkMode', false).then((val) => {
      darkModeLoaded.current = true
      setDarkMode(val)
    })
  }, [])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    if (darkModeLoaded.current) {
      window.api.setSetting('darkMode', darkMode)
    }
  }, [darkMode])

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
        data = (await window.api.searchByText?.(q, { ...SEARCH_TARGETS, limit: SEARCH_LIMIT })) ?? []
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
        data = (await window.api.searchByText?.(query, { ...SEARCH_TARGETS, limit: SEARCH_LIMIT })) ?? []
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
  const [modalChannels, setModalChannels] = useState([])
  const [showChannelManager, setShowChannelManager] = useState(false)
  const [channelManagerQuery, setChannelManagerQuery] = useState('')

  const loadAllDbChannels = useCallback(() => {
    window.api.listAllChannels?.().then((chs) => {
      setPinnedChannelIds(new Set((chs ?? []).filter((c) => c.isPinned).map((c) => c.id)))
    })
  }, [])

  function openChannelManager() {
    window.api.listAllChannels?.().then((chs) => {
      const list = chs ?? []
      setPinnedChannelIds(new Set(list.filter((c) => c.isPinned).map((c) => c.id)))
      setModalChannels(
        [...list].sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
          return (a.title ?? '').localeCompare(b.title ?? '', 'ja')
        })
      )
      setShowChannelManager(true)
    })
  }

  useEffect(() => {
    loadAllDbChannels()
  }, [])

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
      setModalChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, isPinned: newVal } : c))
      )
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

  // 通知チェック用 ref（interval クロージャでの stale 防止）
  const upcomingRef = useRef(upcoming)
  useEffect(() => {
    upcomingRef.current = upcoming
  }, [upcoming])
  const notifiedRef = useRef(new Set())
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  // 自動アップデートイベントの購読

  useEffect(() => {
    window.api.onUpdateAvailable(() => setUpdateStatus('downloading'))
    window.api.onUpdateDownloaded(() => setUpdateStatus('ready'))
    window.api.onUpdaterError((msg) => {
      setUpdateStatus(null)
      setToast(`更新エラー: ${msg}`)
    })
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const result = await window.api.checkAuth()
        if (result.error === 'CREDENTIALS_NOT_FOUND') {
          setCredentialsMissing(true)
          setCredentialsPath(result.credentialsPath || '')
        } else {
          setIsAuthenticated(result.isAuthenticated)
          if (result.isAuthenticated) refresh()
        }
      } catch {
        // silent
      } finally {
        setAuthLoading(false)
      }
    })()
  }, [])

  // 自動リフレッシュ（10分ごと）
  useEffect(() => {
    if (!isAuthenticated) return
    const id = setInterval(() => refreshRef.current(), 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [isAuthenticated])

  // 通知チェック（1分ごと）
  useEffect(() => {
    if (!isAuthenticated) return
    const THRESHOLD = 5 * 60 * 1000
    const id = setInterval(() => {
      const now = Date.now()
      for (const item of upcomingRef.current) {
        if (!item.isNotify) continue
        if (notifiedRef.current.has(item.id)) continue
        const start = new Date(item.scheduledStartTime).getTime()
        const remaining = start - now
        if (remaining > 0 && remaining <= THRESHOLD) {
          notifiedRef.current.add(item.id)
          window.api?.showNotification?.(
            'もうすぐ配信開始',
            `${item.channelTitle}「${item.title}」が5分後に始まります`
          )
        }
      }
    }, 60 * 1000)
    return () => clearInterval(id)
  }, [isAuthenticated])

  useEffect(() => {
    if (error === 'QUOTA_EXCEEDED') {
      const id = setTimeout(() => setToast('本日の API 上限に達しました'), 0)
      return () => clearTimeout(id)
    }
  }, [error])

  // チャンネル一覧（ピン済みを先頭に）
  const channels = useMemo(() => {
    const map = new Map()
    for (const item of [...live, ...upcoming]) {
      if (!map.has(item.channelId)) map.set(item.channelId, item.channelTitle)
    }
    return [...map.entries()]
      .map(([id, title]) => ({ id, title, isPinned: pinnedChannelIds.has(id) }))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return a.title.localeCompare(b.title)
      })
  }, [live, upcoming, pinnedChannelIds])

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
  const filteredMissed = useMemo(() => missedVideos.filter(matchesQuery), [missedVideos, matchesQuery])
  const filteredFavorites = useMemo(
    () =>
      favoriteVideos
        .filter(matchesQuery)
        .sort((a, b) => (a.viewedAt != null ? 1 : 0) - (b.viewedAt != null ? 1 : 0)),
    [favoriteVideos, matchesQuery]
  )

  function handleSearchQueryChange(v) {
    setSearchQuery(v)
    if (activeTab === 'archive') runArchiveSearch(v)
  }

  async function handleLogin() {
    setAuthLoading(true)
    const result = await window.api.login()
    setAuthLoading(false)
    if (result.isAuthenticated) {
      setLoginSuccess(true)
      setTimeout(() => {
        setLoginSuccess(false)
        setIsAuthenticated(true)
        refresh()
      }, 2000)
    }
  }

  async function handleLogout() {
    await window.api.logout()
    setIsAuthenticated(false)
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

  const textColor   = darkMode ? '#e8e8f0' : '#111120'
  const subColor    = darkMode ? '#7878a0' : '#6060a0'
  const inputBg     = darkMode ? '#16161e' : '#ffffff'
  const inputBorder = darkMode ? '#2a2a38' : '#dddde8'
  const subBtnBg    = darkMode ? '#1e1e2c' : '#ebebf5'
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
            <span style={{ fontSize: '11px', fontWeight: 'normal', color: subColor, fontFamily: 'inherit', letterSpacing: 0 }}>
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
          <span style={{
            position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
            color: subColor, fontSize: '13px', pointerEvents: 'none', lineHeight: 1
          }}>🔍</span>
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
        {activeTab === 'schedule' && channels.length > 0 && (
          <>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              style={{
                padding: '8px 10px',
                fontSize: '13px',
                background: inputBg,
                color: textColor,
                border: `1px solid ${inputBorder}`,
                borderRadius: '8px',
                cursor: 'pointer',
                maxWidth: '200px',
                fontFamily: 'inherit'
              }}
            >
              <option value="all">すべてのチャンネル</option>
              {channels.map(({ id, title, isPinned }) => (
                <option key={id} value={id}>
                  {isPinned ? '📌 ' : ''}
                  {title}
                </option>
              ))}
            </select>
            <button
              title="チャンネル管理（優先チャンネルを設定）"
              onClick={() => openChannelManager()}
              style={{
                padding: '7px 12px',
                fontSize: '14px',
                background: pinnedChannelIds.size > 0
                  ? (darkMode ? 'rgba(255,201,64,0.15)' : 'rgba(212,144,10,0.1)')
                  : subBtnBg,
                color: pinnedChannelIds.size > 0
                  ? (darkMode ? '#ffc940' : '#d4900a')
                  : subBtnColor,
                border: `1px solid ${pinnedChannelIds.size > 0
                  ? (darkMode ? 'rgba(255,201,64,0.4)' : 'rgba(212,144,10,0.35)')
                  : inputBorder}`,
                borderRadius: '8px',
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              📌
            </button>
          </>
        )}
      </div>

      {/* チャンネル管理モーダル */}
      {showChannelManager && (
        <div
          onClick={() => { setShowChannelManager(false); setChannelManagerQuery('') }}
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
              background: darkMode ? '#16161e' : '#ffffff',
              color: textColor,
              borderRadius: '14px',
              padding: '24px',
              width: '620px',
              maxWidth: '92vw',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              border: `1px solid ${inputBorder}`,
              boxShadow: darkMode
                ? '0 20px 60px rgba(0,0,0,0.7)'
                : '0 12px 40px rgba(0,0,0,0.15)'
            }}
          >
            {/* モーダルヘッダー */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 className="yt-display" style={{ margin: 0, fontSize: '20px', color: textColor }}>
                チャンネル管理
              </h2>
              <button
                onClick={() => { setShowChannelManager(false); setChannelManagerQuery('') }}
                style={{
                  width: '28px', height: '28px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
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
            <p style={{ margin: 0, fontSize: '12px', color: subColor }}>
              優先設定したチャンネルが予定・ライブ一覧の上部に表示されます。
            </p>

            {/* 検索欄 */}
            <input
              type="text"
              placeholder="チャンネル名で絞り込み"
              value={channelManagerQuery}
              onChange={(e) => setChannelManagerQuery(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                background: darkMode ? '#1e1e28' : '#f4f4fb',
                color: textColor,
                border: `1px solid ${inputBorder}`,
                borderRadius: '8px',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />

            {/* チャンネル一覧 */}
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {modalChannels
                .filter(({ title }) =>
                  channelManagerQuery === '' ||
                  (title ?? '').toLowerCase().includes(channelManagerQuery.toLowerCase())
                )
                .map(({ id, title }) => {
                  const isPinned = pinnedChannelIds.has(id)
                  return (
                    <div
                      key={id}
                      className={`yt-ch-row${isPinned ? ' yt-ch-row--pinned' : ''}`}
                    >
                      <span style={{
                        flex: 1, fontSize: '13px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: isPinned ? (darkMode ? '#ffc940' : '#d4900a') : textColor
                      }}>
                        {isPinned && <span style={{ marginRight: '5px' }}>📌</span>}
                        {title}
                      </span>
                      <button
                        onClick={() => handleTogglePin(id)}
                        title={isPinned ? '優先解除' : '優先に設定'}
                        style={{
                          flexShrink: 0,
                          padding: '4px 12px',
                          fontSize: '12px',
                          background: isPinned
                            ? (darkMode ? 'rgba(255,201,64,0.15)' : 'rgba(212,144,10,0.1)')
                            : subBtnBg,
                          color: isPinned
                            ? (darkMode ? '#ffc940' : '#d4900a')
                            : subBtnColor,
                          border: `1px solid ${isPinned
                            ? (darkMode ? 'rgba(255,201,64,0.4)' : 'rgba(212,144,10,0.3)')
                            : inputBorder}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: isPinned ? '700' : 'normal',
                          fontFamily: 'inherit'
                        }}
                      >
                        {isPinned ? '優先中' : '優先'}
                      </button>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

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
              {searchQuery.trim() && missedVideos.length > 0
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
          ) : archiveVideos.length === 0 ? (
            <div style={{ textAlign: 'center', color: subColor, marginTop: '32px' }}>
              {searchQuery.trim() ? '検索結果がありません' : 'アーカイブがありません'}
            </div>
          ) : (
            <>
              {archiveVideos.map((item) => renderTabCard(item))}
              {archiveHasMore && (
                <div ref={archiveSentinelRef} style={{ height: '1px' }} />
              )}
              {archiveLoadingMore && (
                <div style={{ textAlign: 'center', color: subColor, padding: '16px' }}>
                  読み込み中...
                </div>
              )}
              {!archiveHasMore && archiveVideos.length > 0 && !searchQuery.trim() && (
                <div style={{ textAlign: 'center', color: subColor, fontSize: '12px', padding: '16px' }}>
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
              {searchQuery.trim() && favoriteVideos.length > 0
                ? '検索結果がありません'
                : 'お気に入りはまだありません'}
            </div>
          ) : (
            (() => {
              const unviewed = filteredFavorites.filter((item) => item.viewedAt == null)
              const viewed = filteredFavorites.filter((item) => item.viewedAt != null)
              return (
                <>
                  {unviewed.map((item) => renderTabCard(item, { showStatusBadge: true }))}
                  {viewed.length > 0 && (
                    <>
                      <div className="yt-section-label" style={{ color: subColor, marginTop: unviewed.length > 0 ? '16px' : 0 }}>
                        ✓ 視聴済み
                      </div>
                      {viewed.map((item) => renderTabCard(item, { showStatusBadge: true }))}
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
          window.api.setSetting('darkMode', val)
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

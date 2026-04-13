import { useState, useEffect, useCallback, useRef, useMemo, Component } from 'react'
import PropTypes from 'prop-types'
import AuthScreen from '../components/AuthScreen.jsx'
import ScheduleList from '../components/ScheduleList.jsx'
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
          このアプリを使うには、Google Cloud Console で取得した
          OAuth 認証ファイルを以下のパスに配置してください。
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
            marginBottom: '24px'
          }}
        >
          {credentialsPath || '（パスを取得できませんでした）'}
        </div>

        <ol style={{ fontSize: '13px', color: '#444', lineHeight: 2, paddingLeft: '20px', marginBottom: '24px' }}>
          <li>
            <button
              onClick={() => window.api.openExternal('https://console.cloud.google.com/')}
              style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: '13px', padding: 0, textDecoration: 'underline' }}
            >
              Google Cloud Console
            </button>
            でプロジェクトを作成
          </li>
          <li>YouTube Data API v3 を有効化</li>
          <li>OAuth クライアント ID を作成（種類：デスクトップアプリ）</li>
          <li>JSON をダウンロードし、ファイル名を <code style={{ background: '#f4f4f4', padding: '1px 4px', borderRadius: '3px' }}>credentials.json</code> に変更</li>
          <li>上記のパスに配置してアプリを再起動</li>
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

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [credentialsMissing, setCredentialsMissing] = useState(false)
  const [credentialsPath, setCredentialsPath] = useState('')
  const [toast, setToast] = useState(null)
  const { live, upcoming, loading, error, fromCache, refresh } = useSchedule()
  const handleToastClose = useCallback(() => setToast(null), [])

  // ダークモード
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true')
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('darkMode', darkMode)
  }, [darkMode])

  // 検索・フィルター
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('all')

  // 通知対象
  const [watchedIds, setWatchedIds] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('watchedIds') || '[]'))
    } catch {
      return new Set()
    }
  })

  function toggleWatch(id) {
    setWatchedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem('watchedIds', JSON.stringify([...next]))
      return next
    })
  }

  // 通知チェック用 ref（interval クロージャでの stale 防止）
  const upcomingRef = useRef(upcoming)
  useEffect(() => { upcomingRef.current = upcoming }, [upcoming])
  const watchedIdsRef = useRef(watchedIds)
  useEffect(() => { watchedIdsRef.current = watchedIds }, [watchedIds])
  const notifiedRef = useRef(new Set())
  const refreshRef = useRef(refresh)
  useEffect(() => { refreshRef.current = refresh }, [refresh])

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
        if (!watchedIdsRef.current.has(item.id)) continue
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

  // チャンネル一覧
  const channels = useMemo(() => {
    const map = new Map()
    for (const item of [...live, ...upcoming]) {
      if (!map.has(item.channelId)) map.set(item.channelId, item.channelTitle)
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [live, upcoming])

  // フィルタリング
  const filterItem = useCallback(
    (item) => {
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !q || item.title.toLowerCase().includes(q) || item.channelTitle.toLowerCase().includes(q)
      const matchesChannel = selectedChannel === 'all' || item.channelId === selectedChannel
      return matchesSearch && matchesChannel
    },
    [searchQuery, selectedChannel]
  )
  const filteredLive = useMemo(() => live.filter(filterItem), [live, filterItem])
  const filteredUpcoming = useMemo(() => upcoming.filter(filterItem), [upcoming, filterItem])

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

  const bg = darkMode ? '#1b1b1f' : '#f5f5f5'
  const textColor = darkMode ? '#f0f0f0' : '#111'
  const inputBg = darkMode ? '#2a2a2e' : '#fff'
  const inputBorder = darkMode ? '#444' : '#ddd'
  const subBtnBg = darkMode ? '#3a3a3e' : '#f0f0f0'
  const subBtnColor = darkMode ? '#ccc' : '#333'

  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '16px',
        fontFamily: 'sans-serif',
        color: textColor,
        minHeight: '100vh',
        background: bg
      }}
    >
      {/* ヘッダー行1 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
          flexWrap: 'wrap'
        }}
      >
        <h1 style={{ fontSize: '20px', fontWeight: 'bold', flex: 1, color: textColor }}>
          YouTube 配信予定
        </h1>
        {fromCache && <span style={{ fontSize: '12px', color: '#888' }}>キャッシュ表示中</span>}
        <button
          onClick={refresh}
          disabled={loading}
          style={{
            padding: '6px 16px',
            background: '#FF0000',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            fontSize: '13px'
          }}
        >
          {loading ? '更新中...' : '更新'}
        </button>
        <button
          onClick={handleLogout}
          style={{
            padding: '6px 12px',
            background: subBtnBg,
            color: subBtnColor,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          ログアウト
        </button>
        <button
          onClick={() => setDarkMode((d) => !d)}
          title={darkMode ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
          style={{
            padding: '6px 10px',
            background: subBtnBg,
            color: subBtnColor,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>

      {/* ヘッダー行2: 検索・チャンネルフィルター */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap'
        }}
      >
        <input
          type="text"
          placeholder="タイトル・チャンネルを検索"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: '160px',
            padding: '6px 10px',
            fontSize: '13px',
            background: inputBg,
            color: textColor,
            border: `1px solid ${inputBorder}`,
            borderRadius: '6px',
            outline: 'none'
          }}
        />
        {channels.length > 0 && (
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '13px',
              background: inputBg,
              color: textColor,
              border: `1px solid ${inputBorder}`,
              borderRadius: '6px',
              cursor: 'pointer',
              maxWidth: '200px'
            }}
          >
            <option value="all">すべてのチャンネル</option>
            {channels.map(([channelId, channelTitle]) => (
              <option key={channelId} value={channelId}>
                {channelTitle}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && error !== 'QUOTA_EXCEEDED' && (
        <div
          style={{
            background: '#fff3f3',
            border: '1px solid #ffcccc',
            borderRadius: '6px',
            padding: '8px 12px',
            marginBottom: '12px',
            fontSize: '13px',
            color: '#cc0000'
          }}
        >
          {error === 'NOT_AUTHENTICATED' ? '認証が必要です' : 'データの取得に失敗しました'}
        </div>
      )}

      <ScheduleList
        live={filteredLive}
        upcoming={filteredUpcoming}
        darkMode={darkMode}
        watchedIds={watchedIds}
        onToggleWatch={toggleWatch}
      />
      {toast && <Toast message={toast} onClose={handleToastClose} />}
      <BackToTop />
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import AuthScreen from './components/AuthScreen.jsx'
import ScheduleList from './components/ScheduleList.jsx'
import { useSchedule } from './hooks/useSchedule.js'

function Toast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#333', color: 'white', padding: '10px 24px',
      borderRadius: '8px', fontSize: '14px', zIndex: 1000,
    }}>
      {message}
    </div>
  )
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const { live, upcoming, loading, error, fromCache, refresh } = useSchedule()
  const handleToastClose = useCallback(() => setToast(null), [])

  useEffect(() => {
    window.api.checkAuth()
      .then(({ isAuthenticated }) => {
        setIsAuthenticated(isAuthenticated)
      })
      .catch(() => {
        // 認証確認失敗時は未認証扱いにする
      })
      .finally(() => {
        setAuthLoading(false)
      })
  }, [])

  useEffect(() => {
    if (error === 'QUOTA_EXCEEDED') {
      setToast('本日の API 上限に達しました')
    }
  }, [error])

  async function handleLogin() {
    setAuthLoading(true)
    const result = await window.api.login()
    setIsAuthenticated(result.isAuthenticated)
    setAuthLoading(false)
  }

  async function handleLogout() {
    await window.api.logout()
    setIsAuthenticated(false)
  }

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        読み込み中...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AuthScreen onLogin={handleLogin} loading={authLoading} />
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '16px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 'bold' }}>YouTube 配信予定</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {fromCache && <span style={{ fontSize: '12px', color: '#888' }}>キャッシュ表示中</span>}
          <button
            onClick={refresh}
            disabled={loading}
            style={{
              padding: '6px 16px', background: '#FF0000', color: 'white',
              border: 'none', borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '更新中...' : '更新'}
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: '6px 12px', background: '#f0f0f0', color: '#333',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
            }}
          >
            ログアウト
          </button>
        </div>
      </div>
      {error && error !== 'QUOTA_EXCEEDED' && (
        <div style={{
          background: '#fff3f3', border: '1px solid #ffcccc', borderRadius: '6px',
          padding: '8px 12px', marginBottom: '12px', fontSize: '13px', color: '#cc0000',
        }}>
          {error === 'NOT_AUTHENTICATED' ? '認証が必要です' : 'データの取得に失敗しました'}
        </div>
      )}
      <ScheduleList live={live} upcoming={upcoming} />
      {toast && <Toast message={toast} onClose={handleToastClose} />}
    </div>
  )
}

export default function AuthScreen({ onLogin, loading }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: '24px',
    }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>
        YouTube 配信予定
      </h1>
      <p style={{ color: '#666' }}>Google アカウントでログインして配信予定を確認</p>
      <button
        onClick={onLogin}
        disabled={loading}
        style={{
          padding: '12px 32px', fontSize: '16px', borderRadius: '8px',
          background: '#FF0000', color: 'white', border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? '認証中...' : 'Google でログイン'}
      </button>
    </div>
  )
}

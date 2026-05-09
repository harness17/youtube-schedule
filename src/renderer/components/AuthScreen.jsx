import PropTypes from 'prop-types'
import youtomLogo from '../src/assets/youtom-logo.svg'

export default function AuthScreen({ onLogin, loading }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: '24px'
      }}
    >
      <img
        src={youtomLogo}
        alt=""
        style={{ width: '72px', height: '72px', borderRadius: '16px' }}
      />
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>Youtom</h1>
        <p style={{ color: '#666', margin: '8px 0 0' }}>
          Google アカウントでログインして配信予定を確認
        </p>
      </div>
      <button
        onClick={onLogin}
        disabled={loading}
        style={{
          padding: '12px 32px',
          fontSize: '16px',
          borderRadius: '8px',
          background: '#FF0000',
          color: 'white',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1
        }}
      >
        {loading ? '認証中...' : 'Google でログイン'}
      </button>
    </div>
  )
}

AuthScreen.propTypes = {
  onLogin: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired
}

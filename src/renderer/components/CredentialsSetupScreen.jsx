import PropTypes from 'prop-types'

export default function CredentialsSetupScreen({ credentialsPath }) {
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

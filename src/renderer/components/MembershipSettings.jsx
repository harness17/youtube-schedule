import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

const MAX_CHANNELS = 4

export default function MembershipSettings({ darkMode, onClose }) {
  const [channels, setChannels] = useState([])
  const [input, setInput] = useState('')
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')

  const bg = darkMode ? '#1b1b1f' : '#fff'
  const overlayBg = 'rgba(0,0,0,0.5)'
  const textColor = darkMode ? '#f0f0f0' : '#111'
  const inputBg = darkMode ? '#2a2a2e' : '#f9f9f9'
  const inputBorder = darkMode ? '#555' : '#ddd'
  const rowBg = darkMode ? '#2a2a2e' : '#f5f5f5'
  const subColor = darkMode ? '#aaa' : '#666'

  useEffect(() => {
    window.api.getMembershipChannels().then(setChannels)
  }, [])

  async function handleAdd() {
    const trimmed = input.trim()
    if (!trimmed) return
    if (channels.length >= MAX_CHANNELS) {
      setResolveError(`登録できるのは最大 ${MAX_CHANNELS} チャンネルまでです`)
      return
    }
    setResolving(true)
    setResolveError('')
    const result = await window.api.resolveChannel(trimmed)
    setResolving(false)
    if (result.error) {
      setResolveError(
        result.error === 'NOT_AUTHENTICATED' ? '認証が必要です' : 'チャンネルが見つかりません'
      )
      return
    }
    if (channels.some((c) => c.channelId === result.channelId)) {
      setResolveError('すでに登録済みです')
      return
    }
    const updated = [
      ...channels,
      { channelId: result.channelId, channelTitle: result.channelTitle }
    ]
    setChannels(updated)
    await window.api.setMembershipChannels(updated)
    setInput('')
  }

  async function handleDelete(channelId) {
    const updated = channels.filter((c) => c.channelId !== channelId)
    setChannels(updated)
    await window.api.setMembershipChannels(updated)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleAdd()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: overlayBg,
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: bg,
          color: textColor,
          borderRadius: '12px',
          padding: '24px',
          width: '480px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}
      >
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
              メンバーシップチャンネル
            </h2>
            <p style={{ fontSize: '12px', color: subColor, margin: '4px 0 0' }}>
              メンバー限定配信を取得するチャンネルを登録します（最大 {MAX_CHANNELS} 件）
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: subColor,
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* 入力欄 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                setResolveError('')
              }}
              onKeyDown={handleKeyDown}
              placeholder="チャンネルURL / ID / @ハンドル"
              style={{
                flex: 1,
                padding: '8px 10px',
                fontSize: '13px',
                background: inputBg,
                color: textColor,
                border: `1px solid ${resolveError ? '#cc0000' : inputBorder}`,
                borderRadius: '6px',
                outline: 'none'
              }}
            />
            <button
              onClick={handleAdd}
              disabled={resolving || !input.trim() || channels.length >= MAX_CHANNELS}
              style={{
                padding: '8px 16px',
                background:
                  resolving || !input.trim() || channels.length >= MAX_CHANNELS
                    ? '#ccc'
                    : '#FF0000',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor:
                  resolving || !input.trim() || channels.length >= MAX_CHANNELS
                    ? 'not-allowed'
                    : 'pointer',
                fontSize: '13px',
                whiteSpace: 'nowrap'
              }}
            >
              {resolving ? '検索中...' : '追加'}
            </button>
          </div>
          {resolveError && (
            <p style={{ fontSize: '12px', color: '#cc0000', margin: 0 }}>{resolveError}</p>
          )}
          <p style={{ fontSize: '11px', color: subColor, margin: 0 }}>
            例: @patra_ch / https://www.youtube.com/@patra_ch / UCxxxxxxxx
          </p>
        </div>

        {/* チャンネル一覧 */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {channels.length === 0 ? (
            <p
              style={{ fontSize: '13px', color: subColor, textAlign: 'center', marginTop: '16px' }}
            >
              登録済みチャンネルはありません
            </p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              {channels.map((ch) => (
                <li
                  key={ch.channelId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: rowBg,
                    borderRadius: '6px',
                    padding: '8px 12px'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{ch.channelTitle}</span>
                    <span style={{ fontSize: '11px', color: subColor, marginLeft: '8px' }}>
                      {ch.channelId}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(ch.channelId)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#cc0000',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '2px 6px'
                    }}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* クォータ情報 */}
        <p
          style={{
            fontSize: '11px',
            color: subColor,
            margin: 0,
            borderTop: `1px solid ${inputBorder}`,
            paddingTop: '8px'
          }}
        >
          {channels.length > 0
            ? `自動更新: 2時間ごと（${channels.length}件 × 100ユニット = 約${channels.length * 1200}ユニット/日）`
            : `上限 ${MAX_CHANNELS} 件 — クォータ節約のため自動更新は2時間ごとです`}
        </p>
      </div>
    </div>
  )
}

MembershipSettings.propTypes = {
  darkMode: PropTypes.bool,
  onClose: PropTypes.func.isRequired
}

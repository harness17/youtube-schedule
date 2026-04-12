import { useState } from 'react'

function formatViewers(count) {
  const n = parseInt(count, 10)
  if (isNaN(n)) return null
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万人予定`
  return `${n.toLocaleString()}人予定`
}

function formatTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

export default function ScheduleCard({ item }) {
  const [expanded, setExpanded] = useState(false)
  const viewers = item.concurrentViewers ? formatViewers(item.concurrentViewers) : null
  const isLive = item.status === 'live'

  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        padding: '12px',
        background: '#fff',
        borderRadius: '8px',
        boxShadow: isLive ? '0 0 0 2px #FF0000' : '0 1px 4px rgba(0,0,0,0.1)',
        marginBottom: '8px',
        position: 'relative'
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img
          src={item.thumbnail}
          alt={item.title}
          style={{
            width: '160px',
            height: '90px',
            objectFit: 'cover',
            borderRadius: '4px',
            display: 'block'
          }}
        />
        {isLive && (
          <span
            style={{
              position: 'absolute',
              bottom: '4px',
              left: '4px',
              background: '#FF0000',
              color: 'white',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '2px 6px',
              borderRadius: '3px'
            }}
          >
            LIVE
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
          {item.title}
        </div>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
          {item.channelTitle}
        </div>
        <div style={{ fontSize: '12px', color: '#444', marginBottom: '4px' }}>
          {isLive
            ? `配信中（${formatTime(item.actualStartTime)}〜）`
            : `${formatTime(item.scheduledStartTime)}〜`}
          {viewers && <span style={{ marginLeft: '8px' }}>👥 {viewers}</span>}
        </div>
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            fontSize: '12px',
            color: '#555',
            cursor: 'pointer',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: expanded ? 'unset' : 2,
            marginBottom: '8px'
          }}
        >
          {item.description}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => window.api.openExternal(item.url)}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              background: '#FF0000',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            YouTube で開く
          </button>
          <button
            onClick={() => window.api.addToWatchLater(item.id)}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              background: '#f0f0f0',
              color: '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            後で見る
          </button>
          <button
            title="通知を設定"
            onClick={() => window.api.openExternal(item.channelUrl)}
            style={{
              padding: '4px 10px',
              fontSize: '14px',
              background: '#f0f0f0',
              color: '#333',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔔
          </button>
        </div>
      </div>
    </div>
  )
}

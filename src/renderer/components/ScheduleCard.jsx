import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

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

function formatCountdown(isoString) {
  if (!isoString) return null
  const diff = new Date(isoString).getTime() - Date.now()
  if (diff <= 0) return null
  const totalMinutes = Math.floor(diff / 60000)
  if (totalMinutes < 60) return `あと${totalMinutes}分`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours < 24) return minutes > 0 ? `あと${hours}時間${minutes}分` : `あと${hours}時間`
  const days = Math.floor(hours / 24)
  const remainHours = hours % 24
  return remainHours > 0 ? `あと${days}日${remainHours}時間` : `あと${days}日`
}

export default function ScheduleCard({
  item,
  darkMode = false,
  watched = false,
  onToggleWatch,
  onToggleFavorite,
  onMarkViewed,
  onTogglePin,
  isPinned = false,
  showViewedButton = false,
  isViewed = false,
  showStatusBadge = false
}) {
  const [expanded, setExpanded] = useState(false)
  const [countdown, setCountdown] = useState(() => formatCountdown(item.scheduledStartTime))

  useEffect(() => {
    if (item.status === 'live') return
    const id = setInterval(() => {
      setCountdown(formatCountdown(item.scheduledStartTime))
    }, 30000)
    return () => clearInterval(id)
  }, [item.scheduledStartTime, item.status])

  const viewers = item.concurrentViewers ? formatViewers(item.concurrentViewers) : null
  const isLive = item.status === 'live'

  const cardBg = darkMode ? '#2a2a2e' : '#fff'
  const textColor = darkMode ? '#f0f0f0' : '#111'
  const subColor = darkMode ? '#aaa' : '#666'
  const timeColor = darkMode ? '#ccc' : '#444'
  const descColor = darkMode ? '#bbb' : '#555'
  const btnBg = darkMode ? '#444' : '#f0f0f0'
  const btnColor = darkMode ? '#ccc' : '#333'

  return (
    <div
      style={{
        display: 'flex',
        gap: '12px',
        padding: '12px',
        background: cardBg,
        borderRadius: '8px',
        boxShadow: isLive ? '0 0 0 2px #FF0000' : '0 1px 4px rgba(0,0,0,0.1)',
        marginBottom: '8px',
        position: 'relative',
        borderLeft: isPinned ? '4px solid #FFD700' : undefined,
        opacity: isViewed ? 0.6 : 1
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
        <div
          style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: textColor }}
        >
          {item.title}
          {isViewed && (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                marginLeft: '6px',
                borderRadius: '4px',
                background: darkMode ? '#555' : '#ddd',
                color: darkMode ? '#fff' : '#333',
                verticalAlign: 'middle'
              }}
            >
              見た
            </span>
          )}
          {showStatusBadge && item.status === 'upcoming' && (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                marginLeft: '6px',
                borderRadius: '4px',
                background: '#1a73e8',
                color: '#fff',
                verticalAlign: 'middle',
                fontWeight: 'normal'
              }}
            >
              📅 配信予定
            </span>
          )}
          {showStatusBadge && item.status === 'live' && (
            <span
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                marginLeft: '6px',
                borderRadius: '4px',
                background: '#FF0000',
                color: '#fff',
                verticalAlign: 'middle',
                fontWeight: 'normal'
              }}
            >
              🔴 配信中
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
          <span
            onClick={(e) => {
              e.stopPropagation()
              if (item.channelId) {
                window.api.openExternal(`https://www.youtube.com/channel/${item.channelId}`)
              }
            }}
            title={item.channelTitle}
            style={{
              fontSize: '12px',
              color: isPinned ? '#D4A017' : subColor,
              fontWeight: isPinned ? 'bold' : 'normal',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: item.channelId ? 'pointer' : 'default',
              textDecoration: item.channelId ? 'underline' : 'none',
              textDecorationColor: isPinned ? '#D4A017' : subColor
            }}
          >
            {item.channelTitle}
          </span>
          <button
            title={isPinned ? '優先解除' : '優先に設定'}
            onClick={(e) => { e.stopPropagation(); onTogglePin?.(item.channelId) }}
            style={{
              flexShrink: 0,
              padding: '1px 5px',
              fontSize: '11px',
              background: isPinned ? '#FFD700' : (darkMode ? '#3a3a3e' : '#e8e8e8'),
              color: isPinned ? '#333' : (darkMode ? '#aaa' : '#666'),
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              lineHeight: '18px'
            }}
          >
            📌
          </button>
        </div>
        <div style={{ fontSize: '12px', color: timeColor, marginBottom: '4px' }}>
          {isLive
            ? `配信中（${formatTime(item.actualStartTime)}〜）`
            : `${formatTime(item.scheduledStartTime)}〜`}
          {!isLive && countdown && (
            <span style={{ marginLeft: '8px', color: '#FF6600', fontWeight: 'bold' }}>
              {countdown}
            </span>
          )}
          {viewers && <span style={{ marginLeft: '8px' }}>👥 {viewers}</span>}
        </div>
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            fontSize: '12px',
            color: descColor,
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
            title={watched ? '通知オン（クリックで解除）' : '通知をオンにする'}
            onClick={() => onToggleWatch?.(item.id)}
            style={{
              padding: '4px 10px',
              fontSize: '14px',
              background: watched ? '#FF6600' : btnBg,
              color: watched ? '#fff' : btnColor,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔔
          </button>
          <button
            title={item.isFavorite ? 'お気に入り解除' : 'お気に入りに追加'}
            onClick={() => onToggleFavorite?.(item.id)}
            style={{
              padding: '4px 10px',
              fontSize: '14px',
              background: item.isFavorite ? '#FFD700' : btnBg,
              color: item.isFavorite ? '#333' : btnColor,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ⭐
          </button>
          {showViewedButton && (
            <button
              title={item.viewedAt ? '視聴済みを解除' : '見た'}
              onClick={() => onMarkViewed?.(item.id, !item.viewedAt)}
              style={{
                padding: '4px 10px',
                fontSize: '14px',
                background: item.viewedAt ? '#4CAF50' : btnBg,
                color: item.viewedAt ? '#fff' : btnColor,
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ✓
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

ScheduleCard.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string,
    concurrentViewers: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    status: PropTypes.string,
    thumbnail: PropTypes.string,
    title: PropTypes.string,
    channelTitle: PropTypes.string,
    channelId: PropTypes.string,
    actualStartTime: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    scheduledStartTime: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    description: PropTypes.string,
    url: PropTypes.string,
    channelUrl: PropTypes.string,
    isFavorite: PropTypes.bool,
    isNotify: PropTypes.bool,
    viewedAt: PropTypes.number
  }).isRequired,
  darkMode: PropTypes.bool,
  watched: PropTypes.bool,
  onToggleWatch: PropTypes.func,
  onToggleFavorite: PropTypes.func,
  onMarkViewed: PropTypes.func,
  onTogglePin: PropTypes.func,
  isPinned: PropTypes.bool,
  showViewedButton: PropTypes.bool,
  isViewed: PropTypes.bool,
  showStatusBadge: PropTypes.bool
}

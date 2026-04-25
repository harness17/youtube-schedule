import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

function formatViewers(count) {
  const n = parseInt(count, 10)
  if (isNaN(n)) return null
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万人視聴中`
  return `${n.toLocaleString()}人視聴中`
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
  const isUpcoming = item.status === 'upcoming'

  // カラートークン（light / dark）
  const surfaceColor = darkMode ? '#16161e' : '#ffffff'
  const textColor    = darkMode ? '#e8e8f0' : '#111120'
  const subColor     = darkMode ? '#7878a0' : '#6060a0'
  const timeColor    = darkMode ? '#a0a0c0' : '#505070'
  const descColor    = darkMode ? '#8888a8' : '#707090'

  // カードの枠線カラー
  const borderColor = isLive
    ? 'rgba(255,34,68,0.5)'
    : isUpcoming
      ? 'rgba(0,194,255,0.28)'
      : isPinned
        ? 'rgba(255,201,64,0.35)'
        : darkMode ? '#2a2a38' : '#dddde8'

  const cardClassName = [
    'yt-card',
    isLive ? 'yt-card--live' : '',
    isUpcoming ? 'yt-card--upcoming' : ''
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cardClassName}
      style={{
        display: 'flex',
        gap: '12px',
        padding: '12px',
        background: surfaceColor,
        borderRadius: '10px',
        border: `1px solid ${borderColor}`,
        borderLeft: isPinned ? `3px solid rgba(255,201,64,0.7)` : undefined,
        marginBottom: '8px',
        opacity: isViewed ? 0.55 : 1
      }}
    >
      {/* サムネイル */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img
          src={item.thumbnail}
          alt={item.title}
          style={{
            width: '160px',
            height: '90px',
            objectFit: 'cover',
            borderRadius: '6px',
            display: 'block'
          }}
        />
        {isLive && (
          <span
            style={{
              position: 'absolute',
              bottom: '5px',
              left: '5px',
              background: 'rgba(220,0,20,0.92)',
              color: 'white',
              fontSize: '10px',
              fontWeight: '700',
              padding: '2px 6px',
              borderRadius: '3px',
              letterSpacing: '0.4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span className="live-dot" />
            LIVE
          </span>
        )}
        {isUpcoming && !isLive && (
          <span
            style={{
              position: 'absolute',
              bottom: '5px',
              left: '5px',
              background: 'rgba(0,150,200,0.88)',
              color: 'white',
              fontSize: '10px',
              fontWeight: '700',
              padding: '2px 6px',
              borderRadius: '3px',
              letterSpacing: '0.3px'
            }}
          >
            UPCOMING
          </span>
        )}
      </div>

      {/* コンテンツ */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>

        {/* タイトル行 */}
        <div style={{ fontWeight: '700', fontSize: '14px', color: textColor, lineHeight: 1.4 }}>
          {item.title}
          {isViewed && (
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                marginLeft: '6px',
                borderRadius: '4px',
                background: darkMode ? '#2a2a38' : '#ebebf5',
                color: subColor,
                verticalAlign: 'middle',
                fontWeight: 'normal'
              }}
            >
              見た
            </span>
          )}
          {showStatusBadge && isUpcoming && (
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                marginLeft: '6px',
                borderRadius: '4px',
                background: 'rgba(0,194,255,0.12)',
                border: '1px solid rgba(0,194,255,0.3)',
                color: darkMode ? '#00c2ff' : '#0099cc',
                verticalAlign: 'middle',
                fontWeight: 'normal'
              }}
            >
              📅 配信予定
            </span>
          )}
          {showStatusBadge && isLive && (
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                marginLeft: '6px',
                borderRadius: '4px',
                background: 'rgba(255,34,68,0.12)',
                border: '1px solid rgba(255,34,68,0.3)',
                color: darkMode ? '#ff2244' : '#e8001c',
                verticalAlign: 'middle',
                fontWeight: 'normal'
              }}
            >
              🔴 配信中
            </span>
          )}
        </div>

        {/* チャンネル行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
              color: isPinned ? (darkMode ? '#ffc940' : '#d4900a') : subColor,
              fontWeight: isPinned ? '600' : 'normal',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: item.channelId ? 'pointer' : 'default',
              textDecoration: item.channelId ? 'underline' : 'none',
              textDecorationColor: 'transparent',
              transition: 'text-decoration-color 0.12s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.textDecorationColor = subColor}
            onMouseLeave={(e) => e.currentTarget.style.textDecorationColor = 'transparent'}
          >
            {item.channelTitle}
          </span>
          <button
            title={isPinned ? '優先解除' : '優先に設定'}
            onClick={(e) => { e.stopPropagation(); onTogglePin?.(item.channelId) }}
            style={{
              flexShrink: 0,
              padding: '2px 8px',
              fontSize: '11px',
              background: isPinned
                ? (darkMode ? 'rgba(255,201,64,0.18)' : 'rgba(212,144,10,0.12)')
                : (darkMode ? '#1e1e2c' : '#ebebf5'),
              color: isPinned ? (darkMode ? '#ffc940' : '#d4900a') : subColor,
              border: isPinned
                ? `1px solid ${darkMode ? 'rgba(255,201,64,0.4)' : 'rgba(212,144,10,0.35)'}`
                : `1px solid ${darkMode ? '#2a2a38' : '#dddde8'}`,
              borderRadius: '5px',
              cursor: 'pointer',
              lineHeight: '16px',
              fontWeight: isPinned ? '600' : 'normal',
              transition: 'all 0.12s',
              fontFamily: 'inherit'
            }}
          >
            📌 {isPinned ? '優先中' : 'チャンネル優先'}
          </button>
        </div>

        {/* 時刻・カウントダウン行 */}
        <div style={{ fontSize: '12px', color: timeColor }}>
          {isLive
            ? `配信中（${formatTime(item.actualStartTime)}〜）`
            : `${formatTime(item.scheduledStartTime)}〜`}
          {!isLive && countdown && (
            <span style={{ marginLeft: '8px', color: '#e07800', fontWeight: '700' }}>
              {countdown}
            </span>
          )}
          {viewers && <span style={{ marginLeft: '8px', color: subColor }}>👥 {viewers}</span>}
        </div>

        {/* 説明文 */}
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
            lineHeight: 1.5
          }}
        >
          {item.description}
        </div>

        {/* アクションボタン行 */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '2px' }}>
          <button
            onClick={() => window.api.openExternal(item.url)}
            style={{
              padding: '4px 12px',
              fontSize: '11px',
              background: darkMode ? 'rgba(255,34,68,0.15)' : 'rgba(220,0,20,0.1)',
              color: darkMode ? '#ff5566' : '#cc001a',
              border: `1px solid ${darkMode ? 'rgba(255,34,68,0.35)' : 'rgba(220,0,20,0.28)'}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: '500'
            }}
          >
            ▶ 開く
          </button>
          <button
            title={watched ? '通知オン（クリックで解除）' : '通知をオンにする'}
            onClick={() => onToggleWatch?.(item.id)}
            className={`yt-action-btn${watched ? ' yt-action-btn--notify' : ''}`}
          >
            🔔{watched ? ' ON' : ''}
          </button>
          <button
            title={item.isFavorite ? 'お気に入り解除' : 'お気に入りに追加'}
            onClick={() => onToggleFavorite?.(item.id)}
            className={`yt-action-btn${item.isFavorite ? ' yt-action-btn--fav' : ''}`}
          >
            ⭐{item.isFavorite ? '' : ''}
          </button>
          {showViewedButton && (
            <button
              title={item.viewedAt ? '視聴済みを解除' : '見た'}
              onClick={() => onMarkViewed?.(item.id, !item.viewedAt)}
              className={`yt-action-btn${item.viewedAt ? ' yt-action-btn--viewed' : ''}`}
            >
              ✓{item.viewedAt ? ' 済' : ''}
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

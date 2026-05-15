import { useState } from 'react'
import PropTypes from 'prop-types'

function toDateInputValue(value) {
  if (typeof value !== 'number') return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toStartOfDayEpoch(value) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

function toEndOfDayEpoch(value) {
  if (!value) return null
  const date = new Date(`${value}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

export function ArchiveFilterBar({ channels, filters, sort, onChangeFilters, onChangeSort }) {
  const [expanded, setExpanded] = useState(false)
  const activeFilterCount =
    (filters.channelIds.length > 0 ? 1 : 0) +
    (filters.videoType !== 'all' ? 1 : 0) +
    (filters.period !== 'all' ? 1 : 0)

  function updateFilters(patch) {
    onChangeFilters({ ...filters, ...patch })
  }

  function handleChannelToggle(channelId, checked) {
    const nextIds = checked
      ? [...filters.channelIds, channelId]
      : filters.channelIds.filter((id) => id !== channelId)
    updateFilters({ channelIds: nextIds })
  }

  return (
    <div
      style={{
        marginBottom: '14px',
        padding: expanded ? '10px 12px' : 0,
        border: expanded ? '1px solid var(--border)' : 'none',
        borderRadius: '8px',
        background: expanded ? 'var(--surface)' : 'transparent'
      }}
    >
      <button
        type="button"
        className="yt-nav-btn"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        絞り込み{' '}
        {activeFilterCount > 0 && <span className="yt-tab-badge">{activeFilterCount}</span>}{' '}
        {expanded ? '▲' : '▼'}
      </button>

      {expanded && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '10px',
            marginTop: '10px',
            alignItems: 'start'
          }}
        >
          <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: 'var(--sub)' }}>
            並び替え
            <select
              aria-label="並び替え"
              value={sort}
              onChange={(e) => onChangeSort(e.target.value)}
              style={selectStyle}
            >
              <option value="newest">新しい順</option>
              <option value="oldest">古い順</option>
              <option value="channel">チャンネル名</option>
              <option value="duration">再生時間</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: 'var(--sub)' }}>
            配信タイプ
            <select
              aria-label="配信タイプ"
              value={filters.videoType}
              onChange={(e) => updateFilters({ videoType: e.target.value })}
              style={selectStyle}
            >
              <option value="all">すべて</option>
              <option value="live-done">ライブ配信済み</option>
              <option value="didnt-air">流れた配信</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: 'var(--sub)' }}>
            期間
            <select
              aria-label="期間"
              value={filters.period}
              onChange={(e) => updateFilters({ period: e.target.value })}
              style={selectStyle}
            >
              <option value="all">すべて</option>
              <option value="7d">7日</option>
              <option value="30d">30日</option>
              <option value="90d">90日</option>
              <option value="custom">カスタム</option>
            </select>
          </label>

          {filters.period === 'custom' && (
            <div style={{ display: 'grid', gap: '6px' }}>
              <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: 'var(--sub)' }}>
                開始
                <input
                  type="date"
                  aria-label="開始日"
                  value={toDateInputValue(filters.customStart)}
                  onChange={(e) =>
                    updateFilters({ customStart: toStartOfDayEpoch(e.target.value) })
                  }
                  style={selectStyle}
                />
              </label>
              <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: 'var(--sub)' }}>
                終了
                <input
                  type="date"
                  aria-label="終了日"
                  value={toDateInputValue(filters.customEnd)}
                  onChange={(e) => updateFilters({ customEnd: toEndOfDayEpoch(e.target.value) })}
                  style={selectStyle}
                />
              </label>
            </div>
          )}

          {channels.length > 0 && (
            <fieldset
              style={{
                display: 'grid',
                gap: '6px',
                gridColumn: '1 / -1',
                padding: 0,
                margin: 0,
                border: 'none'
              }}
            >
              <legend style={{ fontSize: '12px', color: 'var(--sub)', marginBottom: '2px' }}>
                チャンネル
              </legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {channels.map((channel) => (
                  <label
                    key={channel.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      maxWidth: '100%',
                      padding: '5px 8px',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      background: 'var(--surface2)',
                      fontSize: '12px',
                      color: 'var(--text)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={filters.channelIds.includes(channel.id)}
                      onChange={(e) => handleChannelToggle(channel.id, e.target.checked)}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {channel.isPinned ? '📌 ' : ''}
                      {channel.title}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )}
    </div>
  )
}

const selectStyle = {
  minWidth: 0,
  width: '100%',
  padding: '7px 8px',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'var(--input-bg)',
  color: 'var(--text)',
  fontSize: '13px',
  fontFamily: 'inherit'
}

ArchiveFilterBar.propTypes = {
  channels: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      isPinned: PropTypes.bool
    })
  ).isRequired,
  filters: PropTypes.shape({
    channelIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    videoType: PropTypes.oneOf(['all', 'live-done', 'didnt-air']).isRequired,
    period: PropTypes.oneOf(['all', '7d', '30d', '90d', 'custom']).isRequired,
    customStart: PropTypes.number,
    customEnd: PropTypes.number
  }).isRequired,
  sort: PropTypes.oneOf(['newest', 'oldest', 'channel', 'duration']).isRequired,
  onChangeFilters: PropTypes.func.isRequired,
  onChangeSort: PropTypes.func.isRequired
}

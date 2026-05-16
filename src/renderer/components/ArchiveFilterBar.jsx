import { useEffect, useMemo, useRef, useState } from 'react'
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

export function ArchiveFilterBar({
  channels,
  filters,
  sort,
  onChangeFilters,
  onChangeSort,
  onReset
}) {
  const [expanded, setExpanded] = useState(false)
  const [channelPopoverOpen, setChannelPopoverOpen] = useState(false)
  const [channelSearch, setChannelSearch] = useState('')
  const channelPopoverRef = useRef(null)
  const activeFilterCount =
    (filters.channelIds.length > 0 ? 1 : 0) + (filters.period !== 'all' ? 1 : 0)
  const selectedChannels = useMemo(
    () => channels.filter((channel) => filters.channelIds.includes(channel.id)),
    [channels, filters.channelIds]
  )
  const filteredChannels = useMemo(() => {
    const query = channelSearch.trim().toLowerCase()
    if (!query) return channels
    return channels.filter((channel) => channel.title.toLowerCase().includes(query))
  }, [channelSearch, channels])

  useEffect(() => {
    if (!channelPopoverOpen) return
    function handleDocumentMouseDown(event) {
      if (!channelPopoverRef.current?.contains(event.target)) {
        setChannelPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleDocumentMouseDown)
    return () => document.removeEventListener('mousedown', handleDocumentMouseDown)
  }, [channelPopoverOpen])

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
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0
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
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '10px',
            alignItems: 'start',
            width: 'min(560px, calc(100vw - 48px))',
            padding: '10px 12px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            background: 'var(--surface)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)'
          }}
        >
          {(activeFilterCount > 0 || sort !== 'newest') && (
            <div
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                justifyContent: 'flex-end'
              }}
            >
              <button type="button" className="yt-nav-btn" onClick={onReset}>
                リセット
              </button>
            </div>
          )}

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
            <div
              ref={channelPopoverRef}
              style={{
                display: 'grid',
                gap: '6px',
                gridColumn: '1 / -1',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="yt-nav-btn"
                  aria-label="チャンネル"
                  aria-expanded={channelPopoverOpen}
                  onClick={() => setChannelPopoverOpen((value) => !value)}
                >
                  チャンネル{' '}
                  {filters.channelIds.length > 0 && (
                    <span className="yt-tab-badge">{filters.channelIds.length}</span>
                  )}
                </button>
                {selectedChannels.map((channel) => (
                  <span key={channel.id} style={chipStyle}>
                    {channel.isPinned ? '📌 ' : ''}
                    {channel.title}
                    <button
                      type="button"
                      aria-label={`${channel.title} を解除`}
                      onClick={() => handleChannelToggle(channel.id, false)}
                      style={chipButtonStyle}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {channelPopoverOpen && (
                <div style={popoverStyle}>
                  <input
                    type="search"
                    aria-label="チャンネル検索"
                    placeholder="チャンネル検索"
                    value={channelSearch}
                    onChange={(e) => setChannelSearch(e.target.value)}
                    style={selectStyle}
                  />
                  <div style={channelListStyle}>
                    {filteredChannels.length > 0 ? (
                      filteredChannels.map((channel) => (
                        <label key={channel.id} style={channelOptionStyle}>
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
                      ))
                    ) : (
                      <div style={{ padding: '8px', fontSize: '12px', color: 'var(--sub)' }}>
                        一致するチャンネルはありません
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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

const popoverStyle = {
  position: 'absolute',
  top: '34px',
  left: 0,
  zIndex: 10,
  display: 'grid',
  gap: '8px',
  width: 'min(360px, calc(100vw - 48px))',
  padding: '10px',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  background: 'var(--surface)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)'
}

const channelListStyle = {
  display: 'grid',
  gap: '4px',
  maxHeight: '220px',
  overflowY: 'auto'
}

const channelOptionStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  minWidth: 0,
  padding: '6px 8px',
  borderRadius: '6px',
  background: 'var(--surface2)',
  fontSize: '12px',
  color: 'var(--text)'
}

const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  minWidth: 0,
  maxWidth: '180px',
  padding: '5px 7px',
  border: '1px solid var(--border)',
  borderRadius: '999px',
  background: 'var(--surface2)',
  color: 'var(--text)',
  fontSize: '12px'
}

const chipButtonStyle = {
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: '14px',
  lineHeight: 1,
  padding: 0
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
    period: PropTypes.oneOf(['all', '7d', '30d', '90d', 'custom']).isRequired,
    customStart: PropTypes.number,
    customEnd: PropTypes.number
  }).isRequired,
  sort: PropTypes.oneOf(['newest', 'oldest', 'channel', 'duration']).isRequired,
  onChangeFilters: PropTypes.func.isRequired,
  onChangeSort: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired
}

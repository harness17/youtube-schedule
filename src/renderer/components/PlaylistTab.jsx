import { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import ScheduleCard from './ScheduleCard.jsx'
import { playlistErrorCode, playlistErrorMessage, usePlaylist } from '../hooks/usePlaylist.js'

function formatRelativeTime(ts) {
  if (!ts) return '未取得'
  const diff = Date.now() - Number(ts)
  if (!Number.isFinite(diff) || diff < 0) return 'たった今'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  return `${Math.floor(hours / 24)}日前`
}

export default function PlaylistTab({
  active,
  darkMode = false,
  isAuthenticated,
  searchQuery,
  hideMembershipVideos,
  pinnedChannelIds,
  onToggleWatch,
  onToggleFavorite,
  onMarkViewed,
  onTogglePin,
  onToast
}) {
  const {
    config,
    videos,
    activeVideos,
    configured,
    loading,
    refreshing,
    errorMessage,
    applyVideoUpdate,
    deleteOne,
    reload
  } = usePlaylist(active)
  const [playlists, setPlaylists] = useState([])
  const [playlistLoading, setPlaylistLoading] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configStatus, setConfigStatus] = useState(null)
  const [configError, setConfigError] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadPlaylists() {
      setPlaylistLoading(true)
      setConfigError(null)
      try {
        if (!isAuthenticated) {
          setPlaylists([])
          return
        }
        const result = await window.api.playlist.listMine()
        if (cancelled) return
        if (result?.error) {
          setConfigError(result.error)
          setPlaylists([])
        } else {
          setPlaylists(result ?? [])
        }
      } catch {
        if (!cancelled) setConfigError('FETCH_FAILED')
      } finally {
        if (!cancelled) setPlaylistLoading(false)
      }
    }
    if (active) loadPlaylists()
    return () => {
      cancelled = true
    }
  }, [active, isAuthenticated])

  useEffect(() => {
    const unsubscribeUpdated = window.api?.playlist?.onUpdated?.(() => {
      setSavingConfig(false)
      setConfigStatus('完了')
      reload()
    })
    const unsubscribeError = window.api?.playlist?.onError?.((payload) => {
      setSavingConfig(false)
      setConfigStatus(null)
      setConfigError(playlistErrorCode(payload) ?? 'REFRESH_FAILED')
    })
    return () => {
      unsubscribeUpdated?.()
      unsubscribeError?.()
    }
  }, [reload])

  const visibleVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return videos.filter((item) => {
      const matchesQuery =
        !q ||
        (item.title ?? '').toLowerCase().includes(q) ||
        (item.channelTitle ?? '').toLowerCase().includes(q)
      const matchesMembership = !hideMembershipVideos || !item.isMembershipOnly
      return matchesQuery && matchesMembership
    })
  }, [hideMembershipVideos, searchQuery, videos])

  const sections = useMemo(() => {
    return visibleVideos.reduce(
      (acc, item) => {
        if (item.viewedAt != null) acc.viewed.push(item)
        else if (item.status === 'ended') acc.ended.push(item)
        else acc.upcoming.push(item)
        return acc
      },
      { upcoming: [], ended: [], viewed: [] }
    )
  }, [visibleVideos])

  async function saveConfig(playlistId) {
    const playlist = playlists.find((item) => item.id === playlistId)
    const payload = {
      playlistId,
      playlistTitle: playlist?.title ?? config?.playlistTitle ?? '',
      enabled: true
    }
    setSavingConfig(true)
    setConfigStatus('取得中...')
    setConfigError(null)
    const result = await window.api.playlist.setConfig(payload)
    if (result?.error) {
      setSavingConfig(false)
      setConfigStatus(null)
      setConfigError(result.error)
      return
    }
    await reload()
    onToast?.('プレイリストを設定しました')
  }

  function handlePlaylistChange(e) {
    const playlistId = e.target.value
    if (!playlistId) return
    void saveConfig(playlistId)
  }

  async function handleDeleteOne() {
    if (!confirmingDelete) return
    await deleteOne(confirmingDelete.id)
    setConfirmingDelete(null)
    onToast?.('動画を削除しました')
  }

  async function handleToggleWatch(id) {
    const newVal = await onToggleWatch?.(id)
    if (newVal !== null && newVal !== undefined) {
      applyVideoUpdate(id, { isNotify: newVal })
    }
  }

  async function handleToggleFavorite(id) {
    const newVal = await onToggleFavorite?.(id)
    if (newVal !== null && newVal !== undefined) {
      applyVideoUpdate(id, { isFavorite: newVal })
    }
  }

  async function handleMarkViewed(id, viewed) {
    const viewedAt = await onMarkViewed?.(id, viewed)
    if (viewedAt !== undefined) {
      applyVideoUpdate(id, { viewedAt })
    }
  }

  function renderCard(item) {
    return (
      <ScheduleCard
        key={item.id}
        item={item}
        darkMode={darkMode}
        watched={item.isNotify}
        isPinned={pinnedChannelIds.has(item.channelId)}
        onToggleWatch={handleToggleWatch}
        onToggleFavorite={handleToggleFavorite}
        onMarkViewed={handleMarkViewed}
        onTogglePin={onTogglePin}
        showViewedButton={item.status === 'ended'}
        isViewed={item.viewedAt != null}
        showDateInTime={true}
        showStatusBadge={item.status !== 'ended'}
        isRemovedFromPlaylist={item.isRemovedFromPlaylist}
        onDeleteFromYoutom={
          item.isRemovedFromPlaylist ? () => setConfirmingDelete(item) : undefined
        }
      />
    )
  }

  const hasFilters = Boolean(searchQuery.trim())
  const emptyMessage = hasFilters
    ? '検索結果がありません'
    : configured
      ? 'プレイリスト動画はまだありません'
      : 'プレイリストが未設定です'
  const { upcoming, ended, viewed } = sections
  const hasAbove = (index) => [upcoming, ended].slice(0, index).some((s) => s.length > 0)
  const selectedId = config?.playlistId ?? ''
  const playlistSelectDisabled = playlistLoading || savingConfig || !isAuthenticated

  return (
    <div className="playlist-tab" data-theme={darkMode ? 'dark' : 'light'}>
      <div className="playlist-header">
        <div className="playlist-title-block">
          <h2>📂 プレイリスト</h2>
        </div>
        <div className="playlist-picker">
          <select
            aria-label="取得するプレイリスト"
            value={selectedId}
            disabled={playlistSelectDisabled}
            onChange={handlePlaylistChange}
          >
            <option value="">
              {!isAuthenticated
                ? 'ログインしてください'
                : playlistLoading
                  ? '読み込み中...'
                  : 'プレイリストを選択'}
            </option>
            {playlists.map((playlist) => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.title} ({playlist.itemCount ?? 0}件)
              </option>
            ))}
          </select>
          <div className="playlist-help">
            ※「後で見る」「高評価動画」は YouTube 仕様により取得できません
          </div>
          <div className="playlist-meta">
            {configured
              ? `${activeVideos.length}件 / 最終取得: ${formatRelativeTime(config.lastSyncedAt)}`
              : '未設定'}
          </div>
        </div>
      </div>

      {errorMessage && <div className="playlist-error">{errorMessage}</div>}
      {!isAuthenticated && <div className="playlist-error">ログインしてください</div>}
      {configError && <div className="playlist-error">{playlistErrorMessage(configError)}</div>}
      {configStatus && <div className="playlist-message">{configStatus}</div>}

      {refreshing && <div className="playlist-message">取得中...</div>}

      {loading ? (
        <div className="playlist-empty">読み込み中...</div>
      ) : visibleVideos.length === 0 ? (
        <div className={`playlist-empty${configured ? '' : ' playlist-empty--panel'}`}>
          <span>{emptyMessage}</span>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <div className="yt-section-label">📅 予定・配信中</div>
              {upcoming.map((item) => renderCard(item))}
            </>
          )}
          {ended.length > 0 && (
            <>
              <div className="yt-section-label" style={{ marginTop: hasAbove(1) ? '16px' : 0 }}>
                📋 通常
              </div>
              {ended.map((item) => renderCard(item))}
            </>
          )}
          {viewed.length > 0 && (
            <>
              <div className="yt-section-label" style={{ marginTop: hasAbove(2) ? '16px' : 0 }}>
                ✅ 視聴済み
              </div>
              {viewed.map((item) => renderCard(item))}
            </>
          )}
        </>
      )}

      {confirmingDelete && (
        <div className="playlist-confirm">
          <div className="playlist-confirm-box">
            <div className="playlist-confirm-title">この動画を YouTom から削除しますか？</div>
            <div className="playlist-help">「{confirmingDelete.title}」を削除します。</div>
            <div className="playlist-actions">
              <button type="button" className="playlist-danger-btn" onClick={handleDeleteOne}>
                削除する
              </button>
              <button
                type="button"
                className="playlist-secondary-btn"
                onClick={() => setConfirmingDelete(null)}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

PlaylistTab.propTypes = {
  active: PropTypes.bool.isRequired,
  darkMode: PropTypes.bool,
  isAuthenticated: PropTypes.bool.isRequired,
  searchQuery: PropTypes.string.isRequired,
  hideMembershipVideos: PropTypes.bool.isRequired,
  pinnedChannelIds: PropTypes.instanceOf(Set).isRequired,
  onToggleWatch: PropTypes.func,
  onToggleFavorite: PropTypes.func,
  onMarkViewed: PropTypes.func,
  onTogglePin: PropTypes.func,
  onToast: PropTypes.func
}

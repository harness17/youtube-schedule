import { useCallback, useEffect, useMemo, useState } from 'react'

export const PLAYLIST_ERROR_MESSAGES = {
  NOT_AUTHENTICATED: 'ログインしてください',
  PLAYLIST_NOT_CONFIGURED: '設定からプレイリストを選択してください',
  QUOTA_EXCEEDED: 'YouTube API クォータ上限に達しました。翌日 17:00 (JST) 頃にリセットされます',
  PLAYLIST_NOT_FOUND:
    'プレイリストが削除/非公開化されている可能性があります。設定で再選択してください'
}

export function playlistErrorCode(payload) {
  if (!payload) return null
  if (typeof payload === 'string') return payload
  return payload.error ?? payload.message ?? payload.code ?? null
}

export function playlistErrorMessage(payload) {
  const code = playlistErrorCode(payload)
  if (!code) return null
  if (PLAYLIST_ERROR_MESSAGES[code]) return PLAYLIST_ERROR_MESSAGES[code]
  return `同期に失敗しました（${code}）`
}

function hasConfig(config) {
  return Boolean(config?.enabled && config?.playlistId)
}

function markRemoved(allVideos, removedVideos) {
  const removedIds = new Set(removedVideos.map((video) => video.id))
  return allVideos.map((video) => ({
    ...video,
    isRemovedFromPlaylist: removedIds.has(video.id)
  }))
}

export function usePlaylist(active = true) {
  const [config, setConfig] = useState(null)
  const [videos, setVideos] = useState([])
  const [removedVideos, setRemovedVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [lastResult, setLastResult] = useState(null)

  const load = useCallback(async () => {
    if (!window.api?.playlist) return
    setLoading(true)
    setError(null)
    try {
      const [nextConfig, all, removed] = await Promise.all([
        window.api.playlist.getConfig(),
        window.api.playlist.get({ filter: 'all' }),
        window.api.playlist.get({ filter: 'removed' })
      ])
      setConfig(nextConfig)
      setRemovedVideos(removed ?? [])
      setVideos(markRemoved(all ?? [], removed ?? []))
    } catch {
      setError('REFRESH_FAILED')
      setVideos([])
      setRemovedVideos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (active) load()
  }, [active, load])

  useEffect(() => {
    const unsubscribeUpdated = window.api?.playlist?.onUpdated?.((result) => {
      setLastResult(result ?? null)
      setRefreshing(false)
      load()
    })
    const unsubscribeError = window.api?.playlist?.onError?.((payload) => {
      setError(playlistErrorCode(payload) ?? 'REFRESH_FAILED')
      setRefreshing(false)
    })
    return () => {
      unsubscribeUpdated?.()
      unsubscribeError?.()
    }
  }, [load])

  const refresh = useCallback(async () => {
    if (!window.api?.playlist || refreshing) return null
    setRefreshing(true)
    setError(null)
    try {
      const result = await window.api.playlist.refresh()
      if (result?.error) {
        setError(result.error)
        return result
      }
      setLastResult(result ?? null)
      await load()
      return result
    } catch {
      setError('REFRESH_FAILED')
      return { error: 'REFRESH_FAILED' }
    } finally {
      setRefreshing(false)
    }
  }, [load, refreshing])

  const applyVideoUpdate = useCallback((id, patch) => {
    const patchFn = (video) => (video.id === id ? { ...video, ...patch } : video)
    setVideos((prev) => prev.map(patchFn))
    setRemovedVideos((prev) => prev.map(patchFn))
  }, [])

  const cleanupRemoved = useCallback(async () => {
    const result = await window.api?.playlist?.cleanup?.()
    await load()
    return result ?? { deleted: 0 }
  }, [load])

  const deleteOne = useCallback(async (videoId) => {
    const result = await window.api?.playlist?.deleteOne?.(videoId)
    if ((result?.deleted ?? 0) > 0) {
      setVideos((prev) => prev.filter((video) => video.id !== videoId))
      setRemovedVideos((prev) => prev.filter((video) => video.id !== videoId))
    }
    return result ?? { deleted: 0 }
  }, [])

  const configured = hasConfig(config)
  const removedCount = removedVideos.length
  const errorMessage = playlistErrorMessage(error)
  const activeVideos = useMemo(
    () => videos.filter((video) => !video.isRemovedFromPlaylist),
    [videos]
  )

  return {
    config,
    videos,
    activeVideos,
    removedVideos,
    removedCount,
    configured,
    loading,
    refreshing,
    error,
    errorMessage,
    lastResult,
    reload: load,
    refresh,
    applyVideoUpdate,
    cleanupRemoved,
    deleteOne
  }
}

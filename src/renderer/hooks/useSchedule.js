import { useState, useEffect, useCallback } from 'react'

export function useSchedule() {
  const [live, setLive] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [feedVideos, setFeedVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dbBroken, setDbBroken] = useState(false)
  const [initialLoaded, setInitialLoaded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [schedResult, feedResult] = await Promise.all([
        window.api.getSchedule(),
        window.api.getFeed()
      ])
      if (schedResult.dbBroken) {
        setDbBroken(true)
        setLive([])
        setUpcoming([])
        setFeedVideos([])
      } else if (schedResult.error) {
        setError(schedResult.error)
      } else {
        setDbBroken(false)
        setLive(schedResult.live ?? [])
        setUpcoming(schedResult.upcoming ?? [])
        setFeedVideos(feedResult?.videos ?? [])
      }
    } catch (e) {
      setError(e.message ?? 'FETCH_FAILED')
    } finally {
      setLoading(false)
      setInitialLoaded(true)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.refreshSchedule()
      if (result?.error) {
        setError(result.error)
        setLoading(false)
        return result
      }
      // schedule:updated イベントが遅延・欠落しても手動更新の loading を残さない
      await load()
      return result
    } catch (e) {
      setError(e.message ?? 'FETCH_FAILED')
      setLoading(false)
    }
  }, [load])

  useEffect(() => {
    load()
    // schedule:updated イベントで自動リロード
    const off = window.api.onScheduleUpdated?.(() => load())
    const offError = window.api.onScheduleError?.((payload) => {
      setError(payload?.error ?? 'FETCH_FAILED')
      setLoading(false)
      setInitialLoaded(true)
    })
    return () => {
      off?.()
      offError?.()
    }
  }, [load])

  function updateVideo(id, patch) {
    setLive((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
    setUpcoming((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
    setFeedVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }

  return {
    live,
    upcoming,
    feedVideos,
    loading,
    error,
    dbBroken,
    initialLoaded,
    refresh,
    updateVideo
  }
}

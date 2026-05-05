import { useState, useEffect, useCallback } from 'react'

export function useSchedule() {
  const [live, setLive] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [feedVideos, setFeedVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dbBroken, setDbBroken] = useState(false)

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
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await window.api.refreshSchedule()
      // schedule:updated イベントで load() が呼ばれる
    } catch (e) {
      setError(e.message ?? 'FETCH_FAILED')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // schedule:updated イベントで自動リロード
    const off = window.api.onScheduleUpdated?.(() => load())
    return () => off?.()
  }, [load])

  function updateVideo(id, patch) {
    setLive((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
    setUpcoming((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
    setFeedVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }

  return { live, upcoming, feedVideos, loading, error, dbBroken, refresh, updateVideo }
}

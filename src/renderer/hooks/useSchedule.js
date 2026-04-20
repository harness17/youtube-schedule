import { useState, useEffect } from 'react'

export function useSchedule() {
  const [live, setLive] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dbBroken, setDbBroken] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.getSchedule()
      if (result.dbBroken) {
        setDbBroken(true)
        setLive([])
        setUpcoming([])
      } else if (result.error) {
        setError(result.error)
      } else {
        setDbBroken(false)
        setLive(result.live ?? [])
        setUpcoming(result.upcoming ?? [])
      }
    } catch (e) {
      setError(e.message ?? 'FETCH_FAILED')
    } finally {
      setLoading(false)
    }
  }

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      await window.api.refreshSchedule()
      // schedule:updated イベントで load() が呼ばれる
    } catch (e) {
      setError(e.message ?? 'FETCH_FAILED')
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // schedule:updated イベントで自動リロード
    const off = window.api.onScheduleUpdated?.(() => load())
    return () => off?.()
  }, [])

  function updateVideo(id, patch) {
    setLive((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
    setUpcoming((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }

  return { live, upcoming, loading, error, dbBroken, refresh, updateVideo }
}
